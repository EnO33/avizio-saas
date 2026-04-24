import type { ComponentPropsWithoutRef } from "react";

type Props = ComponentPropsWithoutRef<"input">;

/**
 * Input texte avec bord `--line`, fond blanc, et ring accent au focus
 * via Tailwind (plus lisible qu'un onFocus/onBlur manipulating style).
 * Pas de gestion d'erreur ici — la validation est remontée par le
 * formulaire (react-hook-form) sous forme d'un message en-dessous.
 */
export function Input({ className = "", ...rest }: Props) {
	return (
		<input
			{...rest}
			className={[
				"w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-accent",
				className,
			].join(" ")}
		/>
	);
}
