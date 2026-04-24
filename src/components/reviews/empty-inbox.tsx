import { Check } from "lucide-react";

type Props = {
	readonly hasConnection: boolean;
};

/**
 * Deux états vides possibles dans l'inbox, selon qu'on attend encore une
 * connexion plateforme ou qu'on a juste traité tous les avis sur un filtre
 * donné. Les deux ont la même structure visuelle (cercle + titre serif +
 * explication) pour rester rassurants — l'inbox vide ne doit jamais
 * paraître cassée.
 */
export function EmptyInbox({ hasConnection }: Props) {
	return (
		<div className="px-5 py-16 text-center">
			<div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-bg-deep text-ink-soft">
				<Check size={24} strokeWidth={1.75} />
			</div>
			<div className="font-serif text-[22px]">
				{hasConnection ? "Tout est traité." : "Rien à afficher."}
			</div>
			<div className="mt-1.5 text-[13px] text-ink-mute">
				{hasConnection
					? "Les nouveaux avis arriveront ici automatiquement."
					: "Connectez une plateforme dans Connexions pour recevoir vos premiers avis."}
			</div>
		</div>
	);
}

export function EmptyPreview() {
	return (
		<div className="flex h-full items-center justify-center text-[13px] text-ink-mute">
			Sélectionnez un avis pour voir l'aperçu.
		</div>
	);
}
