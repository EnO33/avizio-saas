import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logger } from "#/lib/logger";
import {
	createResponseDraft,
	type ResponseSummary,
} from "#/server/db/queries/responses";
import { getReviewWithEstablishmentForOrg } from "#/server/db/queries/reviews";
import { generateResponseDraft } from "#/server/services/ai-response";

export type GenerateResponseDraftUiResult =
	| { readonly kind: "ok"; readonly response: ResponseSummary }
	| { readonly kind: "unauthenticated" }
	| { readonly kind: "review_not_found" }
	| { readonly kind: "ai_rate_limited" }
	| { readonly kind: "ai_safety_block" }
	| { readonly kind: "ai_error" }
	| { readonly kind: "db_error" };

const generateInputSchema = z.object({
	reviewId: z.string().min(1),
	tone: z.enum(["warm", "professional", "direct"]).optional(),
});

/**
 * Generate an AI response draft for the given review and persist it with
 * status='draft'. The user then edits / approves / discards via the review
 * detail page (next PR). `tone` is optional — defaults to the
 * establishment's `defaultTone` so a one-click "Generate" produces the
 * house voice without the user having to pick every time.
 */
export const generateResponseDraftFn = createServerFn({ method: "POST" })
	.inputValidator(generateInputSchema)
	.handler(async ({ data }): Promise<GenerateResponseDraftUiResult> => {
		const session = await auth();
		if (!session.isAuthenticated || !session.orgId) {
			return { kind: "unauthenticated" };
		}

		const reviewResult = await getReviewWithEstablishmentForOrg({
			reviewId: data.reviewId,
			organizationId: session.orgId,
		});
		if (reviewResult.isErr()) {
			if (reviewResult.error.kind === "db_not_found") {
				return { kind: "review_not_found" };
			}
			logger.error(
				{
					event: "ai_draft_fetch_review_failed",
					kind: reviewResult.error.kind,
					reviewId: data.reviewId,
				},
				"Failed to fetch review for AI draft generation",
			);
			return { kind: "db_error" };
		}
		const { review, establishment } = reviewResult.value;

		const tone = data.tone ?? establishment.defaultTone;

		const draftResult = await generateResponseDraft({
			establishment,
			review,
			tone,
		});
		if (draftResult.isErr()) {
			const e = draftResult.error;
			if (e.kind === "ai_rate_limited") return { kind: "ai_rate_limited" };
			if (e.kind === "ai_safety_block") return { kind: "ai_safety_block" };
			logger.error(
				{
					event: "ai_draft_generate_failed",
					// Include the per-kind detail so the log tells us whether it's
					// an API 401/400 (status + message), an empty response, or a
					// network blip. Without this the operator has to guess.
					...(e.kind === "ai_api_error"
						? { kind: e.kind, status: e.status, message: e.message }
						: e.kind === "ai_network"
							? { kind: e.kind, message: e.message }
							: { kind: e.kind }),
					reviewId: data.reviewId,
				},
				"AI draft generation failed",
			);
			return { kind: "ai_error" };
		}
		const draft = draftResult.value;

		const createResult = await createResponseDraft({
			reviewId: review.id,
			content: draft.text,
			aiGenerated: true,
			tone: draft.tone,
			modelId: draft.model,
			promptVersion: draft.promptVersion,
		});
		if (createResult.isErr()) {
			logger.error(
				{
					event: "ai_draft_persist_failed",
					kind: createResult.error.kind,
					reviewId: data.reviewId,
				},
				"Failed to persist AI draft",
			);
			return { kind: "db_error" };
		}

		logger.info(
			{
				event: "ai_draft_generated",
				reviewId: review.id,
				responseId: createResult.value.id,
				tone: draft.tone,
				inputTokens: draft.usage.inputTokens,
				outputTokens: draft.usage.outputTokens,
			},
			"AI draft generated and persisted",
		);

		return { kind: "ok", response: createResult.value };
	});
