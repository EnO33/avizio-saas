import type { ReactNode } from "react";

type Props = {
	readonly label: string;
	readonly children: ReactNode;
	/** Texte d'aide placé sous le champ. Ex. « Au moins 8 caractères ». */
	readonly help?: string;
	/** Marquer le champ comme requis visuellement (petit astérisque). */
	readonly required?: boolean;
	/**
	 * Id à poser sur le `<label htmlFor>`. Le caller reste responsable
	 * de le propager à son input/textarea. Facilite les cas groupés
	 * (OTP, pills) où le label pointe vers un wrapper plutôt qu'un
	 * input unique — on laisse la main au composant interne.
	 */
	readonly htmlFor?: string;
};

/**
 * Wrapper label + champ + aide. Ne manipule jamais les `children` —
 * délibérément découplé pour que les groupes (OTP, boutons-pills)
 * puissent s'accommoder d'un label lié par `aria-labelledby` au lieu
 * du couple classique `<label htmlFor>` + `<input id>`.
 */
export function Field({
	label,
	children,
	help,
	required = false,
	htmlFor,
}: Props) {
	return (
		<div>
			<label
				htmlFor={htmlFor}
				className="mb-1.5 block font-medium text-[12.5px] text-ink"
			>
				{label}
				{required ? (
					<span aria-hidden="true" className="ml-1 text-accent-ink">
						*
					</span>
				) : null}
			</label>
			{children}
			{help ? (
				<div className="mt-1 text-[11.5px] text-ink-mute">{help}</div>
			) : null}
		</div>
	);
}
