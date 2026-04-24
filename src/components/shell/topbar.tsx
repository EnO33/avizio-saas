import { Link } from "@tanstack/react-router";
import { Bell, Plus } from "lucide-react";
import { Button } from "#/components/ui/button";

type Props = {
	/** `true` si des avis sont en attente — affiche le dot accent sur la cloche. */
	readonly hasNotifications: boolean;
};

/**
 * Topbar sticky 60px. Pas de barre de recherche — la palette ⌘K est
 * skippée pour ce premier jet (ajoutée dans une PR dédiée plus tard).
 * Le CTA accent « Générer une réponse » renvoie vers l'inbox : c'est
 * l'action « que faire ensuite » par défaut pour l'utilisateur. En mobile
 * le label est masqué pour dégager de la largeur — seule l'icône `+`
 * subsiste, aria-label explicite pour garder l'accessibilité.
 */
export function Topbar({ hasNotifications }: Props) {
	return (
		<div className="sticky top-0 z-[5] flex h-[60px] items-center gap-3 border-line-soft border-b bg-bg px-4 sm:gap-4 sm:px-7">
			<div className="flex-1" />

			<button
				type="button"
				aria-label={
					hasNotifications
						? "Notifications — nouvelles alertes"
						: "Notifications"
				}
				className="relative p-2 text-ink-soft hover:text-ink"
			>
				<Bell size={17} strokeWidth={1.75} />
				{hasNotifications ? (
					<span
						aria-hidden="true"
						className="absolute top-[7px] right-[7px] size-1.5 rounded-full bg-accent"
					/>
				) : null}
			</button>

			<Link to="/reviews" aria-label="Générer une réponse">
				<Button
					variant="accent"
					size="sm"
					icon={<Plus size={14} strokeWidth={1.75} />}
				>
					<span className="hidden sm:inline">Générer une réponse</span>
				</Button>
			</Link>
		</div>
	);
}
