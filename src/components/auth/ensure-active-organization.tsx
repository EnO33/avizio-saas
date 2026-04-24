import { useOrganizationList } from "@clerk/tanstack-react-start";
import { useEffect, useRef } from "react";

/**
 * Mounted on the dashboard when the current Clerk session has no active
 * organization. Deux cas possibles :
 *
 *  1. L'utilisateur a au moins une membership qui n'est juste pas active
 *     dans la session courante (race OAuth, changement d'appareil…) →
 *     on active la première et on recharge.
 *
 *  2. L'utilisateur n'a **aucune** membership → on le redirige vers
 *     `/onboarding` pour le flow guidé (création d'org + établissement +
 *     connect Google). On ne crée PLUS l'org en silence : l'auto-create
 *     qu'on faisait avant contournait l'onboarding et sortait
 *     l'utilisateur avec un espace mal nommé (« Mon organisation »).
 *
 * Après le setActive (cas 1), un reload fait relire `_authed.beforeLoad`
 * avec le nouveau `orgId` en context.
 */
export function EnsureActiveOrganization() {
	const { isLoaded, setActive, userMemberships } = useOrganizationList({
		userMemberships: true,
	});
	const attemptedRef = useRef(false);

	useEffect(() => {
		// `isLoaded` means Clerk's top-level store is ready, NOT that the
		// paginated memberships have been fetched — we must wait for that too
		// or we'll read `data = []` as "no orgs" during the initial fetch
		// and redirect to onboarding even quand une membership va arriver.
		if (!isLoaded) return;
		if (userMemberships.isLoading) return;
		if (attemptedRef.current) return;

		// Circuit breaker : évite une boucle de redirections si un edge
		// case empêche Clerk de persister le setActive. Une tentative
		// par 30 s — au-delà, le dashboard affiche l'org switcher manuel.
		const cooldownKey = "avizio:org-bootstrap:last-attempt";
		const lastAttempt = Number(window.sessionStorage.getItem(cooldownKey));
		if (Number.isFinite(lastAttempt) && Date.now() - lastAttempt < 30_000) {
			console.warn(
				"[avizio] skipping org bootstrap: attempted less than 30 s ago",
			);
			return;
		}

		attemptedRef.current = true;
		window.sessionStorage.setItem(cooldownKey, String(Date.now()));

		const run = async () => {
			const memberships = userMemberships.data ?? [];
			if (memberships.length > 0) {
				const first = memberships[0];
				if (!first) return;
				if (!setActive) return;
				await setActive({ organization: first.organization.id });
				// Hard nav so `_authed.beforeLoad` re-reads `auth()` avec le
				// `orgId` fraîchement set dans la JWT.
				window.location.href = "/dashboard";
				return;
			}
			// Zero membership → onboarding. Le flow guidé se charge de
			// créer l'org avec un vrai nom et de chaîner la création de
			// l'établissement + la connexion Google.
			window.location.href = "/onboarding";
		};

		run();
	}, [isLoaded, userMemberships.isLoading, userMemberships.data, setActive]);

	return (
		<div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-6 text-neutral-600 text-sm">
			<Spinner />
			Préparation de ton espace…
		</div>
	);
}

function Spinner() {
	return (
		<svg
			className="size-5 animate-spin text-neutral-400"
			viewBox="0 0 24 24"
			aria-hidden="true"
			role="presentation"
		>
			<title>Chargement</title>
			<circle
				className="opacity-25"
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				strokeWidth="4"
				fill="none"
			/>
			<path
				className="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			/>
		</svg>
	);
}
