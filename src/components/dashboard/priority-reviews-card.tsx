import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight } from "lucide-react";
import { getReviewInitials } from "#/components/reviews/initials";
import { Avatar } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { PLATFORM_LABELS, PlatformIcon } from "#/components/ui/platform-icon";
import { Stars } from "#/components/ui/stars";
import { timeAgoFr } from "#/lib/dates";
import type { ReviewSummary } from "#/server/db/queries/reviews";

type Props = {
	readonly reviews: readonly ReviewSummary[];
	readonly totalPending: number;
};

/**
 * Liste des 3 avis à traiter en priorité, clickables vers la page
 * détail. Si la liste est vide (tout est traité), on affiche un état
 * valorisant plutôt qu'un texte gris — c'est le moment où l'utilisateur
 * peut respirer, autant le célébrer visuellement.
 */
export function PriorityReviewsCard({ reviews, totalPending }: Props) {
	return (
		<Card padding={0}>
			<div className="flex items-center justify-between border-line-soft border-b px-4 md:px-[22px] py-[18px]">
				<div>
					<div className="font-serif font-normal text-[22px]">
						À traiter en priorité
					</div>
					<div className="mt-0.5 text-[12px] text-ink-mute">
						Les avis à réponse urgente, classés par l'IA.
					</div>
				</div>
				{reviews.length > 0 && totalPending > 0 ? (
					<Link to="/reviews">
						<Button
							variant="ghost"
							size="sm"
							iconRight={<ArrowRight size={14} strokeWidth={1.75} />}
						>
							Voir tout · {totalPending}
						</Button>
					</Link>
				) : null}
			</div>

			{reviews.length === 0 ? (
				<EmptyPriority />
			) : (
				<div>
					{reviews.map((review) => (
						<PriorityRow key={review.id} review={review} />
					))}
				</div>
			)}
		</Card>
	);
}

function PriorityRow({ review }: { review: ReviewSummary }) {
	const initial = getReviewInitials(review.authorName);
	return (
		<Link
			to="/reviews/$id"
			params={{ id: review.id }}
			className="group flex w-full gap-3.5 border-line-soft border-b px-4 md:px-[22px] py-4 text-left transition-colors hover:bg-bg-deep"
		>
			<Avatar initial={initial} size={36} />
			<div className="min-w-0 flex-1">
				<div className="mb-1 flex items-center gap-2">
					<span className="font-medium text-[13.5px]">{review.authorName}</span>
					<Stars value={review.rating} size={11} />
					<span className="text-[11.5px] text-ink-mute">
						· {timeAgoFr(review.publishedAt)}
					</span>
				</div>
				<p className="line-clamp-2 text-[13px] text-ink-soft leading-[1.5]">
					{review.content}
				</p>
				<div className="mt-2 flex items-center gap-2.5 text-[11.5px] text-ink-mute">
					<span className="inline-flex items-center gap-1">
						<PlatformIcon platform={review.platform} size={13} />
						{PLATFORM_LABELS[review.platform]}
					</span>
					<span>·</span>
					<span>{review.establishmentName}</span>
				</div>
			</div>
			<div className="flex items-center text-ink-mute">
				<ChevronRight size={16} strokeWidth={1.75} />
			</div>
		</Link>
	);
}

function EmptyPriority() {
	return (
		<div className="px-4 md:px-[22px] py-10 text-center">
			<div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-bg-deep">
				<span aria-hidden="true" className="size-3 rounded-full bg-green" />
			</div>
			<div className="font-serif text-[20px]">Tout est traité.</div>
			<div className="mt-1 text-[12.5px] text-ink-mute">
				Les nouveaux avis arriveront ici automatiquement.
			</div>
		</div>
	);
}
