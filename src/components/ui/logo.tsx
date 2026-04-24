type Props = {
	/** Pixel size of the mark. The wordmark scales proportionally. */
	readonly size?: number;
	/** Render the mark alone (no wordmark) — useful for narrow UIs. */
	readonly iconOnly?: boolean;
};

/**
 * Wordmark Avizio — cercle terracotta avec « a » italique Instrument
 * Serif. Taille paramétrable pour qu'un même composant serve le header
 * landing (22), la sidebar (20) et le panneau onboarding (22). On évite
 * `<svg>` préparé + `<text>` texte-baked parce que le rendu SVG du « a »
 * italique varie légèrement entre les browsers — on garde du SVG simple,
 * le `<text>` hérite de la police Google chargée dans le root.
 */
export function Logo({ size = 22, iconOnly = false }: Props) {
	return (
		<span className="inline-flex items-center gap-2">
			<svg
				width={size}
				height={size}
				viewBox="0 0 28 28"
				aria-hidden={iconOnly ? undefined : "true"}
				role={iconOnly ? "img" : undefined}
				aria-label={iconOnly ? "Avizio" : undefined}
			>
				<title>Avizio</title>
				<circle cx="14" cy="14" r="13" fill="oklch(0.58 0.14 40)" />
				<text
					x="14"
					y="20"
					textAnchor="middle"
					fontFamily="Instrument Serif, serif"
					fontSize="20"
					fill="oklch(0.98 0.012 85)"
					fontStyle="italic"
				>
					a
				</text>
			</svg>
			{iconOnly ? null : (
				<span
					className="font-serif tracking-tight text-ink"
					style={{ fontSize: size * 0.95 }}
				>
					Avizio
				</span>
			)}
		</span>
	);
}
