import {
	useOrganization,
	useOrganizationList,
} from "@clerk/tanstack-react-start";
import { useRouter } from "@tanstack/react-router";
import { Check, ChevronDown, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";

type Props = {
	/** Nombre d'établissements dans l'org active — affiché dans la meta line. */
	readonly establishmentsCount: number;
	/** Libellé de plan. `null` tant que Stripe n'est pas branché. */
	readonly planLabel: string | null;
};

/**
 * OrganizationSwitcher maison. Remplace `<OrganizationSwitcher>` de Clerk
 * pour matcher la maquette au pixel près — carte paper avec monogramme
 * serif terracotta, nom + meta (« N établissement(s) · Plan »), chevron.
 *
 * La logique (liste des memberships, switch actif, création) s'appuie
 * sur les hooks Clerk (`useOrganizationList`, `useOrganization`). Le
 * popover est géré localement (useState + click-outside + Escape) —
 * pas de lib de menu externe, l'interaction est assez simple pour que
 * le coût de Radix/HeadlessUI ne vaille pas le payload ici.
 */
export function OrgSwitcher({ establishmentsCount, planLabel }: Props) {
	const router = useRouter();
	const { organization } = useOrganization();
	const orgList = useOrganizationList({ userMemberships: true });

	const [open, setOpen] = useState(false);
	const [creating, setCreating] = useState(false);
	const [switchingTo, setSwitchingTo] = useState<string | null>(null);
	const rootRef = useRef<HTMLDivElement | null>(null);

	// Fermeture automatique : clic hors du root + Escape. On n'utilise pas
	// un outside-click sur window.click parce que ça interfère avec les
	// clicks sur les autres menus Clerk (UserButton). mousedown sur le
	// document cible plus finement.
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

	if (!organization || !orgList.isLoaded) {
		return <TriggerSkeleton />;
	}

	const memberships = orgList.userMemberships.data ?? [];
	const metaLine = buildMetaLine(establishmentsCount, planLabel);

	const onPickOrg = async (orgId: string) => {
		if (!orgList.setActive) return;
		if (orgId === organization.id) {
			setOpen(false);
			return;
		}
		setSwitchingTo(orgId);
		await orgList.setActive({ organization: orgId });
		await router.invalidate();
		setSwitchingTo(null);
		setOpen(false);
	};

	return (
		<div ref={rootRef} className="relative">
			<button
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center gap-2.5 rounded-[10px] border border-line-soft bg-paper px-3 py-2.5 text-left shadow-sm outline-none transition-colors hover:bg-bg-deep focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
			>
				<OrgMonogram name={organization.name} size={28} />
				<div className="min-w-0 flex-1">
					<div className="truncate font-medium text-[12.5px] text-ink">
						{organization.name}
					</div>
					<div className="truncate text-[10.5px] text-ink-mute">{metaLine}</div>
				</div>
				<ChevronDown
					size={14}
					strokeWidth={1.75}
					aria-hidden="true"
					className={[
						"shrink-0 text-ink-mute transition-transform duration-[120ms]",
						open ? "rotate-180" : "",
					].join(" ")}
				/>
			</button>

			{open ? (
				<div
					role="menu"
					aria-label="Changer d'organisation"
					className="absolute top-[calc(100%+6px)] right-0 left-0 z-[20] overflow-hidden rounded-[10px] border border-line-soft bg-paper shadow-[var(--shadow-lg)]"
				>
					<div className="flex max-h-[260px] flex-col gap-0.5 overflow-y-auto p-1">
						{memberships.map((m) => {
							const isActive = m.organization.id === organization.id;
							const isSwitching = switchingTo === m.organization.id;
							return (
								<button
									key={m.organization.id}
									type="button"
									role="menuitem"
									onClick={() => void onPickOrg(m.organization.id)}
									disabled={isSwitching}
									className={[
										"flex w-full items-center gap-2 rounded-md px-2 py-2 text-left outline-none transition-colors hover:bg-bg-deep focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px] disabled:opacity-60",
										isActive ? "bg-bg-deep/60" : "",
									].join(" ")}
								>
									<OrgMonogram name={m.organization.name} size={24} />
									<span className="min-w-0 flex-1 truncate font-medium text-[12.5px] text-ink">
										{m.organization.name}
									</span>
									{isActive ? (
										<Check
											size={14}
											strokeWidth={2}
											className="shrink-0 text-accent"
										/>
									) : null}
								</button>
							);
						})}
					</div>

					<div className="border-line-soft border-t">
						<button
							type="button"
							role="menuitem"
							onClick={() => {
								setCreating(true);
								setOpen(false);
							}}
							className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12.5px] text-ink-soft outline-none transition-colors hover:bg-bg-deep focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px]"
						>
							<Plus size={14} strokeWidth={1.75} aria-hidden="true" />
							Créer une organisation
						</button>
					</div>
				</div>
			) : null}

			{creating ? (
				<CreateOrganizationModal
					onClose={() => setCreating(false)}
					onCreated={async (orgId) => {
						setCreating(false);
						await router.invalidate();
						// setActive a déjà été appelé côté modale, un invalidate
						// remonte l'état (establishments count…) sur la nouvelle org.
						void orgId;
					}}
				/>
			) : null}
		</div>
	);
}

