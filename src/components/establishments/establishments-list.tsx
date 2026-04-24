import { Link } from "@tanstack/react-router";
import { ChevronRight, Plus, Star } from "lucide-react";
import { PlatformIcon } from "#/components/ui/platform-icon";
import type {
	EstablishmentSummary,
	Tone,
} from "#/server/db/queries/establishments";
import { businessTypeLabel } from "./business-types";

const TONE_LABELS: Record<Tone, string> = {
	warm: "Chaleureux",
	professional: "Professionnel",
	direct: "Direct",
};

type Props = {
	readonly establishments: readonly EstablishmentSummary[];
};

/**
 * Grille d'établissements avec tuile d'ajout en fin de liste.
 * Responsive native via `auto-fill minmax(320px, 1fr)` — 4 colonnes
 * desktop wide, 3 moyen, 2 tablette, 1 mobile, aucun media query.
 *
 * La tuile d'ajout sert aussi d'empty state : quand la grille est
 * vide, elle est visuellement centrée et contextuellement mise en
 * valeur (c'est la seule action possible). Pas d'empty state séparé
 * à maintenir — la tuile suffit.
 */
export function EstablishmentsList({ establishments }: Props) {
	return (
		<div
			className="grid gap-4"
			style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
		>
			{establishments.map((est) => (
				<EstablishmentCard key={est.id} est={est} />
			))}
			<AddTile />
		</div>
	);
}

function EstablishmentCard({ est }: { est: EstablishmentSummary }) {
	// Statut connexion Google : on a la donnée côté `googleLocationName`,
	// les deux autres plateformes sont gardées en gris (non dispo tant
	// qu'on n'a pas les intégrations).
	const googleConnected = est.googleLocationName !== null;
	const connections = [
		{ platform: "google" as const, connected: googleConnected },
		{ platform: "tripadvisor" as const, connected: false },
		{ platform: "trustpilot" as const, connected: false },
	];
	const connectedCount = connections.filter((c) => c.connected).length;

	return (
		<Link
			to="/establishments/$id"
			params={{ id: est.id }}
			className="group block overflow-hidden rounded-[16px] border border-line-soft bg-paper shadow-sm transition-all duration-[120ms] hover:border-line hover:shadow-[var(--shadow)]"
		>
			{/* Top — monogramme + titre + chevron */}
			<div className="flex items-start gap-3.5 p-[20px_22px_18px]">
				<div className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-bg-deep font-serif text-[24px] text-accent-ink italic">
					{est.name.charAt(0).toUpperCase()}
				</div>
				<div className="min-w-0 flex-1">
					<div className="font-serif text-[20px] leading-[1.15] tracking-[-0.01em]">
						{est.name}
					</div>
					<div className="mt-1 text-[12px] text-ink-mute">
						{businessTypeLabel(est.businessType)} · {est.city}
					</div>
				</div>
				<ChevronRight
					size={16}
					strokeWidth={1.75}
					className="mt-1 shrink-0 text-ink-mute"
				/>
			</div>

			{/* Stats — note + avis + ton. Note/avis stubbés en « — » tant
			    qu'on n'a pas d'agrégat DB (count + avg rating par étab). */}
			<div className="flex gap-4 px-[22px] pb-3.5">
				<Stat label="Note">
					<span className="font-serif text-[20px] text-accent-ink">—</span>
					<Star size={12} strokeWidth={1.75} className="text-ink-mute" />
				</Stat>
				<Stat label="Avis">
					<span className="font-serif text-[20px]">—</span>
				</Stat>
				<Stat label="Ton">
					<span className="font-medium text-[13.5px]">
						{TONE_LABELS[est.defaultTone]}
					</span>
				</Stat>
			</div>

			{/* Footer — connexions plateformes */}
			<div className="flex items-center justify-between border-line-soft border-t bg-bg-deep px-[22px] py-2.5 text-[11.5px] text-ink-soft">
				<div className="flex items-center gap-1.5">
					{connections.map((c) => (
						<div
							key={c.platform}
							title={c.platform}
							style={{ opacity: c.connected ? 1 : 0.3 }}
						>
							<PlatformIcon platform={c.platform} size={16} />
						</div>
					))}
				</div>
				<span>{connectedCount}/3 connectées</span>
			</div>
		</Link>
	);
}

function Stat({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div>
			<div className="font-mono text-[10.5px] text-ink-mute uppercase tracking-[0.06em]">
				{label}
			</div>
			<div className="mt-0.5 flex items-center gap-1.5">{children}</div>
		</div>
	);
}

function AddTile() {
	return (
		<Link
			to="/establishments/new"
			className="group flex min-h-[230px] cursor-pointer flex-col items-center justify-center rounded-[16px] border-[1.5px] border-line border-dashed bg-transparent text-ink-mute transition-colors duration-[120ms] hover:border-accent hover:bg-accent-soft hover:text-accent-ink"
		>
			<div className="mb-3 flex size-12 items-center justify-center rounded-full border-[1.5px] border-current">
				<Plus size={20} strokeWidth={1.75} />
			</div>
			<div className="font-serif text-[18px]">Nouvel établissement</div>
			<div className="mt-1.5 text-[12px]">29 € / mois · essai inclus</div>
		</Link>
	);
}
