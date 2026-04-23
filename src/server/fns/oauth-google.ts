import { auth } from "@clerk/tanstack-react-start/server";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createState } from "#/lib/oauth-state";
import { getRequestOrigin } from "#/server/http/origin";
import {
	buildAuthUrl,
	GOOGLE_OAUTH_CALLBACK_PATH,
} from "#/server/integrations/google-business-oauth";

/**
 * Called by the "Connect Google Business Profile" button. Generates a signed
 * state, builds the consent URL and returns it so the client can perform a
 * full-page navigation (Clerk-custom-flow pattern: we own the redirect, no
 * SPA nav).
 */
export const startGoogleConnect = createServerFn().handler(async () => {
	const session = await auth();
	if (!session.isAuthenticated) {
		throw redirect({ to: "/sign-in" });
	}
	if (!session.orgId) {
		// No active organization — the connection is org-scoped so there's
		// nothing to attach it to. Send the user back to the dashboard.
		throw redirect({ to: "/dashboard" });
	}

	const state = createState({
		organizationId: session.orgId,
		userId: session.userId,
	});
	const redirectUri = `${getRequestOrigin()}${GOOGLE_OAUTH_CALLBACK_PATH}`;
	const url = buildAuthUrl({ state, redirectUri });

	return { url };
});
