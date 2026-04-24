import { Show } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Logo } from "#/components/ui/logo";

/**
 * Header sticky translucide pour la landing. Le blur + opacité
 * `bg/80` créent une couche discrète qui reste lisible au scroll
 * sur tout fond (hero, stats, pricing) sans jamais écraser le
 * contenu. Les deux CTAs (sign-in / essai) sont séparés par un
 * `flex gap` pour que la navigation ne se colle pas aux actions.
 */
export function Header() {
	return (
		<header className="sticky top-0 z-40 border-line-soft border-b bg-bg/80 backdrop-blur">
			<div className="mx-auto flex max-w-[1200px] items-center justify-between px-7 py-4">
				<Link to="/" aria-label="Avizio — accueil">
					<Logo size={22} />
				</Link>

				<nav className="hide-md-down flex items-center gap-7 text-[13px] text-ink-soft">
					<a href="#features" className="hover:text-ink">
						Fonctionnalités
					</a>
					<a href="#pricing" className="hover:text-ink">
						Tarifs
					</a>
					<a href="#how" className="hover:text-ink">
						Comment ça marche
					</a>
				</nav>

				<div className="flex items-center gap-2">
					<Show when="signed-out">
						<Link to="/sign-in">
							<Button variant="ghost" size="sm">
								Se connecter
							</Button>
						</Link>
						<Link to="/sign-up">
							<Button
								variant="primary"
								size="sm"
								iconRight={<ArrowRight size={14} strokeWidth={1.75} />}
							>
								Essai gratuit
							</Button>
						</Link>
					</Show>
					<Show when="signed-in">
						<Link to="/dashboard">
							<Button
								variant="primary"
								size="sm"
								iconRight={<ArrowRight size={14} strokeWidth={1.75} />}
							>
								Ouvrir l'app
							</Button>
						</Link>
					</Show>
				</div>
			</div>
		</header>
	);
}
