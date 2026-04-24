import { Star } from "lucide-react";

type Props = {
	/** Valeur 1..5. Les valeurs hors bornes sont clamp automatiquement. */
	readonly value: number;
	/** Taille en px de chaque étoile. Défaut 12 — dense (liste). */
	readonly size?: number;
};

/**
 * Étoiles 1..5 plain-view pour ratings. Les plateformes qu'on supporte
 * (Google, TripAdvisor, Trustpilot) renvoient toutes des ratings entiers
 * ou demi-étoiles arrondies, donc on ne gère que les entiers. L'étoile
 * remplie utilise le gold de la palette ; les vides restent discrètes
 * (line-soft) pour ne pas tirer l'œil.
 */
export function Stars({ value, size = 12 }: Props) {
	const clamped = Math.max(0, Math.min(5, Math.round(value)));
	return (
		<div
			role="img"
			aria-label={`${clamped} étoiles sur 5`}
			className="inline-flex items-center gap-[1.5px]"
		>
			{[1, 2, 3, 4, 5].map((n) => (
				<Star
					key={n}
					width={size}
					height={size}
					aria-hidden="true"
					style={{
						color:
							n <= clamped ? "oklch(0.78 0.12 85)" : "oklch(0.88 0.015 80)",
						fill: n <= clamped ? "oklch(0.78 0.12 85)" : "transparent",
					}}
					strokeWidth={1.5}
				/>
			))}
		</div>
	);
}
