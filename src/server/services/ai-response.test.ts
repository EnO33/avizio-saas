import { describe, expect, it, vi } from "vitest";
import { err, ok } from "#/lib/result";
import type { BusinessType, Tone } from "#/server/db/queries/establishments";
import type {
	GenerateMessageResult,
	generateMessage,
} from "#/server/integrations/anthropic";
import {
	type BuildPromptInput,
	buildSystemPrompt,
	buildUserPrompt,
	generateResponseDraft,
} from "./ai-response";

type GenerateFn = typeof generateMessage;

function makeInput(
	overrides: {
		establishment?: Partial<BuildPromptInput["establishment"]>;
		review?: Partial<BuildPromptInput["review"]>;
		tone?: Tone;
	} = {},
): BuildPromptInput {
	return {
		establishment: {
			name: "Le Gourmet",
			city: "Lyon",
			businessType: "restaurant" as BusinessType,
			brandContext: null,
			...overrides.establishment,
		},
		review: {
			authorName: "Alice Martin",
			rating: 5,
			content: "Excellent accueil et cuisine raffinée !",
			...overrides.review,
		},
		tone: overrides.tone ?? "warm",
	};
}

describe("buildSystemPrompt", () => {
	it("is deterministic — identical calls return the same string", () => {
		expect(buildSystemPrompt()).toBe(buildSystemPrompt());
	});

	it("spells out the hard rules the model must follow", () => {
		const p = buildSystemPrompt();
		// Core guardrails — if any of these get accidentally deleted, our
		// prompt-engineering evals drop and regressions sneak through.
		expect(p).toMatch(/en français/);
		expect(p).toMatch(/2 à 4 phrases/);
		expect(p).toMatch(/inventer/i);
		expect(p).toMatch(/JAMAIS/);
		expect(p).toMatch(/préambule/i);
	});
});

describe("buildUserPrompt", () => {
	it("names the establishment with its French business-type label", () => {
		const p = buildUserPrompt(
			makeInput({ establishment: { businessType: "bakery" as BusinessType } }),
		);
		expect(p).toContain("Le Gourmet (boulangerie) à Lyon");
	});

	it("maps every business type to a French label", () => {
		const mappings: Record<BusinessType, string> = {
			restaurant: "restaurant",
			hotel: "hôtel",
			cafe: "café",
			bar: "bar",
			bakery: "boulangerie",
			artisan: "artisan",
			retail: "commerce",
			other: "établissement",
		};
		for (const [type, label] of Object.entries(mappings)) {
			const p = buildUserPrompt(
				makeInput({ establishment: { businessType: type as BusinessType } }),
			);
			expect(p).toContain(`(${label}) à`);
		}
	});

	it("injects brandContext when present", () => {
		const p = buildUserPrompt(
			makeInput({
				establishment: { brandContext: "Produits locaux, ton tutoyant." },
			}),
		);
		expect(p).toContain("Contexte de l'établissement");
		expect(p).toContain("Produits locaux, ton tutoyant.");
	});

	it("omits the brand context section entirely when null", () => {
		const p = buildUserPrompt(
			makeInput({ establishment: { brandContext: null } }),
		);
		expect(p).not.toContain("Contexte de l'établissement");
	});

	it("exposes the review's author, rating and content", () => {
		const p = buildUserPrompt(
			makeInput({
				review: {
					authorName: "John Doe",
					rating: 2,
					content: "Attente trop longue",
				},
			}),
		);
		expect(p).toContain("Auteur : John Doe");
		expect(p).toContain("Note : 2/5");
		expect(p).toContain("Attente trop longue");
	});

	it("substitutes a clear placeholder when the review is rating-only", () => {
		const p = buildUserPrompt(makeInput({ review: { content: "   " } }));
		expect(p).toContain("le client n'a laissé qu'une note sans texte");
	});

	it("switches tone guidance based on the requested tone", () => {
		const warmPrompt = buildUserPrompt(makeInput({ tone: "warm" }));
		const profPrompt = buildUserPrompt(makeInput({ tone: "professional" }));
		const directPrompt = buildUserPrompt(makeInput({ tone: "direct" }));

		expect(warmPrompt).toContain("Ton demandé : chaleureux");
		expect(profPrompt).toContain("Ton demandé : professionnel");
		expect(directPrompt).toContain("Ton demandé : direct");
		expect(warmPrompt).not.toBe(profPrompt);
	});
});

describe("generateResponseDraft", () => {
	it("stamps the draft with the model + prompt version + tone + usage", async () => {
		const fakeGenerate = vi.fn().mockResolvedValue(
			ok({
				text: "Merci Alice pour votre retour !",
				model: "claude-sonnet-4-5",
				inputTokens: 140,
				outputTokens: 30,
				stopReason: "end_turn",
			} satisfies GenerateMessageResult),
		);

		const result = await generateResponseDraft(makeInput(), {
			generate: fakeGenerate as unknown as GenerateFn,
		});

		expect(result.isOk()).toBe(true);
		if (result.isErr()) throw new Error("unreachable");
		expect(result.value).toEqual({
			text: "Merci Alice pour votre retour !",
			model: "claude-sonnet-4-5",
			promptVersion: "reviews-reply-v1",
			tone: "warm",
			usage: { inputTokens: 140, outputTokens: 30 },
		});
	});

	it("forwards system + user prompts to the generator with low temperature + bounded maxTokens", async () => {
		const fakeGenerate = vi.fn().mockResolvedValue(
			ok({
				text: "x",
				model: "m",
				inputTokens: 1,
				outputTokens: 1,
				stopReason: "end_turn",
			}),
		);

		await generateResponseDraft(makeInput(), {
			generate: fakeGenerate as unknown as GenerateFn,
		});

		const call = fakeGenerate.mock.calls[0]?.[0];
		expect(call.systemPrompt).toBe(buildSystemPrompt());
		expect(call.userPrompt).toContain("Le Gourmet");
		expect(call.temperature).toBe(0.6);
		expect(call.maxTokens).toBe(500);
	});

	it("surfaces generator errors unchanged", async () => {
		const fakeGenerate = vi
			.fn()
			.mockResolvedValue(err({ kind: "ai_rate_limited", retryAfterMs: 1000 }));

		const result = await generateResponseDraft(makeInput(), {
			generate: fakeGenerate as unknown as GenerateFn,
		});

		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("ai_rate_limited");
	});
});
