type Stat = {
	readonly index: string;
	readonly headline: string;
	readonly body: string;
};

const STATS: readonly Stat[] = [
	{
		index: "01",
		headline: "30 min/jour",
		body: "économisées sur la gestion des avis",
	},
	{
		index: "02",
		headline: "+0,4 ★",
		body: "de moyenne sur 90 jours — clients inscrits",
	},
	{
		index: "03",
		headline: "3 plateformes",
		body: "centralisées : Google, TripAdvisor, Trustpilot",
	},
	{
		index: "04",
		headline: "RGPD",
		body: "données hébergées en France, chiffrées",
	},
];

/**
 * Bloc de stats sous la hero — 4 items numérotés avec chiffre serif
 * géant accent-ink. Intentionnellement sans cadre ni ombre : le
 * border-top fait toute la structure. Responsive via `auto-fit
 * minmax(260px, 1fr)` : 4 colonnes sur desktop, 2 sur tablette,
 * 1 sur mobile sans media query.
 */
export function Features() {
	return (
		<section
			id="features"
			className="mx-auto max-w-[1200px] px-7 py-14 md:py-16"
		>
			<div
				className="grid gap-5"
				style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}
			>
				{STATS.map((stat) => (
					<div key={stat.index} className="border-line border-t px-1 pt-7 pb-0">
						<div className="mb-2.5 font-mono text-[10.5px] text-ink-mute">
							{stat.index}
						</div>
						<div className="mb-2.5 font-serif text-[38px] text-accent-ink leading-[1]">
							{stat.headline}
						</div>
						<div className="text-[13.5px] text-ink-soft leading-[1.5]">
							{stat.body}
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
