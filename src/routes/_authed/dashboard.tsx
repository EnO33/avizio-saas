import { OrganizationSwitcher, UserButton } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { EnsureActiveOrganization } from "#/components/auth/ensure-active-organization";
import { ConnectGoogleButton } from "#/components/connections/connect-google-button";
import { ConnectionsList } from "#/components/connections/connections-list";
import { OAuthResultBanner } from "#/components/connections/oauth-result-banner";
import { EstablishmentsSummaryCard } from "#/components/establishments/establishments-summary-card";
import { ReviewsSummaryCard } from "#/components/reviews/reviews-summary-card";
import { listConnections } from "#/server/fns/connections";
import { listEstablishments } from "#/server/fns/establishments";
import { countReviewsByStatus } from "#/server/fns/reviews";

const dashboardSearchSchema = z.object({
	connected: z.enum(["google"]).optional(),
	error: z.string().optional(),
});

export const Route = createFileRoute("/_authed/dashboard")({
	validateSearch: dashboardSearchSchema,
	loader: async () => {
		const [connections, reviewCounts, establishments] = await Promise.all([
			listConnections(),
			countReviewsByStatus(),
			listEstablishments(),
		]);
		return { connections, reviewCounts, establishments };
	},
	component: Dashboard,
});

function Dashboard() {
	const { userId, orgId } = Route.useRouteContext();
	const { connections, reviewCounts, establishments } = Route.useLoaderData();
	const { connected, error } = Route.useSearch();

	const hasGoogleConnection = connections.some((c) => c.platform === "google");

	return (
		<main className="mx-auto max-w-5xl space-y-6 p-8">
			<header className="flex items-center justify-between">
				<h1 className="font-bold text-3xl tracking-tight">Dashboard</h1>
				<div className="flex items-center gap-3">
					<OrganizationSwitcher
						hidePersonal
						afterCreateOrganizationUrl="/dashboard"
						afterSelectOrganizationUrl="/dashboard"
					/>
					<UserButton />
				</div>
			</header>

			<OAuthResultBanner connected={connected} error={error} />

			{!orgId ? <EnsureActiveOrganization /> : null}

			<section className="rounded-lg border border-neutral-200 p-6">
				<p className="text-neutral-600 text-sm">
					Connecté en tant que <code className="text-xs">{userId}</code>
					{orgId ? (
						<>
							{" "}
							· Organisation <code className="text-xs">{orgId}</code>
						</>
					) : (
						<> · Aucune organisation sélectionnée</>
					)}
				</p>
			</section>

			{orgId ? (
				<EstablishmentsSummaryCard count={establishments.length} />
			) : null}

			{orgId ? <ReviewsSummaryCard counts={reviewCounts} /> : null}

			{orgId ? (
				<section className="space-y-4 rounded-lg border border-neutral-200 p-6">
					<div>
						<h2 className="font-semibold text-lg">Intégrations</h2>
						<p className="mt-1 text-neutral-500 text-sm">
							Connecte tes plateformes pour commencer à collecter les avis.
						</p>
					</div>
					<ConnectionsList connections={connections} />
					{!hasGoogleConnection ? <ConnectGoogleButton /> : null}
				</section>
			) : null}
		</main>
	);
}
