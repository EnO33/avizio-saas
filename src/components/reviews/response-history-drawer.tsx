import { Check, Inbox, Sparkles, X } from "lucide-react";
import { useEffect } from "react";
import { PLATFORM_LABELS } from "#/components/ui/platform-icon";
import { timeAgoFr } from "#/lib/dates";
import type { ResponseSummary } from "#/server/db/queries/responses";
import type { ReviewSummary } from "#/server/db/queries/reviews";

type Props = {
	readonly open: boolean;
	readonly review: ReviewSummary;
	readonly drafts: readonly ResponseSummary[];
	readonly onClose: () => void;
};

/**
 * Drawer d'historique côté droit. On n'a pas encore de table
 * `responseHistory` dédiée → on dérive une timeline à partir des
 * lignes existantes :
 *
 * - chaque brouillon = un événement « Avizio IA · brouillon v{N}
 *   généré (ton chaleureux) »
 * - +1 événement système en haut pour l'arrivée de l'avis
 * - si un brouillon est approuvé/publié, un événement supplémentaire
 *
 * Propre tant qu'on ne capture pas encore les éditions manuelles. Le
 * jour où on a des events plus fins, on pourra swap la dérivation
 * sans toucher à l'UI.
 */
export function ResponseHistoryDrawer({
	open,
	review,
	drafts,
	onClose,
}: Props) {
	// Esc ferme le drawer pour rester cohérent avec l'overlay cmd-palette
	// du design (même écoute globale, même geste).
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	if (!open) return null;

	const entries = buildTimeline(review, drafts);

	return (
		<div className="fixed inset-0 z-50">
			{/* Backdrop — bouton plein écran invisible. Pattern a11y correct :
			    un vrai élément interactif avec role=button qui ferme la modale,
			    plutôt qu'un div onClick qui fait râler les lecteurs d'écran. */}
			<button
				type="button"
				onClick={onClose}
				aria-label="Fermer l'historique"
				className="absolute inset-0 cursor-default border-none bg-[oklch(0.2_0.01_60_/_0.3)]"
			/>
			<aside
				className="animate-fade-up absolute top-0 right-0 bottom-0 w-[400px] border-line border-l bg-paper px-6 py-5 shadow-[var(--shadow-lg)]"
				role="dialog"
				aria-label="Historique"
				aria-modal="true"
			>
				<div className="mb-5 flex items-center justify-between">
					<div className="font-serif text-[22px]">Historique</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Fermer l'historique"
						className="border-none bg-transparent p-1"
					>
						<X size={18} strokeWidth={1.75} />
					</button>
				</div>

				<ol className="m-0 flex list-none flex-col gap-3.5 p-0">
					{entries.map((e) => {
						const Ico = e.icon;
						return (
							<li key={e.id} className="flex gap-3">
								<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-bg-deep text-ink-soft">
									<Ico size={13} strokeWidth={1.75} />
								</div>
								<div>
									<div className="font-medium text-[13px]">{e.label}</div>
									<div className="text-[11.5px] text-ink-mute">
										{e.actor} · {e.relative}
									</div>
								</div>
							</li>
						);
					})}
				</ol>
			</aside>
		</div>
	);
}

type TimelineEntry = {
	readonly id: string;
	readonly label: string;
	readonly actor: string;
	readonly relative: string;
	readonly icon: typeof Check;
};

function buildTimeline(
	review: ReviewSummary,
	drafts: readonly ResponseSummary[],
): readonly TimelineEntry[] {
	const entries: TimelineEntry[] = [];

	// Approvals en tête (les plus récents d'abord) — dérivés des drafts
	// qui ne sont plus en `draft`.
	const approvedOrPublished = drafts.filter(
		(d) => d.status !== "draft" && d.status !== "failed",
	);
	for (const d of approvedOrPublished) {
		entries.push({
			id: `approved-${d.id}`,
			label:
				d.status === "published"
					? "Réponse publiée"
					: "Brouillon approuvé, en file de publication",
			actor: "Vous",
			relative: timeAgoFr(d.updatedAt),
			icon: Check,
		});
	}

	// Brouillons, du plus récent au plus ancien.
	const byNewest = [...drafts].reverse();
	byNewest.forEach((d, idx) => {
		const versionNumber = drafts.length - idx;
		entries.push({
			id: `draft-${d.id}`,
			label: `Brouillon v${versionNumber} · ton ${TONE_LABELS[d.tone]}`,
			actor: d.aiGenerated ? "Avizio IA" : "Vous",
			relative: timeAgoFr(d.createdAt),
			icon: Sparkles,
		});
	});

	// Événement système d'arrivée de l'avis, toujours en bas.
	entries.push({
		id: `review-${review.id}`,
		label: `Avis reçu depuis ${PLATFORM_LABELS[review.platform]}`,
		actor: "Système",
		relative: timeAgoFr(review.publishedAt),
		icon: Inbox,
	});

	return entries;
}

const TONE_LABELS: Record<ResponseSummary["tone"], string> = {
	warm: "chaleureux",
	professional: "professionnel",
	direct: "direct",
};
