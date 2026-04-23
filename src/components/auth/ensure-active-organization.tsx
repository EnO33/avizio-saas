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
 *  - Existing user who never had an org (pre-auto-org-on-signup accounts):
 *    we create one on their next dashboard visit.
 *
 * After the session switches, a reload picks up the new `orgId` in the
 * `_authed.beforeLoad` context so the dashboard re-renders with the active
 * org.
 */
export function EnsureActiveOrganization() {
	const { isLoaded, createOrganization, setActive, userMemberships } =
		useOrganizationList({ userMemberships: true });
	const attemptedRef = useRef(false);

	useEffect(() => {
		if (!isLoaded) return;
		if (attemptedRef.current) return;
		attemptedRef.current = true;

		const memberships = userMemberships.data ?? [];

		const run = async () => {
			if (memberships.length > 0) {
				const first = memberships[0];
				if (!first) return;
				await setActive({ organization: first.organization.id });
			} else {
				await createOrganization({ name: "Mon organisation" });
			}
			// Hard reload so `_authed.beforeLoad` re-reads `auth()` with the
			// freshly-set active org and the dashboard renders in the proper
			// org-scoped context.
			window.location.reload();
		};

		run();
	}, [isLoaded, userMemberships, createOrganization, setActive]);

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
