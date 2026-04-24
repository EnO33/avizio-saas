import { useUser } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { Calendar } from "lucide-react";
import { z } from "zod";
import { OAuthResultBanner } from "#/components/connections/oauth-result-banner";
import { AiSummaryCard } from "#/components/dashboard/ai-summary-card";
import { EstablishmentsCard } from "#/components/dashboard/establishments-card";
import { KpiCard, type KpiDelta } from "#/components/dashboard/kpi-card";
import { PriorityReviewsCard } from "#/components/dashboard/priority-reviews-card";
import { SparkChart } from "#/components/dashboard/spark-chart";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Tabs } from "#/components/ui/tabs";
import { formatMonoDateFr, formatNumberFr } from "#/lib/dates";
import type { DashboardKpis } from "#/server/db/queries/dashboard";
import { getDashboardMetrics } from "#/server/fns/dashboard";
import { listEstablishments } from "#/server/fns/establishments";
import { countReviewsByStatus, listReviews } from "#/server/fns/reviews";

const dashboardSearchSchema = z.object({
	connected: z.enum(["google"]).optional(),
	error: z.string().optional(),
});

export const Route = createFileRoute("/_authed/dashboard")({
	validateSearch: dashboardSearchSchema,
	loader: async () => {
		const [reviewCounts, establishments, reviews, metrics] = await Promise.all([
			countReviewsByStatus(),
			listEstablishments(),
			listReviews(),
			getDashboardMetrics(),
		]);
		const priorityReviews = reviews
			.filter((r) => r.status === "new" || r.status === "in_progress")
			.slice(0, 3);
		return { reviewCounts, establishments, priorityReviews, metrics };
	},
	component: Dashboard,
});

function Dashboard() {
	const { reviewCounts, establishments, priorityReviews, metrics } =
		Route.useLoaderData();
	const { connected, error } = Route.useSearch();
	const { user } = useUser();

	const firstName = user?.firstName?.trim() || "bienvenue";
	const pending = reviewCounts.new + reviewCounts.in_progress;
	const flaggedCount = priorityReviews.filter((r) => r.rating <= 2).length;
	const today = new Date();

	const { kpis, spark, aiSummary } = metrics;
	const avgRatingKpi = buildAvgRatingKpi(kpis);
	const reviewCountKpi = buildReviewCountKpi(kpis);
	const responseRateKpi = buildResponseRateKpi(kpis);
	const medianTimeKpi = buildMedianTimeKpi(kpis);

	return (
		<div
			className="mx-auto px-4 py-5 sm:px-6 md:p-[32px_40px]"
			style={{ maxWidth: 1280 }}
		>
			<OAuthResultBanner connected={connected} error={error} />

			<div className="mb-7 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<div className="font-mono text-[12px] text-ink-mute">
						{formatMonoDateFr(today)}
					</div>
					<h1 className="m-[6px_0_4px] font-serif font-normal text-[32px] text-ink tracking-[-0.02em] sm:text-[42px]">
						Bonjour {firstName}.
					</h1>
					<p className="m-0 text-[14px] text-ink-soft sm:text-[15px]">
						{pending > 0 ? (
							<>
								<strong className="font-medium text-accent-ink">
									{pending} avis
								</strong>{" "}
								{pending > 1 ? "attendent" : "attend"} une réponse
								{flaggedCount > 0 ? (
									<>
										{" "}
										· {flaggedCount} demande
										{flaggedCount > 1 ? "nt" : ""} votre attention
									</>
								) : null}
								.
							</>
						) : (
							<>
								Rien à traiter ce matin. Profitez-en pour regarder les
								tendances.
							</>
						)}
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					icon={<Calendar size={14} strokeWidth={1.75} />}
					disabled
				>
					Ce mois-ci
				</Button>
			</div>

			<div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<KpiCard
					label="Note moyenne"
					value={avgRatingKpi.value}
					unit={avgRatingKpi.unit}
					delta={avgRatingKpi.delta}
					accent
				/>
				<KpiCard
					label="Avis ce mois"
					value={reviewCountKpi.value}
					delta={reviewCountKpi.delta}
				/>
				<KpiCard
					label="Taux de réponse"
					value={responseRateKpi.value}
					unit={responseRateKpi.unit}
					delta={responseRateKpi.delta}
				/>
				<KpiCard
					label="Temps médian"
					value={medianTimeKpi.value}
					delta={medianTimeKpi.delta}
				/>
			</div>

			<div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
				<div className="flex flex-col gap-5">
					<PriorityReviewsCard
						reviews={priorityReviews}
						totalPending={pending}
					/>

					<Card padding={22}>
						<div className="mb-[18px] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<div className="font-serif font-normal text-[22px]">
									Évolution de la note
								</div>
								<div className="mt-0.5 text-[12px] text-ink-mute">
									{establishments.length > 0
										? `${establishments.length} établissement${establishments.length > 1 ? "s" : ""}`
										: "—"}{" "}
									· 30 jours glissants
								</div>
							</div>
							<Tabs
								tabs={[
									{ id: "all", label: "Tous" },
									{ id: "google", label: "Google" },
									{ id: "tripadvisor", label: "TripAdvisor" },
								]}
								value="all"
								onChange={() => {
									/* stub — sélection inactive tant qu'on n'a pas l'agrégat par plateforme */
								}}
							/>
						</div>
						<SparkChart data={spark} />
					</Card>
				</div>

				<div className="flex flex-col gap-5">
					<EstablishmentsCard establishments={establishments} />
					<AiSummaryCard
						draftsThisWeek={aiSummary.draftsThisWeek}
						timeSavedMinutes={aiSummary.timeSavedMinutes}
					/>
				</div>
			</div>
		</div>
	);
}

