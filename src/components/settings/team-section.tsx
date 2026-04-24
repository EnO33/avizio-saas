import { useOrganization, useUser } from "@clerk/tanstack-react-start";
import { zodResolver } from "@hookform/resolvers/zod";
import { MoreHorizontal, Send, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Avatar } from "#/components/ui/avatar";
import { Badge, type BadgeTone } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Field } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { timeAgoFr } from "#/lib/dates";

const ROLE_OPTIONS = [
	{ value: "org:admin", label: "Admin" },
	{ value: "org:member", label: "Membre" },
] as const;

type RoleValue = (typeof ROLE_OPTIONS)[number]["value"];

const ROLE_META: Record<string, { label: string; tone: BadgeTone }> = {
	"org:admin": { label: "Admin", tone: "accent" },
	"org:member": { label: "Membre", tone: "neutral" },
};

const inviteSchema = z.object({
	email: z.string().trim().email("Email invalide"),
	role: z.enum(["org:admin", "org:member"]),
});

type InviteValues = z.infer<typeof inviteSchema>;

/**
 * Section « Équipe » — gère les membres de l'organisation active côté
 * Clerk (pas de base DB locale) : liste des memberships, invitations en
 * attente, invitation d'un nouveau membre, retrait. L'user courant voit
 * un bouton « Quitter » sur sa propre ligne ; les actions admin (retirer,
 * changer le rôle) sont gatées par `organization.membership.role`.
 *
 * Chaque mutation revalide memberships + invitations côté Clerk pour que
 * la liste se rafraîchisse immédiatement sans reload.
 */
export function TeamSection() {
	const org = useOrganization({
		memberships: { pageSize: 50 },
		invitations: { pageSize: 50 },
	});
	const { user } = useUser();

	if (!org.organization || !user) {
		return (
			<section id="team" data-settings-section>
				<Card padding={24}>
					<h2 className="mb-1 font-serif font-normal text-[22px]">Équipe</h2>
					<p className="m-0 text-[13px] text-ink-mute">Chargement…</p>
				</Card>
			</section>
		);
	}

	const currentRole = org.membership?.role ?? "org:member";
	const isAdmin = currentRole === "org:admin";

	const refresh = async () => {
		await Promise.all([
			org.memberships?.revalidate?.(),
			org.invitations?.revalidate?.(),
		]);
	};

	const memberships = org.memberships?.data ?? [];
	const invitations = (org.invitations?.data ?? []).filter(
		(inv) => inv.status === "pending",
	);

	return (
		<section id="team" data-settings-section>
			<div className="flex flex-col gap-6">
				<IntroCard memberCount={memberships.length} isAdmin={isAdmin} />
				{isAdmin ? <InviteMemberCard onInvited={refresh} /> : null}
				<MembersList
					memberships={memberships}
					currentUserId={user.id}
					isAdmin={isAdmin}
					onChanged={refresh}
				/>
				{invitations.length > 0 ? (
					<PendingInvitationsList
						invitations={invitations}
						isAdmin={isAdmin}
						onChanged={refresh}
					/>
				) : null}
			</div>
		</section>
	);
}

function IntroCard({
	memberCount,
	isAdmin,
}: {
	memberCount: number;
	isAdmin: boolean;
}) {
	return (
		<Card padding={24}>
			<h2 className="mb-1 font-serif font-normal text-[22px]">Équipe</h2>
			<p className="m-0 text-[13px] text-ink-mute leading-[1.55]">
				{memberCount === 1
					? "Vous êtes la seule personne sur cet espace Avizio."
					: `${memberCount} personnes ont accès à cet espace. Tous les membres voient tous les établissements — on ajoutera une granularité per-établissement quand le besoin se présentera.`}
				{!isAdmin
					? " Seul un admin peut inviter ou retirer des membres."
					: null}
			</p>
		</Card>
	);
}

