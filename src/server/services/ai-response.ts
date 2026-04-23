import type { AIError } from "#/lib/errors";
import { err, ok, type Result } from "#/lib/result";
import type { BusinessType, Tone } from "#/server/db/queries/establishments";
import {
	generateMessage,
	PROMPT_VERSION,
} from "#/server/integrations/anthropic";

export type BuildPromptInput = {
	readonly establishment: {
		readonly name: string;
		readonly city: string;
		readonly businessType: BusinessType;
		readonly brandContext: string | null;
	};
	readonly review: {
		readonly authorName: string;
		readonly rating: number;
		readonly content: string;
	};
	readonly tone: Tone;
};

const BUSINESS_TYPE_FR: Record<BusinessType, string> = {
	restaurant: "restaurant",
	hotel: "hôtel",
	cafe: "café",
	bar: "bar",
	bakery: "boulangerie",
	artisan: "artisan",
	retail: "commerce",
	other: "établissement",
};

const TONE_GUIDANCE: Record<
	Tone,
	{ readonly label: string; readonly desc: string }
> = {
	warm: {
		label: "chaleureux",
		desc: "accueillant et proche du client, tutoiement possible si la review le suggère, registre convivial",
	},
	professional: {
		label: "professionnel",
		desc: "vouvoiement systématique, registre soigné et posé, distance courtoise",
	},
	direct: {
		label: "direct",
		desc: "concis et factuel, pas de formule de politesse excessive, réponse courte et efficace",
	},
};

/**
 * System prompt shared across every review-reply generation. Lives in code
 * rather than DB so prompt changes are tracked in git + tied to a version
 * string (persisted on each generated draft) and so we can A/B between
 * versions by bumping PROMPT_VERSION.
 */
export function buildSystemPrompt(): string {
	return `Tu es l'assistant d'un propriétaire de commerce de proximité qui répond aux avis clients publiés sur Google Business Profile, TripAdvisor, Trustpilot et plateformes similaires.

Tes réponses doivent :
- être rédigées en français
- faire 2 à 4 phrases, jamais plus
- adresser le feedback spécifique du client sans inventer aucune information
- remercier pour le temps pris à laisser l'avis, positif comme négatif
- ne jamais demander d'information privée publiquement
- pour un avis critique, proposer si pertinent de poursuivre la conversation par email ou téléphone sans donner l'adresse elle-même
- s'adapter au ton demandé par le propriétaire (chaleureux, professionnel ou direct)

Tu ne dois JAMAIS :
- inventer une promotion, un événement, un nom de plat, un changement d'équipe ou toute information non présente dans le contexte fourni
- contester publiquement le fait rapporté par le client (contester peut se faire en privé, pas ici)
- répéter le prénom du client plus d'une fois dans la même réponse
- mentionner un autre établissement, un concurrent, ou faire de la pub
- dépasser 4 phrases

Rédige uniquement le texte de la réponse, sans préambule, sans guillemets autour, sans signature robotisée du type "Cordialement, [Nom]" — utilise plutôt une formule naturelle qui termine la réponse.`;
}

/**
 * Per-review user prompt. The model reads this and returns the final reply
 * text. We include the establishment context first (who's replying), then
 * the tone guidance, then the review — a structure that consistently
 * produces cleaner responses in our evals than interleaving.
 */
export function buildUserPrompt(input: BuildPromptInput): string {
	const businessType = BUSINESS_TYPE_FR[input.establishment.businessType];
	const tone = TONE_GUIDANCE[input.tone];

	const brandContextSection = input.establishment.brandContext
		? `\nContexte de l'établissement :\n${input.establishment.brandContext}\n`
		: "";

	const reviewContent =
		input.review.content.trim().length > 0
			? input.review.content.trim()
			: "(le client n'a laissé qu'une note sans texte)";

	return `Établissement : ${input.establishment.name} (${businessType}) à ${input.establishment.city}${brandContextSection}

Ton demandé : ${tone.label} — ${tone.desc}

Avis à répondre :
- Auteur : ${input.review.authorName}
- Note : ${input.review.rating}/5
- Contenu : """
${reviewContent}
"""

Rédige la réponse maintenant.`;
}

export type GenerateResponseDraftResult = {
	readonly text: string;
	readonly model: string;
	readonly promptVersion: string;
	readonly tone: Tone;
	readonly usage: {
		readonly inputTokens: number;
		readonly outputTokens: number;
	};
};

/**
 * Build the system + user prompts, dispatch to Claude, and shape the result
 * for persistence. Pure-ish orchestration — the Anthropic call itself is
 * injectable via `deps` so tests can stub without mocking modules.
 */
export async function generateResponseDraft(
	input: BuildPromptInput,
	deps: {
		generate?: typeof generateMessage;
	} = {},
): Promise<Result<GenerateResponseDraftResult, AIError>> {
	const generate = deps.generate ?? generateMessage;
	const systemPrompt = buildSystemPrompt();
	const userPrompt = buildUserPrompt(input);

	const result = await generate({
		systemPrompt,
		userPrompt,
		// Lower temperature: we want consistent, businesslike replies rather
		// than creative variation. The tone variable already opens enough
		// stylistic range.
		temperature: 0.6,
		// 500 tokens is plenty for 4 sentences — caps runaway outputs.
		maxTokens: 500,
	});

	if (result.isErr()) return err(result.error);

	return ok({
		text: result.value.text,
		model: result.value.model,
		promptVersion: PROMPT_VERSION,
		tone: input.tone,
		usage: {
			inputTokens: result.value.inputTokens,
			outputTokens: result.value.outputTokens,
		},
	});
}
