import { OrganizationSwitcher, UserButton } from "@clerk/tanstack-react-start";
import { Link, useLocation } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
	Inbox as InboxIcon,
	LayoutDashboard,
	Link2,
	Settings,
	Store,
} from "lucide-react";
import { Logo } from "#/components/ui/logo";

type NavId =
	| "dashboard"
	| "inbox"
	| "establishments"
	| "connections"
	| "settings";

type NavEntry = {
	readonly id: NavId;
	readonly label: string;
	readonly icon: LucideIcon;
	/** Href ciblé par l'entrée. */
	readonly to: string;
	/** Autres chemins considérés comme matchant (ex. /reviews/$id pour l'inbox). */
	readonly activePrefixes?: readonly string[];
};

const NAV: readonly NavEntry[] = [
	{
		id: "dashboard",
		label: "Tableau de bord",
		icon: LayoutDashboard,
		to: "/dashboard",
	},
	{
		id: "inbox",
		label: "Boîte de réponses",
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
		id: "connections",
		label: "Connexions",
		icon: Link2,
		to: "/connections",
	},
	{
		id: "settings",
		label: "Paramètres",
		icon: Settings,
		// Provisoire : les paramètres sont aujourd'hui per-établissement, on
		// renvoie vers la liste d'établissements pour que l'utilisateur
		// choisisse celui à configurer. La cible évoluera quand on aura des
		// paramètres org-level (équipe, facturation).
		to: "/establishments",
	},
];

type Props = {
	/** Nombre d'avis à traiter — affiché en pill accent à côté de « Boîte de réponses ». */
	readonly pendingReviewsCount: number;
	/** Jours restants sur l'essai gratuit. `null` = essai non actif (payant ou non connecté). */
	readonly trialDaysRemaining: number | null;
};

export function Sidebar({ pendingReviewsCount, trialDaysRemaining }: Props) {
	const location = useLocation();

	return (
		<aside className="sticky top-0 hidden h-screen w-[232px] flex-col border-line-soft border-r bg-bg-deep px-3.5 py-5 md:flex">
			{/* Logo */}
			<div className="px-2 pb-5">
				<Logo size={20} />
			</div>

			{/* Org switcher — widget Clerk stylisé pour imiter la carte de la
			    maquette. L'appearance.elements cible les parties internes du
			    trigger (carte) et du popover (menu d'orgs). */}
			<div className="mb-4">
				<OrganizationSwitcher
					hidePersonal
					afterCreateOrganizationUrl="/dashboard"
					afterSelectOrganizationUrl="/dashboard"
					appearance={{
						elements: {
							rootBox: "w-full",
							organizationSwitcherTrigger:
								"w-full justify-start rounded-[10px] border border-line-soft bg-paper px-3 py-2.5 hover:bg-bg shadow-sm",
							organizationSwitcherTriggerIcon: "text-ink-mute",
							organizationPreviewMainIdentifier:
								"text-[12.5px] font-medium text-ink",
							organizationPreviewSecondaryIdentifier:
								"text-[10.5px] text-ink-mute",
						},
					}}
				/>
			</div>

			{/* Nav */}
			<nav className="flex flex-col gap-0.5">
				{NAV.map((entry) => {
					const active = isActive(location.pathname, entry);
					const Icon = entry.icon;
					return (
						<Link
							key={entry.id}
							to={entry.to}
							className={[
								"flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-[13px] transition-all duration-[120ms]",
								active
									? "border-line-soft bg-paper font-medium text-ink shadow-sm"
									: "border-transparent font-normal text-ink-soft hover:bg-paper/50",
							].join(" ")}
						>
							<Icon size={16} strokeWidth={1.75} aria-hidden="true" />
							<span className="flex-1">{entry.label}</span>
							{entry.id === "inbox" && pendingReviewsCount > 0 ? (
								<span className="rounded-full bg-accent px-1.5 font-semibold text-[10.5px] text-bg leading-[1.4]">
									{pendingReviewsCount}
								</span>
							) : null}
						</Link>
					);
				})}
			</nav>

			{/* Bas — trial banner + user button */}
			<div className="mt-auto border-line-soft border-t pt-4">
				{trialDaysRemaining != null ? (
					<div className="mb-3 rounded-[10px] bg-accent-soft p-3">
						<div className="font-medium text-[11px] text-accent-ink">
							Essai · J-{trialDaysRemaining}
						</div>
						<Link
							to="/establishments"
							className="mt-2 inline-block font-medium text-[11px] text-accent-ink underline"
						>
							Activer l'abonnement →
						</Link>
					</div>
				) : null}

				<UserButton
					appearance={{
						elements: {
							rootBox: "w-full",
							userButtonTrigger:
								"w-full rounded-md p-1.5 hover:bg-paper/50 focus:shadow-none",
							userButtonBox: "w-full flex-row-reverse justify-end gap-2",
							userButtonOuterIdentifier: "text-[12.5px] text-ink-soft truncate",
							avatarBox: "size-6",
						},
					}}
					showName
				/>
			</div>
		</aside>
	);
}

function isActive(pathname: string, entry: NavEntry): boolean {
	if (pathname === entry.to) return true;
	if (!entry.activePrefixes) return false;
	return entry.activePrefixes.some((prefix) => pathname.startsWith(prefix));
}