function InviteMemberCard({ onInvited }: { onInvited: () => Promise<void> }) {
	const { organization } = useOrganization();
	const emailId = useId();
	const roleId = useId();
	const [justSent, setJustSent] = useState<string | null>(null);

	const form = useForm<InviteValues>({
		resolver: zodResolver(inviteSchema),
		defaultValues: { email: "", role: "org:member" },
	});

	if (!organization) return null;

	const isSubmitting = form.formState.isSubmitting;
	const rootError = form.formState.errors.root?.message;

	const handle = async (values: InviteValues) => {
		form.clearErrors("root");
		try {
			await organization.inviteMember({
				emailAddress: values.email.trim(),
				role: values.role,
			});
			setJustSent(values.email.trim());
			form.reset({ email: "", role: values.role });
			await onInvited();
			// Le toast reste ~4s
			setTimeout(() => setJustSent(null), 4000);
		} catch (err) {
			form.setError("root", {
				message:
					err instanceof Error && err.message
						? err.message
						: "Impossible d'envoyer l'invitation.",
			});
		}
	};

	return (
		<Card padding={24}>
			<h3 className="mb-1 font-serif font-normal text-[18px]">
				Inviter un membre
			</h3>
			<p className="mb-4 text-[13px] text-ink-mute leading-[1.5]">
				Clerk envoie l'email d'invitation. La personne rejoint l'organisation
				dès qu'elle accepte.
			</p>

			<form
				onSubmit={form.handleSubmit(handle)}
				className="flex flex-col gap-3 sm:flex-row sm:items-end"
				noValidate
			>
				<div className="flex-1">
					<Field label="Email" htmlFor={emailId}>
						<Input
							id={emailId}
							type="email"
							placeholder="prenom@exemple.fr"
							autoComplete="off"
							{...form.register("email")}
						/>
					</Field>
					{form.formState.errors.email?.message ? (
						<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
							{form.formState.errors.email.message}
						</p>
					) : null}
				</div>

				<div className="sm:w-[160px]">
					<Field label="Rôle" htmlFor={roleId}>
						<select
							id={roleId}
							{...form.register("role")}
							className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0"
						>
							{ROLE_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</Field>
				</div>

				<Button
					type="submit"
					variant="accent"
					size="md"
					icon={<Send size={14} strokeWidth={1.75} />}
					disabled={isSubmitting}
				>
					{isSubmitting ? "Envoi…" : "Inviter"}
				</Button>
			</form>

			{rootError ? (
				<p className="mt-3 rounded-md bg-[oklch(0.95_0.03_25)] px-3 py-2 text-[12.5px] text-[oklch(0.4_0.12_25)]">
					{rootError}
				</p>
			) : null}
			{justSent ? (
				<p className="mt-3 rounded-md bg-[oklch(0.96_0.03_150)] px-3 py-2 text-[12.5px] text-green">
					Invitation envoyée à {justSent}.
				</p>
			) : null}
		</Card>
	);
}

type MembershipLike = {
	readonly id: string;
	readonly role: string;
	readonly createdAt?: Date | undefined;
	readonly publicUserData?:
		| {
				readonly userId?: string | null;
				readonly firstName?: string | null;
				readonly lastName?: string | null;
				readonly identifier?: string;
				readonly imageUrl?: string;
		  }
		| null
		| undefined;
	readonly destroy: () => Promise<unknown>;
	readonly update: (params: { role: string }) => Promise<unknown>;
};

function MembersList({
	memberships,
	currentUserId,
	isAdmin,
	onChanged,
}: {
	memberships: readonly MembershipLike[];
	currentUserId: string;
	isAdmin: boolean;
	onChanged: () => Promise<void>;
}) {
	return (
		<Card padding={0}>
			<div className="border-line-soft border-b px-[22px] py-[14px]">
				<h3 className="m-0 font-serif font-normal text-[18px]">Membres</h3>
			</div>
			<ul className="m-0 flex list-none flex-col p-0">
				{memberships.map((m) => (
					<MemberRow
						key={m.id}
						membership={m}
						isSelf={m.publicUserData?.userId === currentUserId}
						isAdmin={isAdmin}
						onChanged={onChanged}
					/>
				))}
			</ul>
		</Card>
	);
}

function MemberRow({
	membership,
	isSelf,
	isAdmin,
	onChanged,
}: {
	membership: MembershipLike;
	isSelf: boolean;
	isAdmin: boolean;
	onChanged: () => Promise<void>;
}) {
	const { organization } = useOrganization();
	const [busy, setBusy] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const menuRootRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!menuOpen) return;
		const onDown = (e: MouseEvent) => {
			if (!menuRootRef.current) return;
			if (menuRootRef.current.contains(e.target as Node)) return;
			setMenuOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setMenuOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [menuOpen]);

	const pud = membership.publicUserData ?? null;
	const firstName = pud?.firstName ?? "";
	const lastName = pud?.lastName ?? "";
	const fullName = `${firstName} ${lastName}`.trim();
	const email = pud?.identifier ?? "";
	const displayName = fullName.length > 0 ? fullName : email;
	const initial = getInitial(firstName, lastName, email);
	const meta = ROLE_META[membership.role] ?? {
		label: membership.role,
		tone: "neutral" as const,
	};

	const onRemove = async () => {
		if (!organization) return;
		setBusy(true);
		setMenuOpen(false);
		try {
			await membership.destroy();
			await onChanged();
		} catch {
			/* l'UI reflète Clerk au prochain revalidate */
		} finally {
			setBusy(false);
		}
	};

	const onLeave = async () => {
		if (!organization) return;
		const confirmed = window.confirm(
			"Quitter cette organisation ? Vous perdez l'accès à tous ses établissements.",
		);
		if (!confirmed) return;
		setBusy(true);
		setMenuOpen(false);
		try {
			// Quitter = détruire sa propre membership côté Clerk. Pas d'API
			// `organization.leave()` séparée — c'est le même endpoint que
			// « l'admin me retire », différence juste dans l'UX qui suit.
			await membership.destroy();
			// Clerk éjecte la session d'org active ; on navigue en hard pour
			// forcer Clerk à rehydrate sans org, puis le guard _authed
			// bascule sur /onboarding si vraiment plus rien, sinon le
			// switcher proposera les autres orgs dispos.
			window.location.href = "/onboarding";
		} catch {
			setBusy(false);
		}
	};

	const onChangeRole = async (role: RoleValue) => {
		setBusy(true);
		setMenuOpen(false);
		try {
			await membership.update({ role });
			await onChanged();
		} catch {
			/* no-op */
		} finally {
			setBusy(false);
		}
	};

	const showActions = (isAdmin && !isSelf) || isSelf;

	return (
		<li className="flex items-center gap-3 border-line-soft border-b px-[22px] py-3 last:border-b-0">
			<Avatar initial={initial} size={34} />
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<span className="truncate font-medium text-[13.5px]">
						{displayName}
					</span>
					{isSelf ? (
						<span className="text-[11.5px] text-ink-mute">(vous)</span>
					) : null}
					<Badge tone={meta.tone}>{meta.label}</Badge>
				</div>
				{email && fullName ? (
					<div className="truncate text-[11.5px] text-ink-mute">{email}</div>
				) : null}
			</div>

			{showActions ? (
				<div ref={menuRootRef} className="relative shrink-0">
					<button
						type="button"
						onClick={() => setMenuOpen((v) => !v)}
						disabled={busy}
						aria-label="Options"
						aria-haspopup="menu"
						aria-expanded={menuOpen}
						className="inline-flex size-8 items-center justify-center rounded-md text-ink-mute outline-none transition-colors hover:bg-bg-deep hover:text-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50"
					>
						<MoreHorizontal size={16} strokeWidth={1.75} />
					</button>

					{menuOpen ? (
						<div
							role="menu"
							className="absolute top-[calc(100%+4px)] right-0 z-[10] min-w-[200px] overflow-hidden rounded-lg border border-line-soft bg-paper shadow-[var(--shadow-lg)]"
						>
							{isAdmin && !isSelf ? (
								<>
									{membership.role !== "org:admin" ? (
										<MenuItem onClick={() => void onChangeRole("org:admin")}>
											Passer admin
										</MenuItem>
									) : null}
									{membership.role !== "org:member" ? (
										<MenuItem onClick={() => void onChangeRole("org:member")}>
											Rétrograder en membre
										</MenuItem>
									) : null}
									<div className="border-line-soft border-t" />
									<MenuItem onClick={() => void onRemove()} tone="danger">
										Retirer de l'organisation
									</MenuItem>
								</>
							) : null}
							{isSelf ? (
								<MenuItem onClick={() => void onLeave()} tone="danger">
									Quitter l'organisation
								</MenuItem>
							) : null}
						</div>
					) : null}
				</div>
			) : null}
		</li>
	);
}

