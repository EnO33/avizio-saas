import type { ReviewSummary } from "#/server/db/queries/reviews";
import { RatingStars } from "./rating-stars";
import { ReviewStatusBadge } from "./status-badge";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
	dateStyle: "medium",
	timeStyle: "short",
});

const PLATFORM_LABELS: Record<ReviewSummary["platform"], string> = {
	google: "Google",
	tripadvisor: "TripAdvisor",
	trustpilot: "Trustpilot",
	thefork: "TheFork",
};

export function ReviewsTable({
	reviews,
}: {
	reviews: readonly ReviewSummary[];
}) {
	return (
		<ul className="divide-y divide-neutral-200 overflow-hidden rounded-md border border-neutral-200 bg-white">
			{reviews.map((review) => (
				<ReviewRow key={review.id} review={review} />
			))}
		</ul>
	);
}

function ReviewRow({ review }: { review: ReviewSummary }) {
	return (
		<li className="flex gap-4 p-4">
			<Avatar name={review.authorName} url={review.authorAvatarUrl} />
			<div className="min-w-0 flex-1 space-y-2">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<div className="flex items-center gap-2 text-sm">
							<span className="font-medium text-neutral-900">
								{review.authorName}
							</span>
							<span className="text-neutral-400">·</span>
							<span className="truncate text-neutral-600">
								{review.establishmentName}
							</span>
						</div>
						<div className="mt-1 flex items-center gap-2 text-neutral-500 text-xs">
							<RatingStars value={review.rating} />
							<span>·</span>
							<span>{PLATFORM_LABELS[review.platform]}</span>
							<span>·</span>
							<time dateTime={new Date(review.publishedAt).toISOString()}>
								{dateFormatter.format(new Date(review.publishedAt))}
							</time>
						</div>
					</div>
					<ReviewStatusBadge status={review.status} />
				</div>
				<p className="whitespace-pre-wrap text-neutral-700 text-sm">
					{review.content}
				</p>
			</div>
		</li>
	);
}

function Avatar({ name, url }: { name: string; url: string | null }) {
	if (url) {
		return (
			<img
				src={url}
				alt=""
				className="size-10 shrink-0 rounded-full object-cover"
				referrerPolicy="no-referrer"
			/>
		);
	}
	const initial = name.charAt(0).toUpperCase() || "?";
	return (
		<div
			aria-hidden="true"
			className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 font-medium text-neutral-600 text-sm"
		>
			{initial}
		</div>
	);
}
