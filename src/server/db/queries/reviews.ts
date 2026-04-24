import { and, desc, eq, sql } from "drizzle-orm";
import type { DbError } from "#/lib/errors";
import { unknownToMessage } from "#/lib/errors";
import { err, fromPromise, ok, type Result } from "#/lib/result";
import { db } from "../client";
import { establishments, type NewReview, reviews } from "../schema";
import type { BusinessType, Tone } from "./establishments";

/**
 * Client-safe projection of a review row. Joins the establishment name for
 * display — the user thinks in terms of "which of my places got this review"
 * rather than opaque establishment ids.
 */
export type ReviewSummary = {
	readonly id: string;
	readonly establishmentId: string;
	readonly establishmentName: string;
	readonly platform: "google" | "tripadvisor" | "trustpilot" | "thefork";
	readonly authorName: string;
	readonly authorAvatarUrl: string | null;
	readonly rating: number;
	readonly content: string;
	readonly publishedAt: Date;
	readonly status: "new" | "in_progress" | "responded" | "skipped";
};

export type ReviewStatusCounts = {
	readonly new: number;
	readonly in_progress: number;
	readonly responded: number;
	readonly skipped: number;
};

function toDbError(e: unknown): DbError {
	return { kind: "db_unknown", message: unknownToMessage(e) };
}

/**
 * List every review across every establishment of an organization, newest
 * first by published date. Scope goes through the `establishments` join so
 * we can't accidentally leak another org's reviews if a row ends up with a
 * wrong establishment_id.
 */
export async function listReviewsForOrg(
	organizationId: string,
): Promise<Result<ReviewSummary[], DbError>> {
	return fromPromise(
		db
			.select({
				id: reviews.id,
				establishmentId: reviews.establishmentId,
				establishmentName: establishments.name,
				platform: reviews.platform,
				authorName: reviews.authorName,
				authorAvatarUrl: reviews.authorAvatarUrl,
				rating: reviews.rating,
				content: reviews.content,
				publishedAt: reviews.publishedAt,
				status: reviews.status,
			})
			.from(reviews)
			.innerJoin(establishments, eq(reviews.establishmentId, establishments.id))
			.where(eq(establishments.organizationId, organizationId))
			.orderBy(desc(reviews.publishedAt)),
		toDbError,
	);
}

/**
 * Aggregate review count per status for an organization. Used by the
 * dashboard to show "X avis à traiter" without shipping the full list.
 */
export async function countReviewsByStatusForOrg(
	organizationId: string,
): Promise<Result<ReviewStatusCounts, DbError>> {
	const rowsResult = await fromPromise(
		db
			.select({
				status: reviews.status,
				count: sql<number>`count(*)::int`,
			})
			.from(reviews)
			.innerJoin(establishments, eq(reviews.establishmentId, establishments.id))
			.where(eq(establishments.organizationId, organizationId))
			.groupBy(reviews.status),
		toDbError,
	);

	return rowsResult.map((rows) => {
		const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.count]));
		return {
			new: byStatus.new ?? 0,
			in_progress: byStatus.in_progress ?? 0,
			responded: byStatus.responded ?? 0,
			skipped: byStatus.skipped ?? 0,
		};
	});
}

export type UpsertReviewInput = Pick<
	NewReview,
	| "establishmentId"
	| "platform"
	| "platformReviewId"
	| "authorName"
	| "authorAvatarUrl"
	| "rating"
	| "content"
	| "languageCode"
	| "publishedAt"
	| "status"
	| "rawPayload"
>;

export type UpsertReviewOutcome = "inserted" | "updated";

/**
 * Idempotent upsert keyed on (platform, platform_review_id) — the unique
 * index on the reviews table. On conflict we refresh the fields that can
 * actually change on Google's side (content, rating, author + avatar url,
 * raw payload, fetched_at), but deliberately preserve the establishment id,
 * the published_at (immutable from Google) and the status — we don't want
 * a refetch to downgrade a review from `responded` back to `new`.
 */
