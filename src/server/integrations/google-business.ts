import { type CryptoError, decryptToken, encryptToken } from "#/lib/crypto";
import type { DbError, IntegrationError, OAuthError } from "#/lib/errors";
import { logger } from "#/lib/logger";
import { err, ok, type Result } from "#/lib/result";
import {
	type ActiveConnection,
	getActiveConnection,
	markConnectionRevoked,
	updateConnectionTokens,
} from "#/server/db/queries/connections";
import {
	isRefreshTokenRevoked,
	refreshAccessToken,
} from "./google-business-oauth";

/**
 * Number of milliseconds before `access_token_expires_at` at which we
 * preemptively refresh. Prevents the classic race where the token looks
 * valid at fetch-start but has expired by the time the request reaches
 * Google. 60 s is generous for server-to-server calls.
 */
const REFRESH_BUFFER_MS = 60_000;

export type AccessTokenBundle = {
	readonly accessToken: string;
	readonly connection: ActiveConnection;
};

export type GetAccessTokenError =
	| { readonly kind: "no_active_connection"; readonly organizationId: string }
	| { readonly kind: "missing_refresh_token"; readonly connectionId: string }
	/** Terminal — refresh token revoked upstream; connection is now soft-deleted. */
	| { readonly kind: "connection_revoked"; readonly connectionId: string }
	| CryptoError
	| OAuthError
	| IntegrationError
	| DbError;

/**
 * Entry point every Google Business Profile API call goes through: returns
 * a fresh access_token for the org's active Google connection, refreshing
 * (and persisting) in place if the stored token is within the expiry
 * buffer. Never hands out an expired or soon-to-expire token.
 *
 * If Google rejects the refresh with `invalid_grant` (user removed app
 * access, admin forced sign-out), the connection is soft-deleted and the
 * caller gets `connection_revoked` — terminal, they should surface the
 * "please reconnect" UX rather than retry.
 */
export async function getAccessTokenForOrg(params: {
	organizationId: string;
	platform: "google";
	now?: Date;
}): Promise<Result<AccessTokenBundle, GetAccessTokenError>> {
	const now = params.now ?? new Date();

	const connResult = await getActiveConnection({
		organizationId: params.organizationId,
		platform: params.platform,
	});
	if (connResult.isErr()) {
		if (connResult.error.kind === "db_not_found") {
			return err({
				kind: "no_active_connection",
				organizationId: params.organizationId,
			});
		}
		return err(connResult.error);
	}
	const conn = connResult.value;

	const plainAccessResult = decryptToken(conn.encryptedAccessToken);
	if (plainAccessResult.isErr()) return err(plainAccessResult.error);

	const expiresAt = conn.accessTokenExpiresAt;
	const stillValid =
		expiresAt !== null &&
		expiresAt.getTime() - now.getTime() > REFRESH_BUFFER_MS;
	if (stillValid) {
		return ok({ accessToken: plainAccessResult.value, connection: conn });
	}

	// Token expired / near expiry — need to refresh.
	if (!conn.encryptedRefreshToken) {
		// No refresh token stored means we can't recover without a re-consent
		// by the user. Surface a dedicated kind so the caller can route them
		// to the "connect Google" button.
		return err({ kind: "missing_refresh_token", connectionId: conn.id });
	}

	const plainRefreshResult = decryptToken(conn.encryptedRefreshToken);
	if (plainRefreshResult.isErr()) return err(plainRefreshResult.error);

	const refreshResult = await refreshAccessToken({
		refreshToken: plainRefreshResult.value,
	});

	if (refreshResult.isErr()) {
		if (isRefreshTokenRevoked(refreshResult.error)) {
			logger.warn(
				{
					event: "gbp_refresh_token_revoked",
					connectionId: conn.id,
					orgId: conn.organizationId,
				},
				"Refresh token revoked upstream — soft-deleting connection",
			);
			// Best-effort — even if the mark fails the user will still see
			// the revoked error and can trigger a re-connect.
			await markConnectionRevoked({
				id: conn.id,
				organizationId: conn.organizationId,
			});
			return err({ kind: "connection_revoked", connectionId: conn.id });
		}
		return err(refreshResult.error);
	}

	const tokens = refreshResult.value;

	const encAccessResult = encryptToken(tokens.access_token);
	if (encAccessResult.isErr()) return err(encAccessResult.error);

	let encRefreshValue: string | null = null;
	if (tokens.refresh_token) {
		const encRefreshResult = encryptToken(tokens.refresh_token);
		if (encRefreshResult.isErr()) return err(encRefreshResult.error);
		encRefreshValue = encRefreshResult.value;
	}

	const newExpiresAt = new Date(now.getTime() + tokens.expires_in * 1000);
	const newScopes = tokens.scope.split(" ");

	const updateResult = await updateConnectionTokens({
		id: conn.id,
		encryptedAccessToken: encAccessResult.value,
		encryptedRefreshToken: encRefreshValue,
		accessTokenExpiresAt: newExpiresAt,
		scopes: newScopes,
	});
	if (updateResult.isErr()) return err(updateResult.error);

	logger.debug(
		{
			event: "gbp_access_token_refreshed",
			connectionId: conn.id,
			orgId: conn.organizationId,
			expiresAt: newExpiresAt,
		},
		"Access token refreshed and persisted",
	);

	return ok({
		accessToken: tokens.access_token,
		connection: {
			...conn,
			encryptedAccessToken: encAccessResult.value,
			encryptedRefreshToken: encRefreshValue ?? conn.encryptedRefreshToken,
			accessTokenExpiresAt: newExpiresAt,
			scopes: newScopes,
		},
	});
}
