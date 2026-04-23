import Anthropic, { APIError, RateLimitError } from "@anthropic-ai/sdk";
import { env } from "#/lib/env";
import type { AIError } from "#/lib/errors";
import { unknownToMessage } from "#/lib/errors";
import { err, fromPromise, ok, type Result } from "#/lib/result";

/**
 * Claude model pinned here so prompt-engineering regressions can be
 * correlated with model changes. Bump deliberately + re-run the evals.
 */
export const CLAUDE_MODEL = "claude-sonnet-4-5";

/** Version stamp for the prompt template; persisted on each generation. */
export const PROMPT_VERSION = "reviews-reply-v1";

export type GenerateMessageParams = {
	readonly systemPrompt: string;
	readonly userPrompt: string;
	readonly maxTokens?: number;
	readonly temperature?: number;
};

export type GenerateMessageResult = {
	readonly text: string;
	readonly model: string;
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly stopReason: string | null;
};

const defaultClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

/**
 * Single call to Claude's Messages API, wrapped to return a Result with the
 * AIError discrimination our service layer matches on. No retries, no
 * streaming — caller decides (the response-generation server fn runs at
 * user-request time, it's fine to surface transient failures directly).
 */
export async function generateMessage(
	params: GenerateMessageParams,
	deps: { client?: Anthropic } = {},
): Promise<Result<GenerateMessageResult, AIError>> {
	const client = deps.client ?? defaultClient;

	const call = await fromPromise(
		client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: params.maxTokens ?? 1024,
			temperature: params.temperature ?? 1.0,
			system: params.systemPrompt,
			messages: [{ role: "user", content: params.userPrompt }],
		}),
		mapAnthropicError,
	);
	if (call.isErr()) return err(call.error);

	const message = call.value;

	// `refusal` is Claude's explicit safety signal — the model decided not
	// to respond. Not a network or API error; the caller may want to escalate
	// to a human rather than retry with the same prompt.
	if (message.stop_reason === "refusal") {
		return err({
			kind: "ai_safety_block",
			reason: "Model refused to respond (stop_reason=refusal)",
		});
	}

	// Messages API returns a discriminated array of content blocks (text,
	// thinking, tool_use, etc.). For our reply-generation prompt we only
	// expect text blocks — narrow on kind and accumulate (there's usually
	// one, but a refusal + explanation can produce two).
	const textParts: string[] = [];
	for (const block of message.content) {
		if (block.type === "text" && block.text.length > 0) {
			textParts.push(block.text);
		}
	}
	if (textParts.length === 0) return err({ kind: "ai_empty_response" });

	return ok({
		text: textParts.join("\n\n").trim(),
		model: message.model,
		inputTokens: message.usage.input_tokens,
		outputTokens: message.usage.output_tokens,
		stopReason: message.stop_reason,
	});
}

/**
 * Message fragment Anthropic ships in the 400 body when the workspace has
 * no credits left. Matching on it lets us surface a targeted UX ("top up
 * your console") instead of the generic "unexpected API error".
 */
const NO_CREDITS_MARKER = "credit balance is too low";

function mapAnthropicError(e: unknown): AIError {
	if (e instanceof RateLimitError) {
		return { kind: "ai_rate_limited", retryAfterMs: 60_000 };
	}
	if (e instanceof APIError) {
		if (e.status === 400 && e.message.includes(NO_CREDITS_MARKER)) {
			return { kind: "ai_no_credits" };
		}
		return {
			kind: "ai_api_error",
			status: e.status ?? 0,
			message: e.message,
		};
	}
	return { kind: "ai_network", message: unknownToMessage(e) };
}
