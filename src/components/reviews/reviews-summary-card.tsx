import { Link } from "@tanstack/react-router";
import type { ReviewStatusCounts } from "#/server/db/queries/reviews";

/**
 * Dashboard widget giving a one-glance status of review workload. Emphasis
 * on `new` since that's the actionable bucket — "in_progress" + "responded"
 * are surfaced more discreetly as context.
 */
export function ReviewsSummaryCard({ counts }: { counts: ReviewStatusCounts }) {
	const total =
		counts.new + counts.in_progress + counts.responded + counts.skipped;

	return (
		<section className="space-y-4 rounded-lg border border-neutral-200 p-6">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h2 className="font-semibold text-lg">Avis</h2>
					<p className="mt-1 text-neutral-500 text-sm">
						{total === 0
							? "Aucun avis pour le moment."
							: "Suivi de tes avis clients."}
					</p>
				</div>
				<Link
					to="/reviews"
					className="shrink-0 text-neutral-600 text-sm hover:text-neutral-900 hover:underline"
				>
					Voir tous les avis →
				</Link>
			</div>

			{total > 0 ? (
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
					<Stat label="À traiter" value={counts.new} tone="blue" />
					<Stat label="En cours" value={counts.in_progress} tone="amber" />
					<Stat label="Répondus" value={counts.responded} tone="emerald" />
					<Stat label="Ignorés" value={counts.skipped} tone="neutral" />
				</div>
			) : null}
		</section>
	);
}

type Tone = "blue" | "amber" | "emerald" | "neutral";

const TONE_STYLES: Record<Tone, string> = {
	blue: "bg-blue-50 text-blue-900",
	amber: "bg-amber-50 text-amber-900",
	emerald: "bg-emerald-50 text-emerald-900",
	neutral: "bg-neutral-50 text-neutral-700",
};

function Stat({
	label,
	value,
	tone,
}: {
	label: string;
	value: number;
	tone: Tone;
}) {
	return (
		<div className={`rounded-md px-3 py-2 ${TONE_STYLES[tone]}`}>
			<div className="font-bold text-2xl">{value}</div>
			<div className="text-xs opacity-80">{label}</div>
		</div>
	);
}