function MenuItem({
	children,
	onClick,
	tone = "neutral",
}: {
	children: React.ReactNode;
	onClick: () => void;
	tone?: "neutral" | "danger";
}) {
	return (
		<button
			type="button"
			role="menuitem"
			onClick={onClick}
			className={[
				"block w-full px-3 py-2 text-left text-[12.5px] outline-none transition-colors hover:bg-bg-deep focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px]",
				tone === "danger" ? "text-[oklch(0.5_0.14_25)]" : "text-ink",
			].join(" ")}
		>
			{children}
		</button>
	);
}

type InvitationLike = {
	readonly id: string;
	readonly emailAddress: string;
	readonly role: string;
	readonly status: string;
	readonly createdAt: Date;
	readonly revoke: () => Promise<unknown>;
};

function PendingInvitationsList({
	invitations,
	isAdmin,
	onChanged,
}: {
	invitations: readonly InvitationLike[];
	isAdmin: boolean;
	onChanged: () => Promise<void>;
}) {
	return (
		<Card padding={0}>
			<div className="border-line-soft border-b px-[22px] py-[14px]">
				<h3 className="m-0 font-serif font-normal text-[18px]">
					Invitations en attente
				</h3>
			</div>
			<ul className="m-0 flex list-none flex-col p-0">
				{invitations.map((inv) => (
					<InvitationRow
						key={inv.id}
						invitation={inv}
						isAdmin={isAdmin}
						onChanged={onChanged}
					/>
				))}
			</ul>
		</Card>
	);
}

