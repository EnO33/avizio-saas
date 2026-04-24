import { Sparkles } from "lucide-react";
import { Card } from "#/components/ui/card";

type Props = {
	/** Nombre de brouillons IA générés sur les 7 derniers jours. */
	readonly draftsThisWeek: number;
	/**
	 * Temps économisé estimé (en minutes). Formule simple : ~3 min par
	 * brouillon approuvé sans retouche, utilisé uniquement pour l'affichage
	 * dashboard — pas de source de vérité côté produit.
	 */
	readonly timeSavedMinutes: number;
	/** Part de brouillons approuvés sans édition (0..1). */
	readonly approvedWithoutEditRate: number;
};

/**
 * Encart valorisant l'apport IA sur la semaine. Les chiffres viennent
 * d'une agrégation simple côté loader — pas d'agrégat DB dédié pour
 * l'instant, on peut stub en attendant que la table `responses` ait
 * assez d'historique pour que le calcul soit significatif.
 */
export function AiSummaryCard({
	draftsThisWeek,
	timeSavedMinutes,
	approvedWithoutEditRate,
}: Props) {
	const hours = Math.floor(timeSavedMinutes / 60);
	const mins = timeSavedMinutes % 60;
	const timeLabel =
		hours > 0
			? `${hours} h ${mins.toString().padStart(2, "0")}`
			: `${mins} min`;
	const approvedPct = Math.round(approvedWithoutEditRate * 100);

	return (
		<Card padding={20} className="bg-bg-deep">
			<Sparkles size={18} strokeWidth={1.75} className="text-ink-soft" />
			<div className="mt-2.5 font-serif text-[20px] leading-[1.2]">
				Cette semaine, l'IA a rédigé{" "}
				<span className="text-accent-ink italic">
					{draftsThisWeek} brouillon{draftsThisWeek > 1 ? "s" : ""}
				</span>{" "}
				pour vous.
			</div>
			<div className="mt-2.5 text-[12.5px] text-ink-soft leading-[1.5]">
				Temps économisé estimé : <strong>{timeLabel}</strong>.
				{draftsThisWeek > 0 ? (
					<>
						{" "}
						Vous en avez approuvé <strong>{approvedPct}%</strong> sans retouche.
					</>
				) : null}
			</div>
		</Card>
	);
}
