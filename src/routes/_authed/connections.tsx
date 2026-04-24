import { createFileRoute, useRouter } from "@tanstack/react-router";
import { AlertCircle, Link2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge, type BadgeTone } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import {
	PLATFORM_LABELS,
	type Platform,
	PlatformIcon,
} from "#/components/ui/platform-icon";
import { timeAgoFr } from "#/lib/dates";
import type { ConnectionSummary } from "#/server/db/queries/connections";
import {
	disconnectConnection,
	listConnections,
} from "#/server/fns/connections";
import { listEstablishments } from "#/server/fns/establishments";
import { startGoogleConnect } from "#/server/fns/oauth-google";

type ConnectionState = "connected" | "disconnected" | "expired" | "soon";

type PlatformRowData = {
	readonly platform: Platform;
	readonly description: string;
	readonly state: ConnectionState;
	/** ID de la ligne DB — présent uniquement si `connected`/`expired`. */
	readonly connectionId?: string | undefined;
	/** Nombre d'établissements liés à cette connexion. */
	readonly linkedCount: number;
	/** Dernière synchro (si `connected`). */
	readonly lastSyncedAt: Date | null;
};

export const Route = createFileRoute("/_authed/connections")({
	loader: async () => {
		const [connections, establishments] = await Promise.all([
			listConnections(),
			listEstablishments(),
		]);
		return { connections, establishments };
	},
	component: ConnectionsPage,
});

function ConnectionsPage() {
	const { connections, establishments } = Route.useLoaderData();

	const linkedEstablishmentsByPlatform = {
		google: establishments.filter((e) => e.googleLocationName !== null).length,
		tripadvisor: 0,
		trustpilot: 0,
		thefork: 0,
	} as const;

	const googleConnection = connections.find((c) => c.platform === "google");

	const rows: readonly PlatformRowData[] = [
		{
			platform: "google",
			description: "Récupération des avis et publication des réponses",
			state: deriveGoogleState(googleConnection),
			connectionId: googleConnection?.id,
			linkedCount: linkedEstablishmentsByPlatform.google,
			lastSyncedAt: googleConnection?.lastSyncedAt ?? null,
		},
		{
			platform: "tripadvisor",
			description: "Avis restaurants, hôtels et attractions",
			state: "soon",
			linkedCount: 0,
			lastSyncedAt: null,
		},
		{
			platform: "trustpilot",
			description: "Avis de consommateurs · B2C",
			state: "soon",
			linkedCount: 0,
			lastSyncedAt: null,
		},
		{
			platform: "thefork",
			description: "Réservations et avis restaurants",
			state: "soon",
			linkedCount: 0,
			lastSyncedAt: null,
		},
	];

	return (
		<div className="mx-auto max-w-[880px] px-10 py-8">
			<div className="font-mono text-[12px] text-ink-mute uppercase tracking-[0.08em]">
				Connexions
			</div>
			<h1
				className="m-[6px_0_4px] font-serif font-normal text-ink tracking-[-0.02em]"
				style={{ fontSize: 40 }}
			>
				Plateformes.
			</h1>
			<p className="m-[0_0_32px] text-[14px] text-ink-soft">
				Connectez vos comptes pour récupérer vos avis automatiquement.
			</p>

			<div className="flex flex-col gap-2.5">
				{rows.map((row) => (
					<PlatformRow key={row.platform} row={row} />
				))}
			</div>

			<Card padding={22} tone="cream" className="mt-7">
				<div className="mb-3.5 flex items-center gap-2">
					<Sparkles size={16} strokeWidth={1.75} />
					<div className="font-serif text-[20px]">Comment ça marche ?</div>
				</div>
				<div
					className="grid gap-[18px]"
					style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
				>
					{[
						{
							n: "01",
							title: "Accès en lecture",
							desc: "Avizio récupère vos avis toutes les 6 heures, sans polluer votre compte.",
						},
						{
							n: "02",
							title: "Droit de publication",
							desc: "Vous gardez la main — nous publions uniquement après votre validation.",
						},
						{
							n: "03",
							title: "Rien d'autre",
							desc: "Aucune autre donnée collectée. Révocable en un clic depuis le compte source.",
						},
					].map((b) => (
						<div key={b.n}>
							<div className="mb-1.5 font-mono text-[10.5px] text-ink-mute uppercase tracking-[0.08em]">
								{b.n}
							</div>
							<div className="mb-1 font-medium text-[13px]">{b.title}</div>
							<div className="text-[12.5px] text-ink-soft leading-[1.5]">
								{b.desc}
							</div>
						</div>
					))}
				</div>
				<div className="mt-[18px] border-line-soft border-t pt-3.5 text-[12.5px]">
					<a href="/legal/privacy" className="text-accent-ink hover:underline">
						Lire notre politique de confidentialité →
					</a>
				</div>
			</Card>
		</div>
	);
}

/*
  Dérive l'état affiché pour Google depuis la `ConnectionSummary`.
  La DB n'a pas de flag « expired » explicite — on le calcule à partir
  de `accessTokenExpiresAt` + dernière erreur de sync. Approximation
  suffisante pour déclencher la bonne UX (reconnect plutôt que connect).
*/
function deriveGoogleState(
	conn: ConnectionSummary | undefined,
): ConnectionState {
	if (!conn) return "disconnected";
	if (conn.lastSyncError) return "expired";
	const now = Date.now();
	if (
		conn.accessTokenExpiresAt &&
		conn.accessTokenExpiresAt.getTime() < now - 7 * 24 * 60 * 60_000
	) {
		// Access token expiré depuis plus d'une semaine + aucune
		// tentative de refresh réussie (sinon lastSyncedAt aurait bougé) →
		// on considère la connexion comme expirée.
		if (
			!conn.lastSyncedAt ||
			conn.lastSyncedAt.getTime() < now - 7 * 24 * 60 * 60_000
		) {
			return "expired";
		}
	}
	return "connected";
}