function InvitationRow({
	invitation,
	isAdmin,
	onChanged,
}: {
	invitation: InvitationLike;
	isAdmin: boolean;
	onChanged: () => Promise<void>;
}) {
	const [busy, setBusy] = useState(false);
	const meta = ROLE_META[invitation.role] ?? {
		label: invitation.role,
		tone: "neutral" as const,
	};

	const onCancel = async () => {
		setBusy(true);
		try {
			await invitation.revoke();
			await onChanged();
		} catch {
			setBusy(false);
		}
	};

	return (
		<li className="flex items-center gap-3 border-line-soft border-b px-[22px] py-3 last:border-b-0">
			<div className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-bg-deep text-[13px] text-ink-mute">
				@
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<span className="truncate font-medium text-[13.5px]">
						{invitation.emailAddress}
					</span>
					<Badge tone={meta.tone}>{meta.label}</Badge>
				</div>
				<div className="text-[11.5px] text-ink-mute">
					Invité il y a {timeAgoFr(invitation.createdAt)}
				</div>
			</div>
			{isAdmin ? (
				<Button
					variant="ghost"
					size="sm"
					icon={<X size={14} strokeWidth={1.75} />}
					onClick={() => void onCancel()}
					disabled={busy}
				>
					{busy ? "…" : "Annuler"}
				</Button>
			) : null}
		</li>
	);
}

function getInitial(
	firstName: string,
	lastName: string,
	email: string,
): string {
	const first = firstName.trim().charAt(0);
	const last = lastName.trim().charAt(0);
	if (first && last) return `${first}${last}`.toUpperCase();
	if (first) return first.toUpperCase();
	if (last) return last.toUpperCase();
	if (email) return email.trim().charAt(0).toUpperCase();
	return "·";
}
