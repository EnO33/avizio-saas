import type { ComponentPropsWithoutRef } from "react";

type Props = ComponentPropsWithoutRef<"textarea"> & {
	/** `sans` pour formulaires, `serif` pour l'éditeur de réponse. */
	readonly variant?: "sans" | "serif";
};

/**
 * Textarea en deux variantes : l'UI courante (sans, 13.5px) et l'éditeur
 * de réponse (serif Instrument, 17px, line-height aéré). La serif est
 * utilisée dans le workspace de rédaction pour que le brouillon ressemble
 * déjà au texte final que verra le client.
 */
export function Textarea({ variant = "sans", className = "", ...rest }: Props) {
	const variantClasses =
		variant === "serif"
			? "font-serif text-[17px] leading-[1.6]"
			: "text-[13.5px] leading-[1.55]";
	return (
		<textarea
			{...rest}
			className={[
				"w-full resize-y rounded-lg border border-line bg-paper px-3.5 py-3 text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0",
				variantClasses,
				className,
			].join(" ")}
		/>
	);
}
