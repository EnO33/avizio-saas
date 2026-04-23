import { useOrganizationList } from "@clerk/tanstack-react-start";
import { useEffect, useRef } from "react";

/**
 * Mounted on the dashboard when the current Clerk session has no active
 * organization. Every Avizio feature is org-scoped so a user without one
 * can't do anything useful — we activate the first available membership,
 * or fall back to creating a fresh org if none exists yet.
 *
 * Covers three cases:
 *  - OAuth signup just landed: `user.created` webhook auto-created an org
 *    but the session was minted before — we activate it.
 *  - Webhook raced with the callback (rare): we create one client-side.
 *  - Existing user who never had an org: we create one on first visit.
 *
 * After the session switches, a reload picks up the new `orgId` in the
 * `_authed.beforeLoad` context so the dashboard re-renders org-scoped.
 */
export function EnsureActiveOrganization() {
	const { isLoaded, createOrganization, setActive, userMemberships } =
		useOrganizationList({ userMemberships: true });
	const attemptedRef = useRef(false);

	useEffect(() => {
		// `isLoaded` means Clerk's top-level store is ready, NOT that the
		// paginated memberships have been fetched — we must wait for that too
		// or we'll read `data = []` as "no orgs" during the initial fetch
		// and create a duplicate every mount (ask me how I know).
		if (!isLoaded) return;
		if (userMemberships.isLoading) return;
		if (attemptedRef.current) return;

		// Circuit breaker: prevent a runaway loop if an edge case leaves the
		// session without `orgId` even after we set one active. One attempt
		// per 30 s window — after that the dashboard just shows the switcher.
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
				await setActive({ organization: first.organization.id });
			} else {
				const created = await createOrganization({ name: "Mon organisation" });
				// `createOrganization` does not always set the new org as
				// active in the session token — make it explicit so the
				// subsequent reload sees `org_id` in the JWT.
				await setActive({ organization: created.id });
			}
			// Hard nav so `_authed.beforeLoad` re-reads `auth()` with the
			// freshly-set active org and the dashboard renders in the proper
			// org-scoped context.
			window.location.href = "/dashboard";
		};

		run();
	}, [
		isLoaded,
		userMemberships.isLoading,
		userMemberships.data,
		createOrganization,
		setActive,
	]);

	return (
		<div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-6 text-neutral-600 text-sm">
			<Spinner />
			Préparation de ton organisation…
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
