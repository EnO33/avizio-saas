/**
 * Footer minimal à la française — copyright à gauche, liens légaux
 * à droite sur une seule ligne. Pas de newsletter ni de grand menu :
 * la landing tient déjà son propre discours au-dessus, le footer sert
 * juste de clôture visuelle et de respect RGPD (accès aux CGU).
 */
export function Footer() {
	const year = new Date().getFullYear();
	return (
		<footer className="mt-10 border-line-soft border-t">
			<div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-4 px-7 py-8 text-[12px] text-ink-mute sm:flex-row sm:items-center">
				<span>© {year} Avizio · Fait avec ❤ à Lyon</span>
				<nav className="flex flex-wrap gap-x-4 gap-y-1">
					<a href="/legal/terms" className="hover:text-ink-soft">
						CGU
					</a>
					<span aria-hidden="true">·</span>
					<a href="/legal/privacy" className="hover:text-ink-soft">
						Confidentialité
					</a>
					<span aria-hidden="true">·</span>
					<a href="mailto:hello@avizio.fr" className="hover:text-ink-soft">
						Contact
					</a>
				</nav>
			</div>
		</footer>
	);
}
