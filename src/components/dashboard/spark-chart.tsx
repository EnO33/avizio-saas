import type { SparkPoint } from "#/server/db/queries/dashboard";

type Props = {
	/** Séries quotidiennes sur les 30 derniers jours, ordre chronologique. */
	readonly data: readonly SparkPoint[];
};

/**
 * Courbe de la note moyenne glissante. La série peut contenir des
 * journées sans avis (`avgRating: null`) — on les comble en carry-forward
 * de la dernière valeur connue pour garder un trait continu, quitte à
 * montrer un plateau quand l'activité est faible. Sous un certain seuil
 * de points non-null (4), on affiche un état vide plutôt qu'une courbe
 * trompeuse à deux segments.
 *
 * SVG pur, zéro dépendance charting. Area chart sous le trait avec
 * gradient accent qui s'estompe vers le bas — signalise la direction
 * sans saturer visuellement.
 */
export function SparkChart({ data }: Props) {
	const series = carryForward(data);
	const valuesWithRating = series.filter(
		(p): p is { day: Date; avgRating: number } => p.avgRating !== null,
	);

	if (valuesWithRating.length < 4) {
		return <EmptyState />;
	}

	const W = 680;
	const H = 160;
	const PAD = 20;

	// Bornes dynamiques : on cale l'axe Y entre 0,5 point sous le min et
	// 0,5 sous le max (min 0.5 écart pour éviter un axe plat quand toutes
	// les valeurs sont identiques). Clampé à [0, 5] pour rester dans la
	// plage ratings valides.
	const ratings = valuesWithRating.map((p) => p.avgRating);
	const rawMin = Math.min(...ratings);
	const rawMax = Math.max(...ratings);
	const span = Math.max(rawMax - rawMin, 0.5);
	const min = Math.max(0, Math.min(5, rawMin - span * 0.2));
	const max = Math.min(5, Math.max(0, rawMax + span * 0.2));

	const xAt = (i: number) => PAD + (i / (series.length - 1)) * (W - PAD * 2);
	const yAt = (v: number) =>
		max === min ? H / 2 : PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2);

	const linePath = series
		.map((point, i) => {
			if (point.avgRating == null) return "";
			const cmd = i === 0 ? "M" : "L";
			return `${cmd} ${xAt(i)} ${yAt(point.avgRating)}`;
		})
		.filter(Boolean)
		.join(" ");
	const areaPath = `${linePath} L ${xAt(series.length - 1)} ${H - PAD} L ${xAt(0)} ${H - PAD} Z`;

	const gridlines = pickGridlines(min, max);
	const lastIdx = series.length - 1;
	const last = series[lastIdx]?.avgRating;

	return (
		<svg
			width="100%"
			viewBox={`0 0 ${W} ${H}`}
			role="img"
			aria-label="Évolution de la note moyenne sur 30 jours"
			className="block"
		>
			<title>Évolution de la note moyenne sur 30 jours</title>
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
						{v.toFixed(1).replace(".", ",")}★
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

function EmptyState() {
	return (
		<div className="flex h-[160px] items-center justify-center rounded-lg bg-bg-deep/40 px-4 text-center">
			<p className="m-0 text-[13px] text-ink-mute leading-[1.5]">
				Pas encore assez de données pour tracer une évolution.
				<br />
				La courbe apparaîtra dès quelques avis reçus.
			</p>
		</div>
	);
}

/*
  Comble les jours sans avis avec la dernière valeur connue pour éviter
  les trous dans la courbe. Les jours initiaux sans donnée (avant le
  premier avis) restent null — pas de valeur à extrapoler vers la gauche.
*/
function carryForward(points: readonly SparkPoint[]): readonly SparkPoint[] {
	let last: number | null = null;
	return points.map((p) => {
		if (p.avgRating != null) {
			last = p.avgRating;
			return p;
		}
		return { day: p.day, avgRating: last };
	});
}

/*
  Choisit 3 gridlines sympa dans [min, max]. Simple heuristique : le
  min, le max et le milieu. Arrondis à 0.5 près pour que les libellés
  restent propres (« 3,5★ », « 4★ », « 4,5★ »).
*/
function pickGridlines(min: number, max: number): readonly number[] {
	const round = (v: number) => Math.round(v * 2) / 2;
	const bottom = round(min);
	const top = round(max);
	if (bottom === top) return [bottom];
	const mid = round((bottom + top) / 2);
	if (mid === bottom || mid === top) return [bottom, top];
	return [bottom, mid, top];
}
