import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type ButtonVariant =
	| "primary"
	| "accent"
	| "outline"
	| "ghost"
	| "subtle";
export type ButtonSize = "sm" | "md" | "lg";

type Props = Omit<ComponentPropsWithoutRef<"button">, "type"> & {
	readonly variant?: ButtonVariant;
	readonly size?: ButtonSize;
	/** Icône à gauche du label. Composant lucide-react ou tout `ReactNode`. */
	readonly icon?: ReactNode;
	/** Icône à droite du label (ex. arrow pour « Continuer → »). */
	readonly iconRight?: ReactNode;
	/** Par défaut `button` pour éviter les submit involontaires. */
	readonly type?: "button" | "submit" | "reset";
};

/*
  Trois échelles pour couvrir tous les contextes — header (sm), body
  (md), landing CTA (lg). Les valeurs de padding/radius sont prises
  directement de la maquette pour que les primitives soient drop-in.
*/
const SIZE_STYLES: Record<ButtonSize, string> = {
	sm: "h-8 px-2.5 text-[12.5px] rounded-[7px] gap-1.5",
	md: "h-9 px-3.5 text-[13px] rounded-lg gap-1.5",
	lg: "h-11 px-5 text-sm rounded-[10px] gap-2",
};

/*
  Les variantes suivent la hiérarchie produit :
  - `accent` : action primaire chaleureuse (CTA de génération, publier)
  - `primary` : action neutre forte (se connecter, submit)
  - `outline` : action secondaire (éditer, annuler)
  - `ghost` : action tertiaire discrète (retour, menu)
  - `subtle` : action inline dans un footer (« Régénérer »)
  Filter brightness au hover plutôt qu'un changement de couleur explicite
  — moins de tokens à maintenir, et ça marche sur toutes les variantes.
*/
const VARIANT_STYLES: Record<ButtonVariant, string> = {
	primary:
		"bg-ink text-bg border border-ink hover:brightness-95 disabled:opacity-50",
	accent:
		"bg-accent text-bg border border-accent hover:brightness-95 disabled:opacity-50",
	outline:
		"bg-paper text-ink border border-line hover:bg-bg-deep disabled:opacity-50",
	ghost:
		"bg-transparent text-ink-soft border border-transparent hover:bg-bg-deep disabled:opacity-50",
	subtle:
		"bg-[oklch(0.94_0.005_70)] text-ink border border-transparent hover:brightness-95 disabled:opacity-50",
};

export function Button({
	variant = "primary",
	size = "md",
	icon,
	iconRight,
	type = "button",
	className = "",
	children,
	disabled,
	...rest
}: Props) {
	return (
		<button
			type={type}
			disabled={disabled}
			className={[
				"inline-flex items-center justify-center font-medium whitespace-nowrap transition-all duration-[120ms] disabled:cursor-not-allowed",
				SIZE_STYLES[size],
				VARIANT_STYLES[variant],
				className,
			].join(" ")}
			{...rest}
		>
			{icon}
			{children}
			{iconRight}
		</button>
	);
}
