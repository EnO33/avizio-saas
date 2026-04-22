import { UserButton } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/dashboard")({
	component: Dashboard,
});

function Dashboard() {
	const { userId, orgId } = Route.useRouteContext();
	return (
		<main className="mx-auto max-w-5xl p-8">
			<header className="flex items-center justify-between">
				<h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
				<UserButton />
			</header>
			<section className="mt-8 rounded-lg border border-neutral-200 p-6">
				<p className="text-sm text-neutral-600">
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
				<p className="mt-4 text-neutral-500">
					Les établissements et avis arriveront dans les prochains sprints.
				</p>
			</section>
		</main>
	);
}
