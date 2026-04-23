import { APIError, RateLimitError } from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { generateMessage } from "./anthropic";

// cast-reason: tests pass a minimal stub shaped like the SDK's client. The
// real Anthropic type is huge and we don't want to reconstruct it.
type FakeClient = {
	messages: {
		create: ReturnType<typeof vi.fn>;
	};
};

function makeClient(
	behavior:
		| "success"
		| "rate_limit"
		| "api_error"
		| "network"
		| "empty"
		| "refusal"
		| "thinking_then_text",
): FakeClient {
	const create = vi.fn();
	switch (behavior) {
		case "success":
			create.mockResolvedValue({
				model: "claude-sonnet-4-5",
				stop_reason: "end_turn",
				content: [{ type: "text", text: "Merci pour votre retour !" }],
				usage: { input_tokens: 120, output_tokens: 45 },
			});
			break;
		case "rate_limit":
			create.mockRejectedValue(
				new RateLimitError(
					429,
					{ error: { message: "rate limited" } },
					"rate limited",
					new Headers(),
				),
			);
			break;
		case "api_error":
			create.mockRejectedValue(
				new APIError(
					500,
					{ error: { message: "server down" } },
					"server down",
					new Headers(),
				),
			);
			break;
		case "network":
			create.mockRejectedValue(new Error("ENETDOWN"));
			break;
		case "empty":
			create.mockResolvedValue({
				model: "claude-sonnet-4-5",
				stop_reason: "end_turn",
				content: [{ type: "text", text: "" }],
				usage: { input_tokens: 10, output_tokens: 0 },
			});
			break;
		case "refusal":
			create.mockResolvedValue({
				model: "claude-sonnet-4-5",
				stop_reason: "refusal",
				content: [{ type: "text", text: "I can't help with that." }],
				usage: { input_tokens: 30, output_tokens: 10 },
			});
			break;
		case "thinking_then_text":
			create.mockResolvedValue({
				model: "claude-sonnet-4-5",
				stop_reason: "end_turn",
				content: [
					{ type: "thinking", thinking: "thinking..." },
					{ type: "text", text: "Partie 1" },
					{ type: "text", text: "Partie 2" },
				],
				usage: { input_tokens: 50, output_tokens: 20 },
			});
			break;
	}
	return { messages: { create } };
}

// biome-ignore lint/suspicious/noExplicitAny: test stub matches runtime shape
const asClient = (c: FakeClient) => c as any;

describe("generateMessage — success paths", () => {
	it("passes model, system, user prompt and defaults through to the SDK", async () => {
		const client = makeClient("success");
		const result = await generateMessage(
			{ systemPrompt: "be helpful", userPrompt: "hello" },
			{ client: asClient(client) },
		);

		expect(result.isOk()).toBe(true);
		expect(client.messages.create).toHaveBeenCalledOnce();
		const call = client.messages.create.mock.calls[0]?.[0];
		expect(call.model).toBe("claude-sonnet-4-5");
		expect(call.max_tokens).toBe(1024);
		expect(call.system).toBe("be helpful");
		expect(call.messages).toEqual([{ role: "user", content: "hello" }]);
	});

	it("returns text + usage + stop reason from the message", async () => {
		const client = makeClient("success");
		const result = await generateMessage(
			{ systemPrompt: "s", userPrompt: "u" },
			{ client: asClient(client) },
		);
		expect(result.isOk()).toBe(true);
		if (result.isErr()) throw new Error("unreachable");
		expect(result.value.text).toBe("Merci pour votre retour !");
		expect(result.value.inputTokens).toBe(120);
		expect(result.value.outputTokens).toBe(45);
		expect(result.value.stopReason).toBe("end_turn");
	});

	it("concatenates multiple text blocks and skips thinking blocks", async () => {
		const client = makeClient("thinking_then_text");
		const result = await generateMessage(
			{ systemPrompt: "s", userPrompt: "u" },
			{ client: asClient(client) },
		);
		expect(result.isOk()).toBe(true);
		if (result.isErr()) throw new Error("unreachable");
		expect(result.value.text).toBe("Partie 1\n\nPartie 2");
	});
});

describe("generateMessage — error paths", () => {
	it("maps RateLimitError to ai_rate_limited", async () => {
		const result = await generateMessage(
			{ systemPrompt: "s", userPrompt: "u" },
			{ client: asClient(makeClient("rate_limit")) },
		);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("ai_rate_limited");
	});

	it("maps a generic APIError to ai_api_error with status", async () => {
		const result = await generateMessage(
			{ systemPrompt: "s", userPrompt: "u" },
			{ client: asClient(makeClient("api_error")) },
		);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("ai_api_error");
		if (result.error.kind !== "ai_api_error") throw new Error("unreachable");
		expect(result.error.status).toBe(500);
	});

	it("maps an arbitrary throw to ai_network", async () => {
		const result = await generateMessage(
			{ systemPrompt: "s", userPrompt: "u" },
			{ client: asClient(makeClient("network")) },
		);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("ai_network");
	});

	it("returns ai_empty_response when the only text block is empty", async () => {
		const result = await generateMessage(
			{ systemPrompt: "s", userPrompt: "u" },
			{ client: asClient(makeClient("empty")) },
		);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("ai_empty_response");
	});

	it("returns ai_safety_block when stop_reason is refusal", async () => {
		const result = await generateMessage(
			{ systemPrompt: "s", userPrompt: "u" },
			{ client: asClient(makeClient("refusal")) },
		);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("ai_safety_block");
	});
});
