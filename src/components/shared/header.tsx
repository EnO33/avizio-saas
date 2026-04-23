import { Show, UserButton } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";

export function Header() {
	return (
		<header className="sticky top-0 z-40 border-neutral-200 border-b bg-white/80 backdrop-blur">
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
				<Link
					to="/"
					className="font-bold text-neutral-900 text-xl tracking-tight"
				>
					Avizio
				</Link>
				<nav className="hidden items-center gap-6 text-neutral-600 text-sm md:flex">
					<a href="#features" className="hover:text-neutral-900">
						Fonctionnalités
					</a>
					<a href="#how-it-works" className="hover:text-neutral-900">
						Comment ça marche
					</a>
					<a href="#pricing" className="hover:text-neutral-900">
						Tarifs
					</a>
				</nav>
				<div className="flex items-center gap-3">
					<Show when="signed-out">
						<Link
							to="/sign-in"
							className="text-neutral-600 text-sm hover:text-neutral-900"
						>
							Se connecter
						</Link>
						<Link
							to="/sign-up"
							className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-sm text-white hover:bg-neutral-800"
						>
							Essai gratuit
						</Link>
					</Show>
					<Show when="signed-in">
						<Link
							to="/dashboard"
							className="text-neutral-600 text-sm hover:text-neutral-900"
						>
							Dashboard
						</Link>
						<UserButton />
					</Show>
				</div>
			</div>
		</header>
	);
}
