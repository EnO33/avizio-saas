import { useClerk, useUser } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "#/components/ui/avatar";

type Props = {
	/**
	 * `default` — trigger pleine largeur avec avatar 24 + nom + chevron,
	 * popover qui s'ouvre vers le haut (sidebar bas).
	 * `compact` — trigger avatar-seul 40×40 (bonne touch target), popover
	 * vers le bas, min-width fixe. Utilisé dans la topbar mobile où on n'a
	 * ni la place ni le besoin d'afficher le nom.
	 */
	readonly variant?: "default" | "compact";
};

/**
 * Bouton utilisateur — remplace le `<UserButton>` Clerk pour matcher la
 * maquette. Deux variantes partagent la même popover (rappel identitaire
 * + « Mon compte » + « Se déconnecter ») ; seul le trigger et la
 * direction d'ouverture changent.
 *
 * L'avatar Clerk (via `user.imageUrl`) prend le pas quand il existe —
 * les comptes SSO Google en ont un — sinon on retombe sur l'`Avatar`
 * à initiales (palette déterministe maison, cohérent avec les avatars
 * auteurs des avis).
 */
export function UserMenu({ variant = "default" }: Props) {
	const { user } = useUser();
	const clerk = useClerk();
	const [open, setOpen] = useState(false);
	const [signingOut, setSigningOut] = useState(false);
	const rootRef = useRef<HTMLDivElement | null>(null);

	// Fermeture sur clic hors + Escape, même pattern que OrgSwitcher.
	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (!rootRef.current) return;
			if (rootRef.current.contains(e.target as Node)) return;
			setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const compact = variant === "compact";

	if (!user) return <TriggerSkeleton compact={compact} />;

	const firstName = user.firstName?.trim() ?? "";
	const lastName = user.lastName?.trim() ?? "";
	const fullName = `${firstName} ${lastName}`.trim();
	const email = user.primaryEmailAddress?.emailAddress ?? "";
	const displayName = fullName.length > 0 ? fullName : email || "Moi";
	const initial = getUserInitial(firstName, lastName, email);
	const imageUrl = user.hasImage ? user.imageUrl : null;

	const onSignOut = async () => {
		setSigningOut(true);
		setOpen(false);
		// Clerk signOut throw rarement (erreur réseau). `redirectUrl: "/"`
		// garantit un atterrissage propre côté landing même si la promise
		// bascule avant que React n'ait retiré le composant.
		await clerk.signOut({ redirectUrl: "/" });
	};

	return (
		<div ref={rootRef} className="relative">
			{compact ? (
				<button
					type="button"
					aria-haspopup="menu"
					aria-expanded={open}
					aria-label={`Compte de ${displayName}`}
					onClick={() => setOpen((v) => !v)}
					disabled={signingOut}
					className="inline-flex size-10 shrink-0 items-center justify-center rounded-full outline-none transition-colors hover:bg-bg-deep focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-60"
				>
					<UserAvatar initial={initial} imageUrl={imageUrl} size={28} />
				</button>
			) : (
				<button
					type="button"
					aria-haspopup="menu"
					aria-expanded={open}
					onClick={() => setOpen((v) => !v)}
					disabled={signingOut}
					className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-ink-soft outline-none transition-colors hover:bg-paper/50 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-60"
				>
					<UserAvatar initial={initial} imageUrl={imageUrl} size={24} />
					<span className="min-w-0 flex-1 truncate text-[12.5px]">
						{displayName}
					</span>
					<ChevronDown
						size={13}
						strokeWidth={1.75}
						aria-hidden="true"
						className={[
							"shrink-0 text-ink-mute transition-transform duration-[120ms]",
							open ? "rotate-180" : "",
						].join(" ")}
					/>
				</button>
			)}

			{open ? (
				<div
					role="menu"
					aria-label="Menu utilisateur"
					className={[
						"absolute z-[20] overflow-hidden rounded-[10px] border border-line-soft bg-paper shadow-[var(--shadow-lg)]",
						compact
							? "top-[calc(100%+6px)] right-0 min-w-[240px]"
							: "right-0 bottom-[calc(100%+6px)] left-0",
					].join(" ")}
				>
					{/* Rappel identitaire — évite au user de douter sur le compte
					    actif quand plusieurs sessions sont ouvertes en parallèle. */}
					<div className="flex items-center gap-2.5 border-line-soft border-b px-3 py-2.5">
						<UserAvatar initial={initial} imageUrl={imageUrl} size={32} />
						<div className="min-w-0 flex-1">
							<div className="truncate font-medium text-[12.5px] text-ink">
								{displayName}
							</div>
							{email && fullName ? (
								<div className="truncate text-[11px] text-ink-mute">
									{email}
								</div>
							) : null}
						</div>
					</div>

					<div className="flex flex-col p-1">
						<Link
							to="/settings"
							hash="account"
							role="menuitem"
							onClick={() => setOpen(false)}
							className="flex items-center gap-2 rounded-md px-2.5 py-2 text-[12.5px] text-ink outline-none transition-colors hover:bg-bg-deep focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px]"
						>
							<UserRound size={14} strokeWidth={1.75} aria-hidden="true" />
							Mon compte
						</Link>
						<button
							type="button"
							role="menuitem"
							onClick={() => void onSignOut()}
							disabled={signingOut}
							className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] text-ink outline-none transition-colors hover:bg-bg-deep focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px] disabled:opacity-60"
						>
							<LogOut size={14} strokeWidth={1.75} aria-hidden="true" />
							{signingOut ? "Déconnexion…" : "Se déconnecter"}
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
}

function TriggerSkeleton({ compact }: { compact: boolean }) {
	if (compact) {
		return (
			<div
				aria-hidden="true"
				className="size-10 animate-pulse rounded-full bg-bg-deep opacity-50"
			/>
		);
	}
	return (
		<div className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 opacity-50">
			<div className="size-6 animate-pulse rounded-full bg-bg-deep" />
			<div className="h-3 flex-1 animate-pulse rounded bg-bg-deep" />
		</div>
	);
}

function UserAvatar({
	initial,
	imageUrl,
	size,
}: {
	initial: string;
	imageUrl: string | null;
	size: number;
}) {
	if (imageUrl) {
		return (
			<img
				src={imageUrl}
				alt=""
				width={size}
				height={size}
				aria-hidden="true"
				className="shrink-0 rounded-full object-cover"
				style={{ width: size, height: size }}
			/>
		);
	}
	return <Avatar initial={initial} size={size} />;
}

function getUserInitial(
	firstName: string,
	lastName: string,
	email: string,
): string {
	const first = firstName.charAt(0);
	const last = lastName.charAt(0);
	if (first && last) return `${first}${last}`.toUpperCase();
	if (first) return first.toUpperCase();
	if (last) return last.toUpperCase();
	if (email) return email.charAt(0).toUpperCase();
	return "·";
}
