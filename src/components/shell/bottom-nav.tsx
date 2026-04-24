import { Link, useLocation } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
	Inbox as InboxIcon,
	LayoutDashboard,
	Settings,
	Store,
} from "lucide-react";

type NavId = "dashboard" | "inbox" | "establishments" | "settings";

type NavEntry = {
	readonly id: NavId;
	readonly label: string;
	readonly icon: LucideIcon;
	/** Href ciblé par l'entrée. */
	readonly to: string;
	/** Chemins additionnels considérés comme matchant (ex. /reviews/$id pour inbox). */
	readonly activePrefixes?: readonly string[];
};

/**
 * 4 entrées — volontairement moins que la sidebar. « Connexions » tombe du
 * bottom-nav mobile parce que c'est une action de setup rare : on préfère
 * garder les 4 actions quotidiennes (dashboard / inbox / étabs / paramètres)
 * avec des touch targets confortables.
 *
 * « Paramètres » pointe pour l'instant vers `/establishments` comme en
 * sidebar — la cible bougera quand un vrai `/settings` org-level arrivera.
 */
const NAV: readonly NavEntry[] = [
	{
		id: "dashboard",
		label: "Tableau",
		icon: LayoutDashboard,
		to: "/dashboard",
	},
	{
		id: "inbox",
		label: "Avis",
		icon: InboxIcon,
		to: "/reviews",
		activePrefixes: ["/reviews"],
	},
	{
		id: "establishments",
		label: "Établissements",
		icon: Store,
		to: "/establishments",
		activePrefixes: ["/establishments"],
	},
	{
		id: "settings",
		label: "Paramètres",
		icon: Settings,
		to: "/establishments",
	},
];

type Props = {
	/** Nombre d'avis à traiter — badge accent sur l'item Avis. */
	readonly pendingReviewsCount: number;
};

/**
 * Nav sticky en bas d'écran pour mobile (< `md:` = 768px). Remplace la
 * sidebar desktop. Une seule entrée active à la fois — on prend la
 * première qui matche (par ordre d'apparition dans `NAV`), ce qui évite
 * le double-actif Établissements/Paramètres tant qu'ils partagent la
 * même route.
 */
export function BottomNav({ pendingReviewsCount }: Props) {
	const location = useLocation();
	const activeIdx = NAV.findIndex((entry) =>
		isActive(location.pathname, entry),
	);

	return (
		<nav
			aria-label="Navigation principale mobile"
			className="sticky bottom-0 z-[5] flex border-line-soft border-t bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
		>
			{NAV.map((entry, idx) => {
				const active = idx === activeIdx;
				const Icon = entry.icon;
				const showBadge = entry.id === "inbox" && pendingReviewsCount > 0;

				return (
					<Link
						key={entry.id}
						to={entry.to}
						aria-current={active ? "page" : undefined}
						className={[
							"relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px]",
							active ? "text-accent" : "text-ink-mute hover:text-ink-soft",
						].join(" ")}
					>
						<span className="relative">
							<Icon size={22} strokeWidth={1.75} aria-hidden="true" />
							{showBadge ? (
								<span
									aria-hidden="true"
									className="-top-1 -right-2 absolute min-w-[16px] rounded-full bg-accent px-1 text-center font-semibold text-[9px] text-bg leading-[16px]"
								>
									{pendingReviewsCount}
								</span>
							) : null}
						</span>
						<span className="font-medium leading-none">{entry.label}</span>
					</Link>
				);
			})}
		</nav>
	);
}

function isActive(pathname: string, entry: NavEntry): boolean {
	if (pathname === entry.to) return true;
	if (!entry.activePrefixes) return false;
	return entry.activePrefixes.some((prefix) => pathname.startsWith(prefix));
}
