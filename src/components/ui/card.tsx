import type { ComponentPropsWithoutRef } from "react";

type Props = ComponentPropsWithoutRef<"div"> & {
	/** Controls the internal padding. Use `0` for edge-to-edge composition. */
	readonly padding?: number;
	/** `paper` = blanc pur (défaut), `cream` = fond bg-deep (cartes contextuelles). */
	readonly tone?: "paper" | "cream";
};

/**
 * Conteneur canonique avec l'ombre + radius chauds + bordure line-soft.
 * On utilise `style.padding` plutôt qu'une classe Tailwind parce que la
 * maquette varie le padding au pixel selon le rôle (18/20/22/24/28/32) —
 * plus souple qu'une échelle Tailwind figée.
 */
export function Card({
	padding = 20,
	tone = "paper",
	className = "",
	style,
	children,
	...rest
}: Props) {
	return (
		<div
			className={[
				"rounded-lg border border-line-soft shadow-sm",
				tone === "cream" ? "bg-bg-deep" : "bg-paper",
				className,
			].join(" ")}
			style={{ padding, ...style }}
			{...rest}
		>
			{children}
		</div>
	);
}
