import { desc, eq, sql } from "drizzle-orm";
import type { DbError } from "#/lib/errors";
import { unknownToMessage } from "#/lib/errors";
import { err, fromPromise, ok, type Result } from "#/lib/result";
import { db } from "../client";
import { establishments, type NewReview, reviews } from "../schema";

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
