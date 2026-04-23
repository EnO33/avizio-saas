import { auth } from "@clerk/tanstack-react-start/server";
import { createFileRoute } from "@tanstack/react-router";
import { encryptToken } from "#/lib/crypto";
import { logger } from "#/lib/logger";
import { readState } from "#/lib/oauth-state";
import { upsertGoogleConnection } from "#/server/db/queries/connections";
import { getRequestOrigin } from "#/server/http/origin";
import {
	decodeIdToken,
	exchangeCodeForTokens,
	GOOGLE_OAUTH_CALLBACK_PATH,
} from "#/server/integrations/google-business-oauth";

function redirectTo(origin: string, path: string): Response {
	return new Response(null, {
		status: 302,
		headers: { location: `${origin}${path}` },
	});
}

export const Route = createFileRoute("/api/oauth/google/callback")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const origin = getRequestOrigin();
				const url = new URL(request.url);
				const code = url.searchParams.get("code");
				const state = url.searchParams.get("state");
				const errorParam = url.searchParams.get("error");

				// User clicked "Cancel" on Google's consent screen, or Google
				// refused (invalid scope, client suspended, etc.).
				if (errorParam) {
					logger.info(
						{ event: "oauth_google_user_denied", reason: errorParam },
						"User or provider denied Google OAuth consent",
					);
					return redirectTo(origin, "/dashboard?error=oauth_denied");
				}

				if (!code) {
					return redirectTo(origin, "/dashboard?error=oauth_missing_code");
				}
				if (!state) {
					return redirectTo(origin, "/dashboard?error=oauth_missing_state");
				}

				const session = await auth();
				if (!session.isAuthenticated) {
					// Lost the session between consent and callback — kick back
					// to sign-in and let the user restart the flow.
					return redirectTo(origin, "/sign-in");
				}

				const stateResult = readState(state);
				if (stateResult.isErr()) {
					logger.warn(
						{
							event: "oauth_google_state_invalid",
							kind: stateResult.error.kind,
						},
						"OAuth state verification failed",
					);
					return redirectTo(origin, "/dashboard?error=oauth_state_invalid");
				}
				const statePayload = stateResult.value;

				if (
					statePayload.userId !== session.userId ||
					statePayload.organizationId !== session.orgId
				) {
					// State was minted for a different session — likely cross-user
					// replay, or user switched orgs between consent and callback.
					logger.warn(
						{ event: "oauth_google_state_mismatch" },
						"OAuth state doesn't match current session",
					);
					return redirectTo(origin, "/dashboard?error=oauth_state_mismatch");
				}

				const redirectUri = `${origin}${GOOGLE_OAUTH_CALLBACK_PATH}`;
				const tokensResult = await exchangeCodeForTokens({
					code,
					redirectUri,
				});
				if (tokensResult.isErr()) {
					logger.error(
						{
							event: "oauth_google_token_exchange_failed",
							kind: tokensResult.error.kind,
						},
						"Google token exchange failed",
					);
					return redirectTo(origin, "/dashboard?error=oauth_token_exchange");
				}
				const tokens = tokensResult.value;

				const claimsResult = decodeIdToken(tokens.id_token);
				if (claimsResult.isErr()) {
					logger.error(
						{ event: "oauth_google_id_token_invalid" },
						"Google id_token failed validation",
					);
					return redirectTo(origin, "/dashboard?error=oauth_id_token");
				}
				const claims = claimsResult.value;

				const encAccess = encryptToken(tokens.access_token);
				if (encAccess.isErr()) {
					logger.error(
						{
							event: "oauth_google_encrypt_failed",
							kind: encAccess.error.kind,
						},
						"Failed to encrypt access token",
					);
					return redirectTo(origin, "/dashboard?error=oauth_crypto");
				}
				let encRefresh: string | null = null;
				if (tokens.refresh_token) {
					const r = encryptToken(tokens.refresh_token);
					if (r.isErr()) {
						logger.error(
							{ event: "oauth_google_encrypt_failed", kind: r.error.kind },
							"Failed to encrypt refresh token",
						);
						return redirectTo(origin, "/dashboard?error=oauth_crypto");
					}
					encRefresh = r.value;
				}

				const upsertResult = await upsertGoogleConnection({
					organizationId: statePayload.organizationId,
					platformAccountId: claims.sub,
					platformAccountLabel: claims.email ?? null,
					encryptedAccessToken: encAccess.value,
					encryptedRefreshToken: encRefresh,
					accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
					scopes: tokens.scope.split(" "),
				});
				if (upsertResult.isErr()) {
					logger.error(
						{
							event: "oauth_google_upsert_failed",
							kind: upsertResult.error.kind,
						},
						"Failed to upsert google connection",
					);
					return redirectTo(origin, "/dashboard?error=oauth_db");
				}

				logger.info(
					{
						event: "oauth_google_connected",
						orgId: statePayload.organizationId,
						platformAccountId: claims.sub,
					},
					"Google Business Profile connection stored",
				);
				return redirectTo(origin, "/dashboard?connected=google");
			},
		},
	},
});
