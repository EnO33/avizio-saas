import { Sparkles } from "lucide-react";
import type { ReviewSummary } from "#/server/db/queries/reviews";

type Props = {
	readonly review: ReviewSummary;
};

/**
 * Panneau « Analyse IA » — stubbé tant que le wrapper Claude ne
 * renvoie pas d'analyse structurée (sentiment, keywords, urgence).
 * Pour l'instant on dérive tout de ce qu'on a localement : le rating
 * détermine le sentiment + le ton recommandé, le flag urgence tombe
 * aussi du rating. Ça reste instructif pour l'utilisateur même en
 * mode statique — et quand on branchera une analyse côté serveur, on
 * swap la dérivation sans changer le rendu.
 */
export function ResponseAnalysis({ review }: Props) {
	const sentiment =
		review.rating >= 4
			? "Positif · enthousiaste"
			: review.rating === 3
				? "Mitigé"
				: "Négatif · explicite";
	const recommendedTone =
		review.rating >= 4 ? "Chaleureux" : "Professionnel apaisant";
	const urgency = review.rating <= 2 ? "Haute · répondre < 24h" : "Normale";
	// Stub — les mots-clés viendront d'un tagging côté serveur. Pour
	// l'instant on propose des placeholders plausibles selon le sentiment.
	const mentioned =
		review.rating >= 4 ? "service, chef, accueil" : "retard, plat, prix";

	const items: ReadonlyArray<{ key: string; value: string }> = [
		{ key: "Sentiment", value: sentiment },
		{ key: "Points mentionnés", value: mentioned },
		{ key: "Urgence", value: urgency },
		{ key: "Ton recommandé", value: recommendedTone },
	];

	return (
		<div className="mt-5">
			<div className="mb-2.5 flex items-center gap-1.5 font-mono text-[11px] text-ink-mute uppercase tracking-[0.06em]">
				<Sparkles size={12} strokeWidth={1.75} />
				Analyse IA
			</div>
			<div className="grid gap-2.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
				{items.map((item) => (
					<div
						key={item.key}
						className="rounded-md border border-line-soft bg-paper px-3 py-2.5"
					>
						<div className="text-[10.5px] text-ink-mute">{item.key}</div>
						<div className="mt-0.5 font-medium text-[12.5px]">{item.value}</div>
					</div>
				))}
			</div>
		</div>
	);
}
