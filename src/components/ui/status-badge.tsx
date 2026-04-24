export type ReviewStatus = "new" | "in_progress" | "responded" | "skipped";

type Props = {
	readonly status: ReviewStatus;
};

const META: Record<ReviewStatus, { label: string; bg: string; fg: string }> = {
	new: {
		label: "Nouveau",
		bg: "oklch(0.94 0.04 50)",
		fg: "oklch(0.38 0.14 40)",
	},
	in_progress: {
		label: "En cours",
		bg: "oklch(0.95 0.04 85)",
		fg: "oklch(0.42 0.1 80)",
	},
	responded: {
		label: "Répondu",
		bg: "oklch(0.94 0.03 150)",
		fg: "oklch(0.38 0.08 150)",
	},
	skipped: {
		label: "Ignoré",
		bg: "oklch(0.94 0.005 70)",
		fg: "oklch(0.5 0.01 70)",
	},
};

/**
 * Pill + dot coloré pour le statut d'un avis. Le point de couleur en
 * tête renforce la lisibilité en liste (œil accroche le point avant
 * le texte). Les quatre couleurs sont prises directement du design
 * system — chacune correspond à une famille sémantique distincte :
 * terracotta (nouveau, l'attention), gold (en cours, warm), green
 * (répondu, done), neutral (ignoré, en retrait).
 */
export function StatusBadge({ status }: Props) {
	const m = META[status];
	return (
		<span
			className="inline-flex items-center gap-[5px] rounded-full font-medium"
			style={{
				background: m.bg,
				color: m.fg,
				padding: "2px 8px",
				fontSize: 11,
			}}
		>
			<span
				className="rounded-full"
				style={{ width: 5, height: 5, background: m.fg }}
			/>
			{m.label}
		</span>
	);
}
