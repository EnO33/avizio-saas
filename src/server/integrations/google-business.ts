import { z } from "zod";
import { type CryptoError, decryptToken, encryptToken } from "#/lib/crypto";
import type {
	DbError,
	GbpError,
	IntegrationError,
	OAuthError,
	ValidationIssue,
} from "#/lib/errors";
import { unknownToMessage } from "#/lib/errors";
import { logger } from "#/lib/logger";
import { err, fromPromise, fromThrowable, ok, type Result } from "#/lib/result";
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

const PROVIDER = "google";
const ACCOUNT_MANAGEMENT_BASE =
	"https://mybusinessaccountmanagement.googleapis.com/v1";

/**
 * Narrow view of a Business Profile account. Google returns richer objects
 * (type, role, verificationState, etc.) but for Avizio's flow we only need
 * the resource `name` (e.g. "accounts/123456789") to fetch locations and
 * the display name for the picker UI.
 */
export type GbpAccount = {
	readonly name: string;
	readonly accountName: string | null;
};

const accountSchema = z.object({
	name: z.string().min(1),
	accountName: z.string().optional(),
});

const listAccountsResponseSchema = z.object({
	accounts: z.array(accountSchema).optional(),
	nextPageToken: z.string().optional(),
});

const safeJsonParseText = fromThrowable(
	(raw: string) => JSON.parse(raw) as unknown,
	() => "json_parse_failed" as const,
);

function zodIssuesToValidationIssues(
	error: z.ZodError,
): readonly ValidationIssue[] {
	return error.issues.map((i) => ({
		path: i.path.map(String),
		message: i.message,
	}));
}

function toNetworkError(e: unknown): IntegrationError {
	return {
		kind: "integration_network",
		provider: PROVIDER,
		message: unknownToMessage(e),
	};
}

/**
 * Map a non-2xx Business Profile response into a discriminated error. The
 * two cases we peel from `403` are the ones the caller specifically cares
 * about — scope not granted (waiting on Google approval of business.manage)
 * and legacy-v4 API access denied (the reviews gate). Everything else falls
 * through to `gbp_http_error` with the raw status + body.
 */
function toGbpHttpError(
	status: number,
	body: string,
): GbpError | IntegrationError {
	if (status === 401) {
		return { kind: "integration_unauthorized", provider: PROVIDER };
	}
	if (status === 429) {
		return {
			kind: "integration_rate_limited",
			provider: PROVIDER,
			retryAfterMs: 60_000,
		};
	}
	if (status === 403) {
		if (body.includes("insufficient") && body.includes("scope")) {
			return { kind: "gbp_insufficient_scope", grantedScopes: [] };
		}
		if (
			body.includes("accessNotConfigured") ||
			body.includes("API_NOT_ENABLED") ||
			body.includes("has not been used")
		) {
			return { kind: "gbp_legacy_api_access_denied" };
		}
	}
	return { kind: "gbp_http_error", status, body };
}

/**
 * GET the authenticated user's Business Profile accounts. Non-paginated for
 * now — the target user persona ("restaurateur avec 1 à 5 établissements")
 * never owns enough accounts to warrant paging, and the account picker UI
 * that'll consume this is already capped at a small list.
 */
export async function listAccounts(
	accessToken: string,
): Promise<Result<GbpAccount[], GbpError | IntegrationError>> {
	const responseResult = await fromPromise(
		fetch(`${ACCOUNT_MANAGEMENT_BASE}/accounts`, {
			headers: { authorization: `Bearer ${accessToken}` },
		}),
		toNetworkError,
	);
	if (responseResult.isErr()) return err(responseResult.error);
	const response = responseResult.value;

	const bodyResult = await fromPromise(response.text(), toNetworkError);
	if (bodyResult.isErr()) return err(bodyResult.error);
	const rawBody = bodyResult.value;

	if (!response.ok) {
		return err(toGbpHttpError(response.status, rawBody));
	}

	const jsonResult = safeJsonParseText(rawBody);
	if (jsonResult.isErr()) {
		return err({
			kind: "gbp_invalid_response",
			issues: [{ path: [], message: "response body is not valid JSON" }],
		});
	}

	const parsed = listAccountsResponseSchema.safeParse(jsonResult.value);
	if (!parsed.success) {
		return err({
			kind: "gbp_invalid_response",
			issues: zodIssuesToValidationIssues(parsed.error),
		});
	}

	const accounts: GbpAccount[] = (parsed.data.accounts ?? []).map((a) => ({
		name: a.name,
		accountName: a.accountName ?? null,
	}));
	return ok(accounts);
}

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