function buildMetaLine(count: number, planLabel: string | null): string {
	const establishments =
		count === 0
			? "0 établissement"
			: count === 1
				? "1 établissement"
				: `${count} établissements`;
	if (!planLabel) return establishments;
	return `${establishments} · ${planLabel}`;
}

function TriggerSkeleton() {
	return (
		<div className="flex w-full items-center gap-2.5 rounded-[10px] border border-line-soft bg-paper px-3 py-2.5 opacity-50 shadow-sm">
			<div className="size-[28px] animate-pulse rounded-[7px] bg-bg-deep" />
			<div className="flex-1 space-y-1">
				<div className="h-3 w-24 animate-pulse rounded bg-bg-deep" />
				<div className="h-2 w-32 animate-pulse rounded bg-bg-deep" />
			</div>
		</div>
	);
}

type MonogramProps = {
	readonly name: string;
	readonly size: number;
};

/*
  Monogramme serif italique sur fond accent — signature visuelle de
  l'app pour tout ce qui identifie une organisation. Rectangulaire avec
  coins arrondis (vs. Avatar utilisateur qui est rond). Première lettre
  du nom en minuscule pour matcher la maquette (le "p" de "La Maison
  Pléiade" est plus élégant que "L" en bold).
*/
function OrgMonogram({ name, size }: MonogramProps) {
	const letter = name.trim().charAt(0).toLowerCase() || "·";
	return (
		<div
			aria-hidden="true"
			className="flex shrink-0 items-center justify-center rounded-[7px] bg-accent font-serif text-bg italic"
			style={{ width: size, height: size, fontSize: Math.round(size * 0.57) }}
		>
			{letter}
		</div>
	);
}

type CreateOrgModalProps = {
	readonly onClose: () => void;
	readonly onCreated: (orgId: string) => Promise<void> | void;
};

/**
 * Modale de création d'organisation. Overlay cream + carte paper
 * centrée, même squelette que `ResponseHistoryDrawer` (backdrop bouton
 * pour a11y, Escape pour fermer). Submit = `createOrganization` Clerk
 * puis `setActive` pour que l'app bascule tout de suite dessus.
 */
function CreateOrganizationModal({ onClose, onCreated }: CreateOrgModalProps) {
	const orgList = useOrganizationList({ userMemberships: true });
	const inputId = useId();
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	const canSubmit = name.trim().length > 0 && !busy;

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!canSubmit) return;
		if (!orgList.createOrganization || !orgList.setActive) {
			setError("Chargement de Clerk en cours, réessaie dans un instant.");
			return;
		}
		setBusy(true);
		setError(null);
		// Clerk throw côté SDK (nom déjà pris, rate limit, réseau…). On wrap
		// à la frontière — c'est l'exception tolérée par la règle « no
		// try/catch » du repo (cf. CLAUDE.md §2).
		try {
			const created = await orgList.createOrganization({ name: name.trim() });
			await orgList.setActive({ organization: created.id });
			setBusy(false);
			await onCreated(created.id);
		} catch (err) {
			setBusy(false);
			setError(
				err instanceof Error && err.message
					? err.message
					: "Impossible de créer l'organisation. Réessaie.",
			);
		}
	};

	return (
		<div className="fixed inset-0 z-[60]">
			<button
				type="button"
				onClick={onClose}
				aria-label="Fermer la création d'organisation"
				className="absolute inset-0 cursor-default border-none bg-[oklch(0.2_0.01_60_/_0.35)]"
			/>
			<div
				role="dialog"
				aria-label="Créer une organisation"
				aria-modal="true"
				className="animate-fade-up -translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 w-[min(92vw,420px)] rounded-[16px] border border-line-soft bg-paper p-6 shadow-[var(--shadow-lg)]"
			>
				<div className="mb-1 font-mono text-[11px] text-ink-mute uppercase tracking-[0.08em]">
					Nouvelle organisation
				</div>
				<div className="mb-5 font-serif font-normal text-[24px] text-ink tracking-[-0.01em]">
					Un autre espace pour vos avis.
				</div>

				<form onSubmit={onSubmit} noValidate>
					<label
						htmlFor={inputId}
						className="mb-1.5 block text-[12.5px] text-ink-soft"
					>
						Nom
					</label>
					<Input
						id={inputId}
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Ex. Le Comptoir du Marché"
						autoFocus
						disabled={busy}
					/>

					{error ? (
						<p className="mt-2 rounded-md bg-[oklch(0.95_0.03_25)] px-3 py-2 text-[12.5px] text-[oklch(0.4_0.12_25)]">
							{error}
						</p>
					) : null}

					<div className="mt-5 flex justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							size="md"
							onClick={onClose}
							disabled={busy}
						>
							Annuler
						</Button>
						<Button
							type="submit"
							variant="accent"
							size="md"
							disabled={!canSubmit}
						>
							{busy ? "Création…" : "Créer"}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}
