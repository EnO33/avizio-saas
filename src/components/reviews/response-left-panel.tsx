import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "#/components/ui/avatar";
import { PLATFORM_LABELS, PlatformIcon } from "#/components/ui/platform-icon";
import { Stars } from "#/components/ui/stars";
import { StatusBadge } from "#/components/ui/status-badge";
import { timeAgoFr } from "#/lib/dates";
import type { ReviewSummary } from "#/server/db/queries/reviews";
import { getReviewInitials } from "./initials";
import { ResponseAnalysis } from "./response-analysis";

type Props = {
	readonly review: ReviewSummary;
};

/**
 * Colonne gauche du workspace de rédaction — porte tout le contexte
 * de l'avis : lien retour, plateforme, auteur, citation, et l'analyse
 * IA. Fond cream (`bg-bg-deep`) pour séparer visuellement de la
 * colonne éditeur qui reste sur paper blanc.
 */
export function ResponseLeftPanel({ review }: Props) {
	const initials = getReviewInitials(review.authorName);

	return (
		<div className="overflow-auto border-line-soft border-r bg-bg-deep px-8 py-7">
			<Link
				to="/reviews"
				className="mb-5 inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[12.5px] text-ink-soft hover:text-ink"
			>
				<ArrowLeft size={14} strokeWidth={1.75} />
				Retour à la boîte
			</Link>

			<div className="mb-4 flex items-center gap-2.5">
				<PlatformIcon platform={review.platform} size={18} />
				<span className="text-[12.5px] text-ink-soft">
					{PLATFORM_LABELS[review.platform]}
				</span>
				<span className="text-ink-mute">·</span>
				<span className="text-[12.5px] text-ink-soft">
					{review.establishmentName}
				</span>
				<span className="ml-auto">
					<StatusBadge status={review.status} />
				</span>
			</div>

			<div className="mb-[22px] flex gap-3.5">
				<Avatar initial={initials} size={48} />
				<div>
					<div className="font-serif text-[24px] tracking-[-0.01em]">
						{review.authorName}
					</div>
					<div className="mt-1 flex items-center gap-2">
						<Stars value={review.rating} size={14} />
						<span className="text-[12.5px] text-ink-soft">
							{review.rating}/5 · {timeAgoFr(review.publishedAt)}
						</span>
					</div>
				</div>
			</div>

			<div className="rounded-xl border border-line-soft bg-paper px-[26px] py-6 font-serif text-[18px] text-ink italic leading-[1.6]">
				<p className="whitespace-pre-wrap">« {review.content} »</p>
			</div>

			<ResponseAnalysis review={review} />
		</div>
	);
}
