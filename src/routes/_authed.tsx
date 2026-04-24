import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Shell } from "#/components/shell/shell";
import { ensureSignedIn } from "#/server/fns/auth-guards";
import { countReviewsByStatus } from "#/server/fns/reviews";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async () => {
		const session = await ensureSignedIn();
		// Check server-side plutôt que via `EnsureActiveOrganization` côté
		// client : le redirect part avant le premier paint, pas de flash
		// dashboard → onboarding quand l'user fraîchement inscrit n'a
		// pas encore d'org active. Le flow guidé gère la création.
		if (!session.orgId) {
			throw redirect({ to: "/onboarding" });
		}
		return session;
	},
	loader: async () => {
		const counts = await countReviewsByStatus();
		// Le badge de la sidebar additionne tout ce qui demande une action
		// utilisateur : les nouveaux et les brouillons en cours. `responded`
		// et `skipped` sont exclus — ils ne réclament plus rien.
		const pendingReviewsCount = counts.new + counts.in_progress;

		// Placeholder en attendant la logique d'essai (Sprint 5 : Stripe +
		// `organizations.trialEndsAt`). 14 = jour 1 de l'essai, c'est
		// visuellement correct pour tous les comptes actuels.
		const trialDaysRemaining = 14;

		return { pendingReviewsCount, trialDaysRemaining };
	},
	component: AuthedLayout,
});

function AuthedLayout() {
	const { pendingReviewsCount, trialDaysRemaining } = Route.useLoaderData();
	return (
		<Shell
			pendingReviewsCount={pendingReviewsCount}
			trialDaysRemaining={trialDaysRemaining}
		>
			<Outlet />
		</Shell>
	);
}