const STATE_META: Record<ConnectionState, { label: string; tone: BadgeTone }> =
	{
		connected: { label: "Connectée", tone: "green" },
		disconnected: { label: "Non connectée", tone: "neutral" },
		expired: { label: "Expirée", tone: "rose" },
		soon: { label: "Bientôt", tone: "gold" },
	};

function PlatformRow({ row }: { row: PlatformRowData }) {
	const meta = STATE_META[row.state];
	const label = PLATFORM_LABELS[row.platform];

	const metaLine =
		row.state === "connected"
			? `${row.linkedCount} établissement${row.linkedCount > 1 ? "s" : ""} lié${row.linkedCount > 1 ? "s" : ""}${
					row.lastSyncedAt
						? ` · Dernière sync ${timeAgoFr(row.lastSyncedAt)}`
						: " · Pas encore synchronisé"
				}`
			: row.state === "soon"
				? "Non disponible — en attente d'accès plateforme"
				: row.state === "expired"
					? "La connexion a expiré. Reconnectez pour reprendre la synchro."
					: row.description;

	return (
		<Card padding={0} className="overflow-hidden">
			<div
				className="flex items-center gap-4 px-[22px] py-[18px]"
				style={{ opacity: row.state === "soon" ? 0.85 : 1 }}
			>
				<div className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-bg-deep">
					<PlatformIcon platform={row.platform} size={28} />
				</div>
				<div className="min-w-0 flex-1">
					<div className="mb-[3px] flex items-center gap-2.5">
						<div className="font-serif text-[20px] tracking-[-0.01em] leading-[1.15]">
							{label}
						</div>
						<Badge tone={meta.tone}>{meta.label}</Badge>
						{row.state === "soon" ? (
							<span
								title="Approbation en cours avec la plateforme"
								className="inline-flex cursor-help items-center gap-1 text-[11px] text-ink-mute"
							>
								<AlertCircle size={12} strokeWidth={1.75} />
								En cours d'approbation
							</span>
						) : null}
					</div>
					<div className="text-[12.5px] text-ink-soft">{metaLine}</div>
				</div>
				<div className="flex shrink-0 gap-2">
					<RowActions row={row} />
				</div>
			</div>

			{row.state === "connected" ? <ConnectedFooter /> : null}
		</Card>
	);
}

function ConnectedFooter() {
	return (
		<div className="flex items-center justify-between border-line-soft border-t bg-bg-deep px-[22px] py-2.5 text-[11.5px] text-ink-mute">
			<div className="flex items-center gap-3">
				<IndicatorDot label="Lecture avis · OK" />
				<IndicatorDot label="Publication réponses · en attente d'approbation Google" />
			</div>
		</div>
	);
}

function IndicatorDot({ label }: { label: string }) {
	return (
		<span className="inline-flex items-center gap-1.5">
			<span className="size-1.5 rounded-full bg-green" />
			{label}
		</span>
	);
}

function RowActions({ row }: { row: PlatformRowData }) {
	const router = useRouter();
	const [connecting, setConnecting] = useState(false);
	const [disconnecting, setDisconnecting] = useState(false);

	const startOAuth = async () => {
		setConnecting(true);
		const result = await startGoogleConnect();
		// Full-page nav vers la consent screen Google — on quitte la SPA
		// pour que Clerk cookies + fresh GET survivent au round-trip.
		window.location.href = result.url;
	};

	const disconnect = async () => {
		if (!row.connectionId) return;
		const confirmed = window.confirm(
			`Déconnecter ${PLATFORM_LABELS[row.platform]} ? Les avis déjà récupérés restent en base, mais la synchronisation s'arrête.`,
		);
		if (!confirmed) return;
		setDisconnecting(true);
		const result = await disconnectConnection({
			data: { id: row.connectionId },
		});
		setDisconnecting(false);
		if (result.kind === "ok") {
			await router.invalidate();
			return;
		}
		window.alert(
			result.kind === "not_found"
				? "Cette connexion n'existe plus."
				: result.kind === "unauthenticated"
					? "Votre session a expiré."
					: "Impossible de déconnecter. Réessayez.",
		);
	};

	if (row.state === "connected") {
		return (
			<>
				<Button
					variant="ghost"
					size="sm"
					onClick={disconnect}
					disabled={disconnecting}
				>
					{disconnecting ? "…" : "Déconnecter"}
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={startOAuth}
					disabled={connecting}
				>
					{connecting ? "…" : "Reconnecter"}
				</Button>
			</>
		);
	}

	if (row.state === "expired") {
		return (
			<Button
				variant="accent"
				size="sm"
				icon={<Link2 size={14} strokeWidth={1.75} />}
				onClick={startOAuth}
				disabled={connecting}
			>
				{connecting ? "…" : "Reconnecter"}
			</Button>
		);
	}

	if (row.state === "disconnected") {
		return (
			<Button
				variant="accent"
				size="sm"
				icon={<Link2 size={14} strokeWidth={1.75} />}
				onClick={startOAuth}
				disabled={connecting}
			>
				{connecting ? "Redirection…" : "Se connecter"}
			</Button>
		);
	}

	// `soon` — bouton disabled « M'avertir ». Pas de handler branché pour
	// l'instant — on collectera les emails quand on aura une liste d'attente.
	return (
		<Button variant="outline" size="sm" disabled>
			M'avertir
		</Button>
	);
}
