import type { LucideIcon } from "lucide-react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "#/components/ui/card";

export type KpiDelta = {
	/** Texte tel qu'affiché (ex. « +0,2 », « −18 min »). */
	readonly label: string;
	/** Direction qualitative — détermine l'icône et la couleur. */
	readonly direction: "up" | "down";
};

type Props = {
	readonly label: string;
	/** Valeur principale. Passer « — » explicitement pour un état vide. */
	readonly value: string;
	/** Unité affichée en suffixe serif (ex. « ★ » ou « % »). */
	readonly unit?: string | undefined;
	/**
	 * Delta vs période précédente. `null` → ligne remplacée par un tiret
	 * neutre, cas d'un mois précédent sans donnée où le delta n'a pas de
	 * sens (éviter d'afficher « +4 » quand on passe de 0 à 4).
	 */
	readonly delta: KpiDelta | null;
	/**
	 * `true` = carte visuellement distinguée (fond bg-deep + chiffre accent-ink).
	 * Utilisé pour le KPI principal (note moyenne) — premier des quatre.
	 */
	readonly accent?: boolean | undefined;
};

/**
 * Une mesure clé en chiffre serif géant + delta vs période précédente.
 * L'arrondi du delta (up / down) ne pré-suppose pas la « bonne » direction :
 * le caller décide. Ex. « temps médian −18 min » est une bonne nouvelle et
 * se rend en vert malgré la valeur en baisse — le caller passe
 * `direction: "up"` pour dire « c'est positif ».
 */
export function KpiCard({ label, value, unit, delta, accent = false }: Props) {
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
			<DeltaRow delta={delta} />
		</Card>
	);
}

function DeltaRow({ delta }: { delta: KpiDelta | null }) {
	if (delta == null) {
		return (
			<div className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] text-ink-mute">
				<Minus size={13} strokeWidth={1.75} />
				Pas de comparaison
			</div>
		);
	}
	const Icon: LucideIcon = delta.direction === "up" ? TrendingUp : TrendingDown;
	return (
		<div
			className="mt-2.5 inline-flex items-center gap-1 text-[11.5px]"
			style={{
				color:
					delta.direction === "up"
						? "oklch(0.48 0.1 150)"
						: "oklch(0.55 0.14 25)",
			}}
		>
			<Icon size={13} strokeWidth={1.75} />
			{delta.label}
		</div>
	);
}
