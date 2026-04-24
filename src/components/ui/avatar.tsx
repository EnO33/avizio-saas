type Props = {
	/** Initiales à afficher (1-2 caractères). Ex. "HD" pour Hélène Duval. */
	readonly initial: string;
	/** Diamètre en px. Défaut 36 — convient à la plupart des contextes. */
	readonly size?: number;
};

/*
  Palette déterministe de 5 paires (bg/fg) pour que le même prénom ait
  toujours la même couleur d'avatar à travers l'app — familier côté
  utilisateur, plus de cohérence visuelle qu'un random. Le charcode
  de la première lettre sert de hash minimal. Les cinq teintes sont
  espacées dans le cercle chromatique OKLCH (40°/110°/200°/300°/70°)
  pour rester distinctes.
*/
const PALETTE = [
	{ bg: "oklch(0.92 0.04 40)", fg: "oklch(0.42 0.12 40)" },
	{ bg: "oklch(0.92 0.04 110)", fg: "oklch(0.42 0.08 110)" },
	{ bg: "oklch(0.92 0.04 200)", fg: "oklch(0.42 0.09 200)" },
	{ bg: "oklch(0.92 0.04 300)", fg: "oklch(0.42 0.09 300)" },
	{ bg: "oklch(0.92 0.04 70)", fg: "oklch(0.42 0.09 70)" },
] as const;

export function Avatar({ initial, size = 36 }: Props) {
	const idx = (initial.charCodeAt(0) || 0) % PALETTE.length;
	const tone = PALETTE[idx] ?? PALETTE[0];
	return (
		<div
			aria-hidden="true"
			className="flex shrink-0 items-center justify-center rounded-full font-serif font-semibold"
			style={{
				width: size,
				height: size,
				background: tone.bg,
				color: tone.fg,
				fontSize: size * 0.38,
				letterSpacing: "0.02em",
			}}
		>
			{initial}
		</div>
	);
}
