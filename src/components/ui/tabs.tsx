export type TabItem<TId extends string = string> = {
	readonly id: TId;
	readonly label: string;
	/** Count affiché en pill à droite du label. Omettre pour ne pas en avoir. */
	readonly count?: number | undefined;
};

type Props<TId extends string> = {
	readonly tabs: readonly TabItem<TId>[];
	readonly value: TId;
	readonly onChange: (id: TId) => void;
};

/**
 * Tabs horizontal avec soulignement accent sur l'onglet actif. Les
 * compteurs optionnels (pour « Nouveaux (2) ») changent de couleur
 * quand leur onglet est actif — pastille accent-soft plutôt que la
 * pastille neutre par défaut. Pas de dropdown responsive — à >5
 * onglets, splitter en filtres dédiés plutôt que d'accumuler.
 */
export function Tabs<TId extends string>({
	tabs,
	value,
	onChange,
}: Props<TId>) {
	return (
		<div className="flex gap-1 border-line-soft border-b">
			{tabs.map((t) => {
				const active = value === t.id;
				return (
					<button
						key={t.id}
						type="button"
						onClick={() => onChange(t.id)}
						className={[
							"-mb-px inline-flex items-center gap-1.5 border-b-2 bg-transparent px-3.5 py-2.5 font-medium text-[13px] transition-colors",
							active
								? "border-accent text-ink"
								: "border-transparent text-ink-mute hover:text-ink-soft",
						].join(" ")}
					>
						{t.label}
						{t.count != null ? (
							<span
								className={[
									"rounded-full px-1.5 font-semibold text-[10.5px] leading-[1.4]",
									active
										? "bg-accent-soft text-accent-ink"
										: "bg-[oklch(0.94_0.005_70)] text-ink-mute",
								].join(" ")}
							>
								{t.count}
							</span>
						) : null}
					</button>
				);
			})}
		</div>
	);
}
