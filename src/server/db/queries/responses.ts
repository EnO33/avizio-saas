import { and, asc, eq } from "drizzle-orm";
import type { DbError } from "#/lib/errors";
import { unknownToMessage } from "#/lib/errors";
import { err, fromPromise, ok, type Result } from "#/lib/result";
import { db } from "../client";
import { establishments, responses, reviews } from "../schema";
import type { Tone } from "./establishments";

export type ResponseStatus = "draft" | "approved" | "published" | "failed";

/**
 * Client-safe projection of a response row. Includes the model + prompt
 * version so the review detail page can label AI drafts ("Généré par
 * claude-sonnet-4-5, prompt v1") and so the audit trail stays visible when
 * we later compare draft quality across prompt iterations.
 */
export type ResponseSummary = {
	readonly id: string;
	readonly reviewId: string;
	readonly content: string;
	readonly aiGenerated: boolean;
	readonly tone: Tone;
	readonly modelId: string | null;
	readonly promptVersion: string | null;
	readonly status: ResponseStatus;
	readonly publishedAt: Date | null;
	readonly createdAt: Date;
	readonly updatedAt: Date;
};

export type CreateResponseDraftInput = {
	readonly reviewId: string;
	readonly content: string;
	readonly aiGenerated: boolean;
	readonly tone: Tone;
	readonly modelId: string | null;
	readonly promptVersion: string | null;
};

const SUMMARY_COLUMNS = {
	id: responses.id,
	reviewId: responses.reviewId,
	content: responses.content,
	aiGenerated: responses.aiGenerated,
	tone: responses.tone,
	modelId: responses.modelId,
	promptVersion: responses.promptVersion,
	status: responses.status,
	publishedAt: responses.publishedAt,
	createdAt: responses.createdAt,
	updatedAt: responses.updatedAt,
} as const;

function toDbError(e: unknown): DbError {
	return { kind: "db_unknown", message: unknownToMessage(e) };
}

/**
 * Insert a new response row with status='draft'. Multiple drafts per
 * review are allowed — the user can regenerate with a different tone or
 * edit an existing draft and we don't want to silently discard attempts.
 */
export async function createResponseDraft(
	input: CreateResponseDraftInput,
): Promise<Result<ResponseSummary, DbError>> {
	const rows = await fromPromise(
		db
			.insert(responses)
			.values({
				reviewId: input.reviewId,
				content: input.content,
				aiGenerated: input.aiGenerated,
				tone: input.tone,
				modelId: input.modelId,
				promptVersion: input.promptVersion,
				status: "draft",
			})
			.returning(SUMMARY_COLUMNS),
		toDbError,
	);
	if (rows.isErr()) return err(rows.error);
	const first = rows.value[0];
	if (!first) {
		return err({
			kind: "db_unknown",
			message: "createResponseDraft returned no row",
		});
	}
	return ok(first);
}

/**
 * List every response attached to a review, scoped by the review's org via
 * the reviews → establishments join. Oldest first so the UI naturally
 * renders history top-to-bottom with the latest draft at the bottom (most
 * recent is typically the one the user cares about editing).
 */
export async function listResponsesForReview(params: {
	reviewId: string;
	organizationId: string;
}): Promise<Result<ResponseSummary[], DbError>> {
	return fromPromise(
		db
			.select(SUMMARY_COLUMNS)
			.from(responses)
			.innerJoin(reviews, eq(responses.reviewId, reviews.id))
			.innerJoin(establishments, eq(reviews.establishmentId, establishments.id))
			.where(
				and(
					eq(responses.reviewId, params.reviewId),
					eq(establishments.organizationId, params.organizationId),
				),
			)
			.orderBy(asc(responses.createdAt)),
		toDbError,
	);
}

/**
 * Update the text of a response row. Scoped by org through the reviews +
 * establishments join (resolved first, then a primary-key UPDATE) so one
 * tenant can't mutate another's draft. Allowed on any status — the user
 * might want to tweak after approving but before publishing.
 */
export async function updateResponseContent(params: {
	id: string;
	organizationId: string;
	content: string;
}): Promise<Result<ResponseSummary, DbError>> {
	const scopedResult = await fromPromise(
		db
			.select({ id: responses.id })
			.from(responses)
			.innerJoin(reviews, eq(responses.reviewId, reviews.id))
			.innerJoin(establishments, eq(reviews.establishmentId, establishments.id))
			.where(
				and(
					eq(responses.id, params.id),
					eq(establishments.organizationId, params.organizationId),
				),
			)
			.limit(1),
		toDbError,
	);
	if (scopedResult.isErr()) return err(scopedResult.error);
	const scopedId = scopedResult.value[0]?.id;
	if (!scopedId) return err({ kind: "db_not_found" });

	const rows = await fromPromise(
		db
			.update(responses)
			.set({ content: params.content, updatedAt: new Date() })
			.where(eq(responses.id, scopedId))
			.returning(SUMMARY_COLUMNS),
		toDbError,
	);
	if (rows.isErr()) return err(rows.error);
	const first = rows.value[0];
	if (!first) return err({ kind: "db_not_found" });
	return ok(first);
}

/**
 * Flip a draft to 'approved'. Scoped by org (same subquery pattern as
 * updateResponseContent). Only operates on drafts — approving an
 * already-approved or published row is a no-op that surfaces as db_not_found
 * so the caller can refresh their view.
 */
export async function approveResponse(params: {
	id: string;
	organizationId: string;
}): Promise<Result<ResponseSummary, DbError>> {
	const scopedIds = await fromPromise(
		db
			.select({ id: responses.id })
			.from(responses)
			.innerJoin(reviews, eq(responses.reviewId, reviews.id))
			.innerJoin(establishments, eq(reviews.establishmentId, establishments.id))
			.where(
				and(
					eq(responses.id, params.id),
					eq(establishments.organizationId, params.organizationId),
					eq(responses.status, "draft"),
				),
			),
		toDbError,
	);
	if (scopedIds.isErr()) return err(scopedIds.error);
	const scopedId = scopedIds.value[0]?.id;
	if (!scopedId) return err({ kind: "db_not_found" });

	const rows = await fromPromise(
		db
			.update(responses)
			.set({ status: "approved", updatedAt: new Date() })
			.where(eq(responses.id, scopedId))
			.returning(SUMMARY_COLUMNS),
		toDbError,
	);
	if (rows.isErr()) return err(rows.error);
	const first = rows.value[0];
	if (!first) return err({ kind: "db_not_found" });
	return ok(first);
}
