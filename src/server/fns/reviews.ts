import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { logger } from "#/lib/logger";
import {
	countReviewsByStatusForOrg,
	listReviewsForOrg,
	type ReviewStatusCounts,
	type ReviewSummary,
} from "#/server/db/queries/reviews";

/**
 * Returns the reviews for the caller's current organization, newest first.
 * Empty array when there's no active org or the DB read fails — the UI
 * already has a neutral empty state that covers both cases.
 */
export const listReviews = createServerFn().handler(
	async (): Promise<ReviewSummary[]> => {
		const session = await auth();
		if (!session.isAuthenticated || !session.orgId) return [];

		const result = await listReviewsForOrg(session.orgId);
		if (result.isErr()) {
			logger.error(
				{
					event: "reviews_list_failed",
					kind: result.error.kind,
					orgId: session.orgId,
				},
				"Failed to list reviews",
			);
			return [];
		}
		return result.value;
	},
);

const EMPTY_COUNTS: ReviewStatusCounts = {
	new: 0,
	in_progress: 0,
	responded: 0,
	skipped: 0,
};

/**
 * Returns per-status review counts for the caller's current organization.
 * Used by the dashboard "avis à traiter" badge. Falls back to all-zeros on
 * auth / DB failure so the dashboard still renders something sane.
 */
export const countReviewsByStatus = createServerFn().handler(
	async (): Promise<ReviewStatusCounts> => {
		const session = await auth();
		if (!session.isAuthenticated || !session.orgId) return EMPTY_COUNTS;

		const result = await countReviewsByStatusForOrg(session.orgId);
		if (result.isErr()) {
			logger.error(
				{
					event: "reviews_count_failed",
					kind: result.error.kind,
					orgId: session.orgId,
				},
				"Failed to count reviews by status",
			);
			return EMPTY_COUNTS;
		}
		return result.value;
	},
);