// ─── KPI formatters ───────────────────────────────────────────────────────
// Les format*() convertissent les valeurs brutes (nombres, nulls) en
// texte affichable + direction qualitative. Tiré hors du composant
// pour garder le JSX lisible et permettre de tester la logique
// indépendamment (si un jour on en a besoin).

type KpiDisplay = {
	readonly value: string;
	readonly unit?: string | undefined;
	readonly delta: KpiDelta | null;
};

function buildAvgRatingKpi(kpis: DashboardKpis): KpiDisplay {
	if (kpis.avgRating == null) {
		return { value: "—", unit: "★", delta: null };
	}
	const value = formatNumberFr(kpis.avgRating, 1);
	if (kpis.avgRatingDelta == null || Math.abs(kpis.avgRatingDelta) < 0.05) {
		return { value, unit: "★", delta: null };
	}
	const signed = signedNumberFr(kpis.avgRatingDelta, 1);
	return {
		value,
		unit: "★",
		delta: {
			label: signed,
			direction: kpis.avgRatingDelta >= 0 ? "up" : "down",
		},
	};
}

function buildReviewCountKpi(kpis: DashboardKpis): KpiDisplay {
	const value = String(kpis.reviewCount);
	if (kpis.reviewCountDelta === 0) {
		return { value, delta: null };
	}
	const signed = signedInteger(kpis.reviewCountDelta);
	return {
		value,
		delta: {
			label: signed,
			direction: kpis.reviewCountDelta > 0 ? "up" : "down",
		},
	};
}

function buildResponseRateKpi(kpis: DashboardKpis): KpiDisplay {
	if (kpis.responseRate == null) {
		return { value: "—", unit: "%", delta: null };
	}
	const value = String(Math.round(kpis.responseRate * 100));
	if (
		kpis.responseRateDelta == null ||
		Math.abs(kpis.responseRateDelta) < 0.005
	) {
		return { value, unit: "%", delta: null };
	}
	const pts = Math.round(kpis.responseRateDelta * 100);
	const signed = `${pts >= 0 ? "+" : "−"}${Math.abs(pts)} pt`;
	return {
		value,
		unit: "%",
		delta: {
			label: signed,
			direction: kpis.responseRateDelta >= 0 ? "up" : "down",
		},
	};
}

function buildMedianTimeKpi(kpis: DashboardKpis): KpiDisplay {
	if (kpis.medianResponseTimeMinutes == null) {
		return { value: "—", delta: null };
	}
	const value = formatDurationMinutes(kpis.medianResponseTimeMinutes);
	if (
		kpis.medianResponseTimeDeltaMinutes == null ||
		Math.abs(kpis.medianResponseTimeDeltaMinutes) < 1
	) {
		return { value, delta: null };
	}
	const deltaMin = kpis.medianResponseTimeDeltaMinutes;
	const sign = deltaMin >= 0 ? "+" : "−";
	const label = `${sign}${formatDurationMinutes(Math.abs(deltaMin))}`;
	// Temps médian : plus c'est bas mieux c'est. Delta négatif = bonne
	// nouvelle → direction "up" (vert). Delta positif = c'est plus lent
	// → direction "down" (rouge).
	return {
		value,
		delta: { label, direction: deltaMin <= 0 ? "up" : "down" },
	};
}

function formatDurationMinutes(min: number): string {
	const rounded = Math.round(min);
	if (rounded < 60) return `${rounded} min`;
	const hours = Math.floor(rounded / 60);
	const remaining = rounded % 60;
	if (hours < 48) {
		return remaining === 0 ? `${hours} h` : `${hours} h ${remaining}`;
	}
	return `${Math.round(hours / 24)} j`;
}

function signedNumberFr(value: number, fractionDigits: number): string {
	const sign = value >= 0 ? "+" : "−";
	return `${sign}${formatNumberFr(Math.abs(value), fractionDigits)}`;
}

function signedInteger(value: number): string {
	const sign = value >= 0 ? "+" : "−";
	return `${sign}${Math.abs(value)}`;
}
