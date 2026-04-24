type Props = {
	readonly on: boolean;
	readonly onChange: (next: boolean) => void;
	readonly disabled?: boolean;
	readonly ariaLabel?: string;
};

/**
 * Switch 42×24 avec animation de slide 150ms. Respecte le pattern
 * ARIA `role="switch"` + `aria-checked` (pas de `checkbox` déguisée)
 * pour que les lecteurs d'écran annoncent correctement « activé /
 * désactivé » plutôt que « coché / décoché ».
 */
export function Toggle({ on, onChange, disabled = false, ariaLabel }: Props) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label={ariaLabel}
			disabled={disabled}
			onClick={() => onChange(!on)}
			className={[
				"relative inline-flex h-6 w-[42px] shrink-0 items-center rounded-full border-none p-0.5 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
				on ? "bg-accent" : "bg-[oklch(0.88_0.015_80)]",
			].join(" ")}
		>
			<span
				className="h-5 w-5 rounded-full bg-paper shadow-sm transition-transform duration-150"
				style={{ transform: on ? "translateX(18px)" : "translateX(0)" }}
			/>
		</button>
	);
}
