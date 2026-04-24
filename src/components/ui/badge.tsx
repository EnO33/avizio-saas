import type { ReactNode } from "react";

export type BadgeTone =
	| "neutral"
	| "accent"
	| "olive"
	| "rose"
	| "gold"
	| "green"
	| "ink";
export type BadgeSize = "sm" | "md";

type Props = {
	readonly children: ReactNode;
	readonly tone?: BadgeTone;
	readonly size?: BadgeSize;
};

/*
  Badges colorés mappés sur la palette OKLCH. Les paires bg/fg sont
  calculées pour le contraste AA avec des fonds cream (98%+ lightness
  pour bg, 38-45% pour fg). Intentionnellement figées en inline plutôt
  que dérivées de tokens Tailwind pour permettre des nuances qui ne
  sont pas dans la palette principale (olive, gold pour « bientôt »).
*/
const TONE_STYLES: Record<BadgeTone, { bg: string; fg: string }> = {
	neutral: { bg: "oklch(0.94 0.005 70)", fg: "oklch(0.4 0.01 70)" },
	accent: { bg: "oklch(0.94 0.04 50)", fg: "oklch(0.38 0.14 40)" },
	olive: { bg: "oklch(0.94 0.03 110)", fg: "oklch(0.38 0.06 110)" },
	rose: { bg: "oklch(0.94 0.04 25)", fg: "oklch(0.45 0.13 25)" },
	gold: { bg: "oklch(0.95 0.04 85)", fg: "oklch(0.42 0.1 80)" },
	green: { bg: "oklch(0.94 0.03 150)", fg: "oklch(0.38 0.08 150)" },
	ink: { bg: "oklch(0.22 0.012 60)", fg: "oklch(0.98 0.012 85)" },
};

const SIZE_STYLES: Record<BadgeSize, { padding: string; fontSize: number }> = {
	sm: { padding: "2px 8px", fontSize: 11 },
	md: { padding: "4px 10px", fontSize: 12 },
};

export function Badge({ children, tone = "neutral", size = "sm" }: Props) {
	const t = TONE_STYLES[tone];
	const s = SIZE_STYLES[size];
	return (
		<span
			className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium leading-[1.3]"
			style={{
				background: t.bg,
				color: t.fg,
				padding: s.padding,
				fontSize: s.fontSize,
			}}
		>
			{children}
		</span>
	);
}
