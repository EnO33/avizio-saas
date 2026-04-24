import { Avatar } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { PLATFORM_LABELS, PlatformIcon } from "#/components/ui/platform-icon";
import { Stars } from "#/components/ui/stars";
import { StatusBadge } from "#/components/ui/status-badge";
import { timeAgoFr } from "#/lib/dates";
import type { ReviewSummary } from "#/server/db/queries/reviews";
import { getReviewInitials } from "./initials";

type Props = {
	readonly review: ReviewSummary;
	readonly selected: boolean;
	readonly onSelect: () => void;
};

/**
 * Ligne de la liste inbox. Pas de `<Link>` — la sélection se fait via
 * search param dans la page parente, pour garder la preview visible
 * dans la même vue et permettre de cliquer plusieurs avis à la suite
 * sans push route à chaque fois. Le keyboard focus reste sur le bouton,
 * la navigation clavier fonctionne native.
 */
export function InboxRow({ review, selected, onSelect }: Props) {
	// Flagged = rating <= 2 — pas encore de colonne DB dédiée, on dérive
	// côté client. Suffisant tant que le seuil reste simple ; si on ajoute
	// des règles (mots-clés, délai) il faudra passer en computed côté DB.
	const flagged = review.rating <= 2;

	return (
		<button
			type="button"
			onClick={onSelect}
			className={[
				"mb-0.5 block w-full rounded-lg border p-3 text-left outline-none transition-all duration-[100ms] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
				selected
					? "border-accent bg-[oklch(0.97_0.02_50)]"
					: "border-transparent hover:bg-bg-deep",
			].join(" ")}
		>
			<div className="flex items-start gap-[11px]">
				<Avatar initial={getReviewInitials(review.authorName)} size={34} />
				<div className="min-w-0 flex-1">
					<div className="mb-0.5 flex items-center gap-1.5">
						<span className="flex-1 truncate font-medium text-[13px] text-ink">
							{review.authorName}
						</span>
						<span className="shrink-0 text-[11.5px] text-ink-mute sm:text-[11px]">
							{timeAgoFr(review.publishedAt)}
						</span>
					</div>
					<div className="mb-1 flex items-center gap-1.5">
						<Stars value={review.rating} size={10} />
						<span className="text-[11.5px] text-ink-mute sm:text-[10.5px]">
							· {review.establishmentName}
						</span>
					</div>
					<p className="line-clamp-2 text-[13px] text-ink-soft leading-[1.45] sm:text-[12.5px]">
						{review.content}
					</p>
					<div className="mt-2 flex items-center gap-1.5">
						<PlatformIcon platform={review.platform} size={12} />
						<span className="text-[11.5px] text-ink-mute sm:text-[10.5px]">
							{PLATFORM_LABELS[review.platform]}
						</span>
						{flagged ? (
							<>
								<span className="text-[10px] text-ink-mute">·</span>
								<Badge tone="rose">Urgent</Badge>
							</>
						) : null}
						<span className="ml-auto">
							<StatusBadge status={review.status} />
						</span>
					</div>
				</div>
			</div>
		</button>
	);
}