export async function upsertReview(
	input: UpsertReviewInput,
): Promise<Result<UpsertReviewOutcome, DbError>> {
	const now = new Date();
	const rows = await fromPromise(
		db
			.insert(reviews)
			.values({ ...input, fetchedAt: now })
			.onConflictDoUpdate({
				target: [reviews.platform, reviews.platformReviewId],
				set: {
					authorName: input.authorName,
					authorAvatarUrl: input.authorAvatarUrl,
					rating: input.rating,
					content: input.content,
					languageCode: input.languageCode,
					rawPayload: input.rawPayload,
					fetchedAt: now,
				},
			})
			.returning({
				id: reviews.id,
				// PostgreSQL system column: xmax = 0 for fresh inserts,
				// > 0 for rows that were updated by onConflict.
				wasInserted: sql<boolean>`(xmax = 0)`,
			}),
		toDbError,
	);
	if (rows.isErr()) return err(rows.error);
	const first = rows.value[0];
	if (!first) {
		return err({
			kind: "db_unknown",
			message: "upsertReview returned no row",
		});
	}
	return ok(first.wasInserted ? "inserted" : "updated");
}

/**
 * Denormalised view joining a review with everything the AI response
 * prompt needs from its establishment. Scoped by org through the join so a
 * caller can only ever see their own reviews.
 */
export type ReviewWithEstablishment = {
	readonly review: {
		readonly id: string;
		readonly establishmentId: string;
		readonly establishmentName: string;
		readonly platform: ReviewSummary["platform"];
		readonly authorName: string;
		readonly authorAvatarUrl: string | null;
		readonly rating: number;
		readonly content: string;
		readonly status: ReviewSummary["status"];
		readonly publishedAt: Date;
	};
	readonly establishment: {
		readonly id: string;
		readonly name: string;
		readonly city: string;
		readonly businessType: BusinessType;
		readonly brandContext: string | null;
		readonly defaultTone: Tone;
	};
};

/**
 * Fetch a single review + its establishment context, scoped by org. Used
 * by the AI response generation flow to build the prompt. Returns
 * `db_not_found` when the review id is unknown or belongs to another org.
 */
export async function getReviewWithEstablishmentForOrg(params: {
	reviewId: string;
	organizationId: string;
}): Promise<Result<ReviewWithEstablishment, DbError>> {
	const rows = await fromPromise(
		db
			.select({
				reviewId: reviews.id,
				platform: reviews.platform,
				authorName: reviews.authorName,
				authorAvatarUrl: reviews.authorAvatarUrl,
				rating: reviews.rating,
				content: reviews.content,
				status: reviews.status,
				publishedAt: reviews.publishedAt,
				establishmentId: establishments.id,
				establishmentName: establishments.name,
				city: establishments.city,
				businessType: establishments.businessType,
				brandContext: establishments.brandContext,
				defaultTone: establishments.defaultTone,
			})
			.from(reviews)
			.innerJoin(establishments, eq(reviews.establishmentId, establishments.id))
			.where(
				and(
					eq(reviews.id, params.reviewId),
					eq(establishments.organizationId, params.organizationId),
				),
			)
			.limit(1),
		toDbError,
	);
	if (rows.isErr()) return err(rows.error);
	const row = rows.value[0];
	if (!row) return err({ kind: "db_not_found" });
	return ok({
		review: {
			id: row.reviewId,
			establishmentId: row.establishmentId,
			establishmentName: row.establishmentName,
			platform: row.platform,
			authorName: row.authorName,
			authorAvatarUrl: row.authorAvatarUrl,
			rating: row.rating,
			content: row.content,
			status: row.status,
			publishedAt: row.publishedAt,
		},
		establishment: {
			id: row.establishmentId,
			name: row.establishmentName,
			city: row.city,
			businessType: row.businessType,
			brandContext: row.brandContext,
			defaultTone: row.defaultTone,
		},
	});
}
