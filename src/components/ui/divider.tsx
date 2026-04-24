import type { CSSProperties } from "react";

type Props = {
	/** `true` pour un trait vertical qui s'étire sur la hauteur du parent. */
	readonly vertical?: boolean;
	readonly style?: CSSProperties;
};

/**
 * Séparateur `line-soft` qui s'adapte à son orientation. Plus léger
 * qu'un `<hr>` stylisé — pas de padding ni de margin imposés.
 */
export function Divider({ vertical = false, style }: Props) {
	return (
		<div
			aria-hidden="true"
			className="bg-line-soft"
			style={{
				...(vertical
					? { width: 1, alignSelf: "stretch" }
					: { height: 1, width: "100%" }),
				...style,
			}}
		/>
	);
}
