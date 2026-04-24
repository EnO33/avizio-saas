import { useUser } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { Calendar } from "lucide-react";
import { z } from "zod";
import { OAuthResultBanner } from "#/components/connections/oauth-result-banner";
import { AiSummaryCard } from "#/components/dashboard/ai-summary-card";
import { EstablishmentsCard } from "#/components/dashboard/establishments-card";
import { KpiCard } from "#/components/dashboard/kpi-card";
import { PriorityReviewsCard } from "#/components/dashboard/priority-reviews-card";
import { SparkChart } from "#/components/dashboard/spark-chart";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Tabs } from "#/components/ui/tabs";
import { formatMonoDateFr } from "#/lib/dates";
import { listEstablishments } from "#/server/fns/establishments";
import { countReviewsByStatus, listReviews } from "#/server/fns/reviews";

const dashboardSearchSchema = z.object({
	connected: z.enum(["google"]).optional(),
	error: z.string().optional(),
});

export const Route = createFileRoute("/_authed/dashboard")({
	validateSearch: dashboardSearchSchema,
	loader: async () => {
		const [reviewCounts, establishments, reviews] = await Promise.all([
			countReviewsByStatus(),
			listEstablishments(),
			listReviews(),
		]);
		const priorityReviews = reviews
			.filter((r) => r.status === "new" || r.status === "in_progress")
			.slice(0, 3);
		return { reviewCounts, establishments, priorityReviews };
	},
	component: Dashboard,
});

function Dashboard() {
	const { reviewCounts, establishments, priorityReviews } =
		Route.useLoaderData();
	const { connected, error } = Route.useSearch();
	const { user } = useUser();

	const firstName = user?.firstName?.trim() || "bienvenue";
	const pending = reviewCounts.new + reviewCounts.in_progress;
	const flaggedCount = priorityReviews.filter((r) => r.rating <= 2).length;
	const today = new Date();

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
				>
					30 derniers jours
				</Button>
			</div>

			{/*
			  KPIs stubbés — les valeurs exactes nécessitent des agrégats
			  DB qu'on n'a pas encore (moyenne des ratings sur la fenêtre
			  glissante, temps médian entre création et approbation d'un
			  draft, etc.). On les remplacera par de la vraie donnée dans
			  une PR dédiée quand la table responses aura assez d'historique.
			*/}
			<div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<KpiCard
					label="Note moyenne"
					value="4,6"
					unit="★"
					delta="+0,2"
					deltaDirection="up"
					accent
				/>
				<KpiCard
					label="Avis ce mois"
					value={
						reviewCounts.new +
							reviewCounts.in_progress +
							reviewCounts.responded +
							reviewCounts.skipped >
						0
							? String(
									reviewCounts.new +
										reviewCounts.in_progress +
										reviewCounts.responded,
								)
							: "0"
					}
					delta="+14"
					deltaDirection="up"
				/>
				<KpiCard
					label="Taux de réponse"
					value="92%"
					delta="+8 pt"
					deltaDirection="up"
				/>
				<KpiCard
					label="Temps médian"
					value="2 min"
					delta="−18 min"
					deltaDirection="up"
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
									· 90 jours glissants
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
						<SparkChart />
					</Card>
				</div>

				<div className="flex flex-col gap-5">
					<EstablishmentsCard establishments={establishments} />
					<AiSummaryCard
						draftsThisWeek={reviewCounts.responded}
						timeSavedMinutes={reviewCounts.responded * 3}
						approvedWithoutEditRate={0.89}
					/>
				</div>
			</div>
		</div>
	);
}
