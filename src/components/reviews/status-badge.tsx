import type { ReviewSummary } from "#/server/db/queries/reviews";

type Status = ReviewSummary["status"];

const STYLES: Record<Status, string> = {
	new: "bg-blue-100 text-blue-800",
	in_progress: "bg-amber-100 text-amber-800",
	responded: "bg-emerald-100 text-emerald-800",
	skipped: "bg-neutral-100 text-neutral-600",
};

const LABELS: Record<Status, string> = {
	new: "Nouveau",
	in_progress: "En cours",
	responded: "Répondu",
	skipped: "Ignoré",
};

export function ReviewStatusBadge({ status }: { status: Status }) {
	return (
		<span
			className={`rounded-full px-2 py-0.5 font-medium text-xs ${STYLES[status]}`}
		>
			{LABELS[status]}
		</span>
	);
}
