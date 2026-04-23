import { auth } from "@clerk/tanstack-react-start/server";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

/**
 * Throws a redirect to `/` if the caller is signed-out.
 * On success, returns `{ userId, orgId }` so consumers can use it as route
 * context (e.g. `_authed.tsx` layout).
 */
export const ensureSignedIn = createServerFn().handler(async () => {
	const session = await auth();
	if (!session.isAuthenticated) {
		throw redirect({ to: "/" });
	}
	return { userId: session.userId, orgId: session.orgId };
});

/**
 * Throws a redirect to `/dashboard` if the caller is already signed-in.
 * Used as `beforeLoad` on public auth pages (`/sign-in`, `/sign-up`,
 * `/forgot-password`) so a signed-in user visiting these never sees a form —
 * and so that after a successful `signUp.finalize()` + reload, the target
 * `/sign-up` request redirects out to `/dashboard`.
 */
export const redirectIfSignedIn = createServerFn().handler(async () => {
	const session = await auth();
	if (session.isAuthenticated) {
		throw redirect({ to: "/dashboard" });
	}
});
