import { useEffect, useRef, useState } from "react";

type NavItem = {
	readonly id: string;
	readonly label: string;
	readonly disabled?: boolean;
};

type Props = {
	readonly items: readonly NavItem[];
	/**
	 * Sélecteur CSS qui matche les éléments de section à observer pour
	 * l'état actif. On passe le sélecteur plutôt que les refs pour que
	 * le caller garde la responsabilité des ancres dans son JSX.
	 */
	readonly sectionSelector: string;
};

/**
 * Sub-nav sticky côté gauche — sert d'ancre scroll pour les sections
 * de la page Paramètres. L'item actif est déterminé par un
 * IntersectionObserver : la section la plus « visible » (celle dont le
 * sommet est au-dessus de la ligne médiane du viewport) devient active.
 *
 * Pourquoi pas juste l'URL hash : sur une page longue, changer d'URL
 * à chaque scroll est bruyant dans l'historique et fait clignoter
 * l'active state. L'observer donne un résultat propre sans polluer
 * la route.
 */
export function SettingsSubNav({ items, sectionSelector }: Props) {
	const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");
	const containerRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		const sections = Array.from(
			document.querySelectorAll<HTMLElement>(sectionSelector),
		);
		if (sections.length === 0) return;

		const observer = new IntersectionObserver(
			(entries) => {
				// On prend la section dont le plus de hauteur est visible dans
				// la fenêtre — robuste quand plusieurs sections sont partiellement
				// visibles en même temps.
				const visible = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
				if (visible?.target.id) {
					setActiveId(visible.target.id);
				}
			},
			{
				rootMargin: "-20% 0px -60% 0px",
				threshold: [0, 0.25, 0.5, 0.75, 1],
			},
		);

		for (const s of sections) observer.observe(s);
		return () => observer.disconnect();
	}, [sectionSelector]);

	const onClick = (id: string) => (e: React.MouseEvent) => {
		e.preventDefault();
		const target = document.getElementById(id);
		if (!target) return;
		target.scrollIntoView({ behavior: "smooth", block: "start" });
		setActiveId(id);
	};

	return (
		<nav
			ref={containerRef}
			aria-label="Paramètres"
			className="sticky top-[90px] self-start"
		>
			{items.map((item) => {
				const active = activeId === item.id;
				return (
					<a
						key={item.id}
						href={`#${item.id}`}
						onClick={item.disabled ? undefined : onClick(item.id)}
						aria-current={active ? "true" : undefined}
						className={[
							"mb-0.5 block rounded-md px-3 py-2 text-[13px] transition-colors",
							item.disabled
								? "cursor-not-allowed text-ink-mute opacity-50"
								: active
									? "bg-bg-deep font-medium text-ink"
									: "font-normal text-ink-mute hover:text-ink",
						].join(" ")}
					>
						{item.label}
					</a>
				);
			})}
		</nav>
	);
}
