import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import type { Tone } from "#/server/db/queries/establishments";
import {
	type GenerateResponseDraftUiResult,
	generateResponseDraftFn,
} from "#/server/fns/responses";

type Props = {
	readonly reviewId: string;
	readonly defaultTone: Tone;
};

const TONE_OPTIONS: ReadonlyArray<{
	readonly value: Tone;
	readonly label: string;
}> = [
	{ value: "warm", label: "Chaleureux" },
	{ value: "professional", label: "Professionnel" },
	{ value: "direct", label: "Direct" },
];

/**
 * Triggers an AI draft generation for the current review. Tone defaults to
 * the establishment's default — the user can override for this one
 * generation via the select. On success, invalidates the route loader so
 * the new draft shows up in the list below.
 */
export function GenerateDraftButton({ reviewId, defaultTone }: Props) {
	const router = useRouter();
	const [tone, setTone] = useState<Tone>(defaultTone);
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const onClick = async () => {
		setError(null);
		setIsPending(true);
		const result: GenerateResponseDraftUiResult = await generateResponseDraftFn(
			{
				data: { reviewId, tone },
			},
		);
		setIsPending(false);

		if (result.kind === "ok") {
			await router.invalidate();
			return;
		}

		const message = resultToMessage(result);
		setError(message);
	};

	return (
		<div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-4">
			<div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
				<label className="flex items-center gap-2 text-neutral-700 text-sm">
					Ton :
					<select
						value={tone}
						onChange={(e) => setTone(e.target.value as Tone)}
						disabled={isPending}
						className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm"
					>
						{TONE_OPTIONS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</label>
				<button
					type="button"
					onClick={onClick}
					disabled={isPending}
					className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isPending ? "Génération en cours…" : "Générer un brouillon"}
				</button>
			</div>
			{error ? (
				<p className="rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm">
					{error}
				</p>
			) : null}
		</div>
	);
}

function resultToMessage(result: GenerateResponseDraftUiResult): string {
	switch (result.kind) {
		case "unauthenticated":
			return "Ta session a expiré. Reconnecte-toi.";
		case "review_not_found":
			return "Cet avis n'existe plus. Retourne à la liste.";
		case "ai_rate_limited":
			return "Anthropic a limité la cadence. Réessaie dans une minute.";
		case "ai_safety_block":
			return "L'IA a refusé de répondre à cet avis. Rédige la réponse à la main ou contacte le support.";
		case "ai_no_credits":
			return "Crédit Anthropic épuisé. Recharge ton compte sur console.anthropic.com/settings/billing puis réessaie.";
		case "ai_error":
			return "Erreur inattendue côté IA. Réessaie dans un instant.";
		case "db_error":
			return "Impossible d'enregistrer le brouillon. Réessaie.";
		default:
			return "Erreur inattendue.";
	}
}
