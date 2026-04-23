import { describe, expect, it } from "vitest";
import type { GbpReview } from "#/server/integrations/google-business";
import { gbpReviewToUpsertInput } from "./gbp-review-sync";

function makeReview(overrides: Partial<GbpReview> = {}): GbpReview {
	return {
		name: "accounts/100/locations/987/reviews/rev-42",
		reviewId: "rev-42",
		authorName: "Alice Martin",
		authorAvatarUrl: "https://example.com/alice.png",
		isAnonymous: false,
		rating: 5,
		content: "Super accueil !",
		publishedAt: "2026-04-20T14:30:00Z",
		updatedAt: "2026-04-20T14:30:00Z",
		existingReply: null,
		...overrides,
	};
}

describe("gbpReviewToUpsertInput", () => {
	it("returns a row shaped for the reviews table", () => {
		const row = gbpReviewToUpsertInput({
			review: makeReview(),
			establishmentId: "est_123",
			establishmentLanguageCode: "fr",
		});
		expect(row).not.toBeNull();
		if (!row) throw new Error("unreachable");
		expect(row).toMatchObject({
			establishmentId: "est_123",
			platform: "google",
			platformReviewId: "rev-42",
			authorName: "Alice Martin",
			authorAvatarUrl: "https://example.com/alice.png",
			rating: 5,
			content: "Super accueil !",
			languageCode: "fr",
			status: "new",
		});
		expect(row.publishedAt).toEqual(new Date("2026-04-20T14:30:00Z"));
	});

	it("marks the row as `responded` when Google already has a reply", () => {
		const row = gbpReviewToUpsertInput({
			review: makeReview({
				existingReply: {
					content: "Merci !",
					updatedAt: "2026-04-21T09:00:00Z",
				},
			}),
			establishmentId: "est_1",
			establishmentLanguageCode: "fr",
		});
		expect(row?.status).toBe("responded");
	});

	it("skips the review entirely when Google returns a null rating", () => {
		const row = gbpReviewToUpsertInput({
			review: makeReview({ rating: null }),
			establishmentId: "est_1",
			establishmentLanguageCode: "fr",
		});
		expect(row).toBeNull();
	});

	it("preserves empty content (rating-only reviews with stars but no text)", () => {
		const row = gbpReviewToUpsertInput({
			review: makeReview({ content: "" }),
			establishmentId: "est_1",
			establishmentLanguageCode: "fr",
		});
		expect(row?.content).toBe("");
	});

	it("propagates the establishment's languageCode rather than inferring", () => {
		const row = gbpReviewToUpsertInput({
			review: makeReview(),
			establishmentId: "est_1",
			establishmentLanguageCode: "en",
		});
		expect(row?.languageCode).toBe("en");
	});

	it("stashes the full raw GBP review in rawPayload", () => {
		const review = makeReview({ reviewId: "raw-1" });
		const row = gbpReviewToUpsertInput({
			review,
			establishmentId: "est_1",
			establishmentLanguageCode: "fr",
		});
		expect(row?.rawPayload).toEqual(review);
	});

	it("null avatar stays null", () => {
		const row = gbpReviewToUpsertInput({
			review: makeReview({ authorAvatarUrl: null }),
			establishmentId: "est_1",
			establishmentLanguageCode: "fr",
		});
		expect(row?.authorAvatarUrl).toBeNull();
	});
});
