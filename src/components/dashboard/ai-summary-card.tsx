import { Sparkles } from "lucide-react";
import { Card } from "#/components/ui/card";

type Props = {
	/** Nombre de brouillons IA générés sur les 7 derniers jours. */
	readonly draftsThisWeek: number;
	/**
	 * Temps économisé estimé (en minutes). Proxy fixe côté serveur :
	 * 3 min × nombre de brouillons — on n'a pas encore de mesure réelle
	 * du temps passé dans l'éditeur. Swappé pour un vrai tracking quand
	 * l'éditeur émettra des events `draft.viewed` / `draft.approved`.
	 */
	readonly timeSavedMinutes: number;
};

/**
 * Encart valorisant l'apport IA sur la semaine. État vide honnête
 * quand aucune génération n'a tourné (évite une copie enthousiaste sur
 * zéro brouillon).
 *
 * Le chiffre « X% approuvés sans retouche » des versions précédentes
 * est retiré tant qu'on ne compare pas le contenu initial au contenu
 * final — ajouter une colonne `initial_content` à `responses` puis
 * remettre la claim le jour où on peut la mesurer.
 */
export function AiSummaryCard({ draftsThisWeek, timeSavedMinutes }: Props) {
	const hasData = draftsThisWeek > 0;
	const hours = Math.floor(timeSavedMinutes / 60);
	const mins = timeSavedMinutes % 60;
	const timeLabel =
		hours > 0
			? `${hours} h ${mins.toString().padStart(2, "0")}`
			: `${mins} min`;

	return (
		<Card padding={20} className="bg-bg-deep">
			<Sparkles size={18} strokeWidth={1.75} className="text-ink-soft" />
			{hasData ? (
				<>
					<div className="mt-2.5 font-serif text-[20px] leading-[1.2]">
						Cette semaine, l'IA a rédigé{" "}
						<span className="text-accent-ink italic">
							{draftsThisWeek} brouillon{draftsThisWeek > 1 ? "s" : ""}
						</span>{" "}
						pour vous.
					</div>
					<div className="mt-2.5 text-[12.5px] text-ink-soft leading-[1.5]">
						Temps économisé estimé : <strong>{timeLabel}</strong>.
					</div>
				</>
			) : (
				<>
					<div className="mt-2.5 font-serif text-[20px] leading-[1.2]">
						Aucun brouillon cette semaine.
					</div>
					<div className="mt-2.5 text-[12.5px] text-ink-soft leading-[1.5]">
						Dès qu'un avis arrive, Avizio rédige une proposition — vous la
						relisez, ajustez, publiez.
					</div>
				</>
			)}
		</Card>
	);
}
