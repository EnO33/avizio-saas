/**
 * Placeholder static spark chart — 30 points hardcodés simulant
 * une évolution de note sur 90 jours. Sera remplacé par un vrai
 * calcul DB (moyenne glissante des ratings sur l'org) quand on aura
 * assez de données avis en prod pour que l'agrégat soit significatif.
 *
 * Rendu en SVG pur, zéro dépendance charting. Area chart sous le trait
 * avec gradient accent qui s'estompe vers le bas — signalise la
 * direction (tendance positive) sans saturer visuellement.
 */
const DATA: readonly number[] = [
	4.2, 4.3, 4.2, 4.1, 4.3, 4.4, 4.3, 4.4, 4.5, 4.4, 4.3, 4.4, 4.5, 4.5, 4.4,
	4.6, 4.5, 4.6, 4.6, 4.5, 4.6, 4.7, 4.6, 4.6, 4.7, 4.6, 4.6, 4.7, 4.6, 4.6,
];

const W = 680;
const H = 160;
const PAD = 20;
const MIN = 4.0;
const MAX = 5.0;

export function SparkChart() {
	const xAt = (i: number) => PAD + (i / (DATA.length - 1)) * (W - PAD * 2);
	const yAt = (v: number) =>
		PAD + (1 - (v - MIN) / (MAX - MIN)) * (H - PAD * 2);

	const linePath = DATA.map(
		(v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`,
	).join(" ");
	const areaPath = `${linePath} L ${xAt(DATA.length - 1)} ${H - PAD} L ${xAt(0)} ${H - PAD} Z`;

	const gridlines = [4.0, 4.5, 5.0] as const;
	const lastIdx = DATA.length - 1;
	const last = DATA[lastIdx];

	return (
		<svg
			width="100%"
			viewBox={`0 0 ${W} ${H}`}
			role="img"
			aria-label="Évolution de la note moyenne sur 90 jours"
			className="block"
		>
			<title>Évolution de la note moyenne sur 90 jours</title>
			{gridlines.map((v) => (
				<g key={v}>
					<line
						x1={PAD}
						x2={W - PAD}
						y1={yAt(v)}
						y2={yAt(v)}
						stroke="var(--color-line-soft)"
						strokeDasharray="2 4"
					/>
					<text
						x={W - PAD + 4}
						y={yAt(v) + 3}
						fontSize="10"
						fill="var(--color-ink-mute)"
					>
						{v.toString().replace(".", ",")}★
					</text>
				</g>
			))}
			<defs>
				<linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
					<stop
						offset="0%"
						stopColor="oklch(0.58 0.14 40)"
						stopOpacity="0.18"
					/>
					<stop offset="100%" stopColor="oklch(0.58 0.14 40)" stopOpacity="0" />
				</linearGradient>
			</defs>
			<path d={areaPath} fill="url(#sparkGradient)" />
			<path
				d={linePath}
				fill="none"
				stroke="oklch(0.58 0.14 40)"
				strokeWidth="2"
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
			{last != null ? (
				<circle
					cx={xAt(lastIdx)}
					cy={yAt(last)}
					r="4"
					fill="oklch(0.58 0.14 40)"
					stroke="var(--color-paper)"
					strokeWidth="2"
				/>
			) : null}
		</svg>
	);
}
