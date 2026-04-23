import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logger } from "#/lib/logger";
import {
	approveResponse,
	createResponseDraft,
	listResponsesForReview,
	type ResponseSummary,
	updateResponseContent,
} from "#/server/db/queries/responses";
import {
	getReviewWithEstablishmentForOrg,
	type ReviewWithEstablishment,
} from "#/server/db/queries/reviews";
import { generateResponseDraft } from "#/server/services/ai-response";

export type GenerateResponseDraftUiResult =
	| { readonly kind: "ok"; readonly response: ResponseSummary }
	| { readonly kind: "unauthenticated" }
	| { readonly kind: "review_not_found" }
	| { readonly kind: "ai_rate_limited" }
	| { readonly kind: "ai_safety_block" }
	| { readonly kind: "ai_no_credits" }
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
			if (e.kind === "ai_no_credits") return { kind: "ai_no_credits" };
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

// ── Detail loader ──────────────────────────────────────────────────────────

export type ReviewDetail = {
	readonly review: ReviewWithEstablishment["review"];
	readonly establishment: ReviewWithEstablishment["establishment"];
	readonly responses: readonly ResponseSummary[];
};

/**
 * Bundle everything the detail page needs in a single server round-trip.
 * Returns null when the review is unknown or belongs to another org so the
 * route renders a friendly "introuvable" block.
 */
export const getReviewDetail = createServerFn()
	.inputValidator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data }): Promise<ReviewDetail | null> => {
		const session = await auth();
		if (!session.isAuthenticated || !session.orgId) return null;

		const reviewResult = await getReviewWithEstablishmentForOrg({
			reviewId: data.id,
			organizationId: session.orgId,
		});
		if (reviewResult.isErr()) {
			if (reviewResult.error.kind !== "db_not_found") {
				logger.error(
					{
						event: "review_detail_fetch_failed",
						kind: reviewResult.error.kind,
						id: data.id,
					},
					"Failed to load review for detail page",
				);
			}
			return null;
		}

		const responsesResult = await listResponsesForReview({
			reviewId: data.id,
			organizationId: session.orgId,
		});
		// A response-read failure is not fatal — we can still show the review
		// with no drafts. Log and fall through with an empty list.
		const responseRows = responsesResult.isOk() ? responsesResult.value : [];
		if (responsesResult.isErr()) {
			logger.error(
				{
					event: "review_responses_fetch_failed",
					kind: responsesResult.error.kind,
					id: data.id,
				},
				"Failed to load responses — rendering detail with empty list",
			);
		}

		return {
			review: reviewResult.value.review,
			establishment: reviewResult.value.establishment,
			responses: responseRows,
		};
	});

// ── Edit draft ──────────────────────────────────────────────────────────────

export type UpdateResponseUiResult =
	| { readonly kind: "ok"; readonly response: ResponseSummary }
	| { readonly kind: "unauthenticated" }
	| { readonly kind: "not_found" }
	| { readonly kind: "error" };

export const updateResponseContentFn = createServerFn({ method: "POST" })
	.inputValidator(
		z.object({
			id: z.string().min(1),
			content: z.string().trim().min(1).max(5000),
		}),
	)
	.handler(async ({ data }): Promise<UpdateResponseUiResult> => {
		const session = await auth();
		if (!session.isAuthenticated || !session.orgId) {
			return { kind: "unauthenticated" };
		}

		const result = await updateResponseContent({
			id: data.id,
			organizationId: session.orgId,
			content: data.content,
		});
		if (result.isErr()) {
			if (result.error.kind === "db_not_found") return { kind: "not_found" };
			logger.error(
				{
					event: "response_update_failed",
					kind: result.error.kind,
					id: data.id,
				},
				"Failed to update response content",
			);
			return { kind: "error" };
		}
		return { kind: "ok", response: result.value };
	});

// ── Approve draft ──────────────────────────────────────────────────────────

export const approveResponseFn = createServerFn({ method: "POST" })
	.inputValidator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data }): Promise<UpdateResponseUiResult> => {
		const session = await auth();
		if (!session.isAuthenticated || !session.orgId) {
			return { kind: "unauthenticated" };
		}

		const result = await approveResponse({
			id: data.id,
			organizationId: session.orgId,
		});
		if (result.isErr()) {
			if (result.error.kind === "db_not_found") return { kind: "not_found" };
			logger.error(
				{
					event: "response_approve_failed",
					kind: result.error.kind,
					id: data.id,
				},
				"Failed to approve response",
			);
			return { kind: "error" };
		}

		logger.info(
			{
				event: "response_approved",
				responseId: data.id,
				orgId: session.orgId,
			},
			"Response approved",
		);
		return { kind: "ok", response: result.value };
	});
