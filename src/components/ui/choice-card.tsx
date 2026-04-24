type Props = {
	readonly label: string;
	/** Sous-titre en 2ᵉ ligne — ex. « Proche, personnel, chaleureux ». */
	readonly sub?: string;
	readonly active?: boolean;
	readonly onClick?: () => void;
	readonly disabled?: boolean;
};

/**
 * Carte cliquable pour choix parmi un ensemble — ton de réponse (warm /
 * professional / direct), rôle utilisateur (propriétaire / manager),
 * palette de filtres étendue. État actif = border + bg accent-soft,
 * avec la couleur foreground qui passe en accent-ink. Hover discret
 * sur les cartes inactives pour signaler qu'elles sont cliquables.
 */
export function ChoiceCard({
	label,
	sub,
	active = false,
	onClick,
	disabled = false,
}: Props) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-pressed={active}
			className={[
				"rounded-lg border px-3.5 py-3 text-left transition-colors duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50",
				active
					? "border-accent bg-accent-soft text-accent-ink"
					: "border-line bg-paper text-ink hover:bg-bg-deep",
			].join(" ")}
		>
			<div className="font-medium text-[13px]">{label}</div>
			{sub ? (
				<div
					className={[
						"mt-0.5 text-[11px]",
						active ? "text-accent-ink opacity-80" : "text-ink-mute",
					].join(" ")}
				>
					{sub}
				</div>
			) : null}
		</button>
	);
}
