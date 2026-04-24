export type Platform = "google" | "tripadvisor" | "trustpilot" | "thefork";

type Props = {
	readonly platform: Platform;
	readonly size?: number;
};

export const PLATFORM_LABELS: Record<Platform, string> = {
	google: "Google",
	tripadvisor: "TripAdvisor",
	trustpilot: "Trustpilot",
	thefork: "TheFork",
};

/**
 * Monogrammes stylisés pour les 4 plateformes du MVP. Pas les vraies
 * icônes officielles — on s'appuie sur des marques visuelles qui
 * évoquent la plateforme sans enfreindre les brand guidelines Google
 * Business / Trustpilot (cf. leur CGU d'usage du logo). Quand on sera
 * certifiés partners, on pourra basculer sur les SVG officiels.
 */
export function PlatformIcon({ platform, size = 16 }: Props) {
	const common = {
		width: size,
		height: size,
		viewBox: "0 0 20 20",
	} as const;

	if (platform === "google") {
		return (
			<svg {...common} aria-label={PLATFORM_LABELS.google}>
				<title>{PLATFORM_LABELS.google}</title>
				<circle
					cx="10"
					cy="10"
					r="8"
					fill="oklch(0.98 0.01 80)"
					stroke="oklch(0.85 0.02 80)"
					strokeWidth="1"
				/>
				<text
					x="10"
					y="14"
					textAnchor="middle"
					fontFamily="Instrument Serif, serif"
					fontSize="12"
					fill="oklch(0.4 0.1 60)"
				>
					G
				</text>
			</svg>
		);
	}

	if (platform === "tripadvisor") {
		return (
			<svg {...common} aria-label={PLATFORM_LABELS.tripadvisor}>
				<title>{PLATFORM_LABELS.tripadvisor}</title>
				<circle
					cx="10"
					cy="10"
					r="8"
					fill="oklch(0.94 0.05 145)"
					stroke="oklch(0.75 0.08 145)"
					strokeWidth="1"
				/>
				<circle
					cx="7"
					cy="10"
					r="2"
					fill="none"
					stroke="oklch(0.4 0.09 145)"
					strokeWidth="1.2"
				/>
				<circle
					cx="13"
					cy="10"
					r="2"
					fill="none"
					stroke="oklch(0.4 0.09 145)"
					strokeWidth="1.2"
				/>
			</svg>
		);
	}

	if (platform === "trustpilot") {
		return (
			<svg {...common} aria-label={PLATFORM_LABELS.trustpilot}>
				<title>{PLATFORM_LABELS.trustpilot}</title>
				<rect
					x="2"
					y="2"
					width="16"
					height="16"
					rx="3"
					fill="oklch(0.96 0.05 145)"
					stroke="oklch(0.78 0.08 145)"
					strokeWidth="1"
				/>
				<path
					d="m10 5 1.8 3.6 4 .6-2.9 2.8.7 4L10 14l-3.6 2 .7-4L4.2 9.2l4-.6L10 5Z"
					fill="oklch(0.55 0.14 145)"
				/>
			</svg>
		);
	}

	// TheFork — fourchette stylisée sur fond chaleureux (réservé au secteur
	// restauration — on ne le montre que sur les établissements de type
	// restaurant/bar/café).
	return (
		<svg {...common} aria-label={PLATFORM_LABELS.thefork}>
			<title>{PLATFORM_LABELS.thefork}</title>
			<circle
				cx="10"
				cy="10"
				r="8"
				fill="oklch(0.95 0.04 30)"
				stroke="oklch(0.78 0.08 30)"
				strokeWidth="1"
			/>
			<path
				d="M7 5v5a3 3 0 0 0 6 0V5M10 13v3"
				stroke="oklch(0.5 0.1 30)"
				strokeWidth="1.3"
				strokeLinecap="round"
				fill="none"
			/>
		</svg>
	);
}
