import { Link } from "@tanstack/react-router";
import { Bell, Plus } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Logo } from "#/components/ui/logo";
import { UserMenu } from "./user-menu";

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
 *
 * En mobile uniquement, le topbar porte aussi le logo à gauche et un
 * `UserMenu` compact à droite — deux affordances habituellement dans la
 * sidebar mais cachée sous `md:`. Évite à l'utilisateur mobile d'être
 * coincé sans logo repère ni moyen de se déconnecter.
 */
export function Topbar({ hasNotifications }: Props) {
	return (
		<div className="sticky top-0 z-[5] flex h-[60px] items-center gap-3 border-line-soft border-b bg-bg px-4 sm:gap-4 sm:px-7">
			<Link
				to="/dashboard"
				aria-label="Avizio — accueil"
				className="rounded focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 md:hidden"
			>
				<Logo size={20} />
			</Link>

			<div className="flex-1" />

			<button
				type="button"
				aria-label={
					hasNotifications
						? "Notifications — nouvelles alertes"
						: "Notifications"
				}
				className="relative inline-flex size-10 items-center justify-center rounded-md text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 sm:size-9 sm:rounded"
			>
				<Bell size={17} strokeWidth={1.75} />
				{hasNotifications ? (
					<span
						aria-hidden="true"
						className="absolute top-2 right-2 size-1.5 rounded-full bg-accent"
					/>
				) : null}
			</button>

			<Link
				to="/reviews"
				aria-label="Générer une réponse"
				className="rounded-[7px] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
			>
				<Button
					variant="accent"
					size="sm"
					icon={<Plus size={14} strokeWidth={1.75} />}
					className="h-10 w-10 sm:h-8 sm:w-auto"
				>
					<span className="hidden sm:inline">Générer une réponse</span>
				</Button>
			</Link>

			<div className="md:hidden">
				<UserMenu variant="compact" />
			</div>
		</div>
	);
}
