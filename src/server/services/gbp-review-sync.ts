import type { DbError, GbpError, IntegrationError } from "#/lib/errors";
import { logger } from "#/lib/logger";
import { err, ok, type Result } from "#/lib/result";
import {
	type UpsertReviewInput,
	upsertReview,
} from "#/server/db/queries/reviews";
import {
	type GbpReview,
	listReviews,
} from "#/server/integrations/google-business";

/**
 * Max pages we walk for a single (establishment, run) pair before bailing
 * out — defence against a pathological case where `nextPageToken` keeps
 * coming back (shouldn't happen per Google's contract, but cron jobs that
 * can run forever are bad news).
 */
const MAX_PAGES_PER_ESTABLISHMENT = 20;

export type ReviewSyncStats = {
	readonly inserted: number;
	readonly updated: number;
	readonly skipped: number;
	readonly pages: number;
};

const EMPTY_STATS: ReviewSyncStats = {
	inserted: 0,
	updated: 0,
	skipped: 0,
	pages: 0,
};

/**
 * Pure mapping from Google's review shape to our DB insert shape. Returns
 * `null` when the review should be skipped — today the only skip case is
 * `STAR_RATING_UNSPECIFIED` because our `reviews.rating` column is NOT NULL
 * 1..5, and a rating-less Google review wouldn't render sensibly in the UI
 * anyway. Callers surface skip counts in the cron stats so we can notice
 * if Google ever starts shipping lots of them.
 */
export function gbpReviewToUpsertInput(params: {
	review: GbpReview;
	establishmentId: string;
	establishmentLanguageCode: string;
}): UpsertReviewInput | null {
	const { review, establishmentId, establishmentLanguageCode } = params;
	if (review.rating === null) return null;

	// Existing reply on Google's side → we mark the review as already
	// responded. We intentionally don't backfill a `responses` row here —
	// importing a reply we didn't author would muddy the audit trail. The
	// detail page shows the existing reply from the raw payload.
	const status: UpsertReviewInput["status"] = review.existingReply
		? "responded"
		: "new";

	return {
		establishmentId,
		platform: "google",
		platformReviewId: review.reviewId,
		authorName: review.authorName,
		authorAvatarUrl: review.authorAvatarUrl,
		rating: review.rating,
		content: review.content,
		languageCode: establishmentLanguageCode,
		publishedAt: new Date(review.publishedAt),
		status,
		// Stash the whole Google payload so a future reprocessing pass has
		// everything it needs without re-fetching (author profile link,
		// reply text, update timestamps, etc.).
		rawPayload: review,
	};
}

/**
 * Fetch every review for a single establishment's linked Google location,
 * walking all pages of the legacy v4 endpoint, and upsert each one. Per-row
 * errors are tolerated and counted as `skipped` — a malformed review
 * shouldn't tank the sync for the other 199 in the page. A page-level error
 * (auth, scope, quota) short-circuits the loop and bubbles up so the cron
 * can log it and move on to the next establishment.
 */
export async function fetchAndUpsertReviewsForEstablishment(params: {
	accessToken: string;
	establishmentId: string;
	googleLocationName: string;
	establishmentLanguageCode: string;
}): Promise<Result<ReviewSyncStats, GbpError | IntegrationError | DbError>> {
	let inserted = 0;
	let updated = 0;
	let skipped = 0;
	let pages = 0;
	let pageToken: string | undefined;

	for (let i = 0; i < MAX_PAGES_PER_ESTABLISHMENT; i++) {
		const pageResult = await listReviews({
			accessToken: params.accessToken,
			locationName: params.googleLocationName,
			pageToken,
		});
		if (pageResult.isErr()) return err(pageResult.error);

		const page = pageResult.value;
		pages++;

		for (const review of page.reviews) {
			const input = gbpReviewToUpsertInput({
				review,
				establishmentId: params.establishmentId,
				establishmentLanguageCode: params.establishmentLanguageCode,
			});
			if (!input) {
				skipped++;
				continue;
			}

			const upsertResult = await upsertReview(input);
			if (upsertResult.isErr()) {
				// Log + skip rather than abort — a single row-level DB error
				// (constraint violation on weird data) shouldn't lose the rest
				// of the page.
				logger.warn(
					{
						event: "gbp_review_upsert_failed",
						kind: upsertResult.error.kind,
						establishmentId: params.establishmentId,
						platformReviewId: review.reviewId,
					},
					"Failed to upsert a single review, continuing",
				);
				skipped++;
				continue;
			}
			if (upsertResult.value === "inserted") inserted++;
			else updated++;
		}

		if (!page.nextPageToken) break;
		pageToken = page.nextPageToken;
	}

	return ok({ inserted, updated, skipped, pages });
}

export { EMPTY_STATS };
