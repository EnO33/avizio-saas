import type { DbError } from "#/lib/errors";
import { unknownToMessage } from "#/lib/errors";
import { err, fromPromise, ok, type Result } from "#/lib/result";
import { db } from "../client";
import { responses } from "../schema";
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
