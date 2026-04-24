import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "#/components/ui/card";

type Props = {
	readonly label: string;
	readonly value: string;
	/** Unité affichée en suffixe serif (ex. « ★ » ou « % »). */
	readonly unit?: string;
	/** Texte du delta (ex. « +0,2 », « −18 min »). */
	readonly delta: string;
	/** Direction de la tendance — détermine l'icône et la couleur. */
	readonly deltaDirection: "up" | "down";
	/**
	 * `true` = carte visuellement distinguée (fond bg-deep + chiffre accent-ink).
	 * Utilisé pour le KPI principal (note moyenne) — premier des quatre.
	 */
	readonly accent?: boolean;
};

/**
 * Une mesure clé en chiffre serif géant + delta vs période précédente.
 * L'arrondi du delta (up / down) ne pré-suppose pas la « bonne » direction :
 * le caller décide. Ex. « temps médian −18 min » est une bonne nouvelle et
 * se rend en vert malgré la flèche descendante — on passe `deltaDirection="up"`
 * pour dire « c'est positif » même si visuellement la valeur baisse.
 */
export function KpiCard({
	label,
	value,
	unit,
	delta,
	deltaDirection,
	accent = false,
}: Props) {
	const DeltaIcon: LucideIcon =
		deltaDirection === "up" ? TrendingUp : TrendingDown;
	return (
		<Card padding={18} className={accent ? "bg-bg-deep" : undefined}>
			<div className="font-mono text-[11.5px] text-ink-mute uppercase tracking-[0.04em]">
				{label}
			</div>
			<div className="mt-2.5 flex items-baseline gap-1.5">
				<div
					className={[
						"font-serif leading-[1]",
						accent ? "text-accent-ink" : "text-ink",
					].join(" ")}
					style={{ fontSize: 40 }}
				>
					{value}
				</div>
				{unit ? (
					<span
						className={[
							"font-serif",
							accent ? "text-accent" : "text-ink-mute",
						].join(" ")}
						style={{ fontSize: 22 }}
					>
						{unit}
					</span>
				) : null}
			</div>
			<div
				className="mt-2.5 inline-flex items-center gap-1 text-[11.5px]"
				style={{
					color:
						deltaDirection === "up"
							? "oklch(0.48 0.1 150)"
							: "oklch(0.55 0.14 25)",
				}}
			>
				<DeltaIcon size={13} strokeWidth={1.75} />
				{delta}
			</div>
		</Card>
	);
}
