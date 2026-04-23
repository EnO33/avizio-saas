import { desc, eq, sql } from "drizzle-orm";
import type { DbError } from "#/lib/errors";
import { unknownToMessage } from "#/lib/errors";
import { fromPromise, type Result } from "#/lib/result";
import { db } from "../client";
import { establishments, reviews } from "../schema";

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
