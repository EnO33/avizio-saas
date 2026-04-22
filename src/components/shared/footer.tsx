export function Footer() {
	const year = new Date().getFullYear();
	return (
		<footer className="border-neutral-200 border-t bg-neutral-50">
			<div className="mx-auto max-w-6xl px-6 py-12">
				<div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
					<div>
						<p className="font-bold text-neutral-900 text-xl tracking-tight">
							Avizio
						</p>
						<p className="mt-1 text-neutral-600 text-sm">
							La gestion des avis clients, pensée pour les commerces de
							proximité.
						</p>
					</div>
					<nav className="flex flex-wrap gap-x-6 gap-y-2 text-neutral-600 text-sm">
						<a
							href="mailto:contact@avizio.fr"
							className="hover:text-neutral-900"
						>
							Contact
						</a>
						<a href="#pricing" className="hover:text-neutral-900">
							Tarifs
						</a>
						<a href="/legal/terms" className="hover:text-neutral-900">
							CGU
						</a>
						<a href="/legal/privacy" className="hover:text-neutral-900">
							Confidentialité
						</a>
					</nav>
				</div>
				<p className="mt-8 text-neutral-500 text-xs">
					© {year} Avizio. Fait à Lyon avec ☕ et ❤️.
				</p>
			</div>
		</footer>
	);
}
