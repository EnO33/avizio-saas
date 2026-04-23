import { z } from "zod";
import { env } from "#/lib/env";
import type {
	IntegrationError,
	OAuthError,
	ValidationIssue,
} from "#/lib/errors";
import { unknownToMessage } from "#/lib/errors";
import { err, fromPromise, fromThrowable, ok, type Result } from "#/lib/result";

const PROVIDER = "google";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const VALID_ISSUERS = new Set([
	"https://accounts.google.com",
	"accounts.google.com",
]);

export const GOOGLE_OAUTH_CALLBACK_PATH = "/api/oauth/google/callback";

/**
 * Scope set requested during the consent flow.
 *  - `openid email profile`: standard OIDC claims — we read `sub` as stable
 *    account id and `email` as human label on the connection row.
 *  - `business.manage`: umbrella scope covering the Business Profile APIs we
 *    plan to use (list locations, list + reply to reviews).
 */
export const GOOGLE_OAUTH_SCOPES: readonly string[] = [
	"openid",
	"email",
	"profile",
	"https://www.googleapis.com/auth/business.manage",
];

const tokenResponseSchema = z.object({
	access_token: z.string().min(1),
	expires_in: z.number().int().positive(),
	refresh_token: z.string().min(1).optional(),
	scope: z.string().min(1),
	token_type: z.string().min(1),
	id_token: z.string().min(1),
});

export type GoogleTokenResponse = z.infer<typeof tokenResponseSchema>;

// The refresh response shares most fields with the initial exchange but
// drops `id_token` (refresh flows don't re-issue identity) and may omit
// `refresh_token` when Google chooses not to rotate it.
const refreshResponseSchema = z.object({
	access_token: z.string().min(1),
	expires_in: z.number().int().positive(),
	refresh_token: z.string().min(1).optional(),
	scope: z.string().min(1),
	token_type: z.string().min(1),
});

export type GoogleRefreshResponse = z.infer<typeof refreshResponseSchema>;

const idTokenPayloadSchema = z.object({
	iss: z.string().min(1),
	aud: z.string().min(1),
	sub: z.string().min(1),
	exp: z.number().int().nonnegative(),
	email: z.string().optional(),
	email_verified: z.boolean().optional(),
	name: z.string().optional(),
});

export type GoogleIdTokenClaims = z.infer<typeof idTokenPayloadSchema>;

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
 * Build the Google consent URL the user is redirected to when they click
 * "Connect Google Business Profile". `redirectUri` must match one of the
 * Authorized redirect URIs configured on the OAuth client in Google Cloud.
 *
 * `access_type=offline` + `prompt=consent` guarantee we receive a refresh
 * token — without `prompt=consent`, Google omits it on subsequent consents
 * for the same client, which would break re-connection flows.
 */
export function buildAuthUrl(params: {
	state: string;
	redirectUri: string;
	loginHint?: string;
}): string {
	const url = new URL(AUTH_ENDPOINT);
	url.searchParams.set("client_id", env.GOOGLE_OAUTH_CLIENT_ID);
	url.searchParams.set("redirect_uri", params.redirectUri);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", GOOGLE_OAUTH_SCOPES.join(" "));
	url.searchParams.set("state", params.state);
	url.searchParams.set("access_type", "offline");
	url.searchParams.set("prompt", "consent");
	url.searchParams.set("include_granted_scopes", "true");
	if (params.loginHint) url.searchParams.set("login_hint", params.loginHint);
	return url.toString();
}

/**
 * Exchange an authorization code for the token set. Network-level failures
 * surface as `IntegrationError`; Google-side failures (HTTP 4xx/5xx, malformed
 * response) surface as `OAuthError`.
 */
export async function exchangeCodeForTokens(params: {
	code: string;
	redirectUri: string;
}): Promise<Result<GoogleTokenResponse, OAuthError | IntegrationError>> {
	const body = new URLSearchParams({
		code: params.code,
		client_id: env.GOOGLE_OAUTH_CLIENT_ID,
		client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
		redirect_uri: params.redirectUri,
		grant_type: "authorization_code",
	});

	const responseResult = await fromPromise(
		fetch(TOKEN_ENDPOINT, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: body.toString(),
		}),
		toNetworkError,
	);

	if (responseResult.isErr()) return err(responseResult.error);
	const response = responseResult.value;

	const rawBodyResult = await fromPromise(response.text(), toNetworkError);
	if (rawBodyResult.isErr()) return err(rawBodyResult.error);
	const rawBody = rawBodyResult.value;

	if (!response.ok) {
		return err({
			kind: "oauth_token_exchange_failed",
			status: response.status,
			body: rawBody,
		});
	}

	const jsonResult = safeJsonParseText(rawBody);
	if (jsonResult.isErr()) {
		return err({
			kind: "oauth_token_exchange_invalid_response",
			issues: [{ path: [], message: "response body is not valid JSON" }],
		});
	}

	const parsed = tokenResponseSchema.safeParse(jsonResult.value);
	if (!parsed.success) {
		return err({
			kind: "oauth_token_exchange_invalid_response",
			issues: zodIssuesToValidationIssues(parsed.error),
		});
	}

	return ok(parsed.data);
}

/**
 * Exchange a refresh_token for a fresh access_token. Called whenever the
 * stored access_token is expired or close to expiry. Google may or may not
 * rotate the refresh_token — when it does, the response carries a new one
 * and the caller must persist it; when it doesn't, we keep the existing one.
 *
 * A HTTP 400 with `invalid_grant` in the body means the refresh_token was
 * revoked (user removed app access from their Google account, admin forced
 * sign-out, etc.). Callers treat that as a terminal connection failure and
 * soft-delete the row so the user is prompted to re-connect.
 */
export async function refreshAccessToken(params: {
	refreshToken: string;
}): Promise<Result<GoogleRefreshResponse, OAuthError | IntegrationError>> {
	const body = new URLSearchParams({
		client_id: env.GOOGLE_OAUTH_CLIENT_ID,
		client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
		refresh_token: params.refreshToken,
		grant_type: "refresh_token",
	});

	const responseResult = await fromPromise(
		fetch(TOKEN_ENDPOINT, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: body.toString(),
		}),
		toNetworkError,
	);
	if (responseResult.isErr()) return err(responseResult.error);
	const response = responseResult.value;

	const rawBodyResult = await fromPromise(response.text(), toNetworkError);
	if (rawBodyResult.isErr()) return err(rawBodyResult.error);
	const rawBody = rawBodyResult.value;

	if (!response.ok) {
		return err({
			kind: "oauth_token_exchange_failed",
			status: response.status,
			body: rawBody,
		});
	}

	const jsonResult = safeJsonParseText(rawBody);
	if (jsonResult.isErr()) {
		return err({
			kind: "oauth_token_exchange_invalid_response",
			issues: [{ path: [], message: "response body is not valid JSON" }],
		});
	}

	const parsed = refreshResponseSchema.safeParse(jsonResult.value);
	if (!parsed.success) {
		return err({
			kind: "oauth_token_exchange_invalid_response",
			issues: zodIssuesToValidationIssues(parsed.error),
		});
	}

	return ok(parsed.data);
}

/**
 * Helper: detect whether a `token_exchange_failed` OAuthError is the
 * specific "refresh token revoked" case. Google signals that with a 400 +
 * `invalid_grant` error code in the JSON body. Callers use this to decide
 * between retry vs. mark the connection revoked. Accepts the union of
 * errors `refreshAccessToken` can return so a caller can pass `result.error`
 * straight through without narrowing first.
 */
export function isRefreshTokenRevoked(
	error: OAuthError | IntegrationError,
): boolean {
	return (
		error.kind === "oauth_token_exchange_failed" &&
		error.status === 400 &&
		error.body.includes("invalid_grant")
	);
}

/**
 * Revoke a token (access or refresh) server-side with Google. Per RFC 7009 +
 * Google's docs, a 200 means revoked; a 400 with `invalid_token` means the
 * token was already invalid — both are success states for our purposes
 * (the user ends up with no active authorization).
 */
export async function revokeGoogleToken(
	token: string,
): Promise<Result<void, OAuthError | IntegrationError>> {
	const responseResult = await fromPromise(
		fetch(REVOKE_ENDPOINT, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ token }).toString(),
		}),
		toNetworkError,
	);
	if (responseResult.isErr()) return err(responseResult.error);
	const response = responseResult.value;

	if (response.ok) return ok(undefined);

	const bodyResult = await fromPromise(response.text(), toNetworkError);
	const body = bodyResult.isOk() ? bodyResult.value : "";

	// `invalid_token` means it was already revoked / expired — treat as success.
	if (response.status === 400 && body.includes("invalid_token")) {
		return ok(undefined);
	}

	return err({
		kind: "oauth_token_exchange_failed",
		status: response.status,
		body,
	});
}

/**
 * Decode the OIDC `id_token` payload and validate the issuer + audience.
 *
 * Signature verification is intentionally skipped: the token was received
 * directly from Google's token endpoint over TLS via `exchangeCodeForTokens`,
 * so the transport already authenticates the origin. This is explicitly
 * endorsed by Google's OpenID Connect docs for server-to-server flows.
 */
export function decodeIdToken(
	idToken: string,
): Result<GoogleIdTokenClaims, OAuthError> {
	const parts = idToken.split(".");
	if (parts.length !== 3) return err({ kind: "oauth_id_token_invalid" });
	const payloadB64 = parts[1];
	if (!payloadB64) return err({ kind: "oauth_id_token_invalid" });

	const jsonResult = safeJsonParseText(
		Buffer.from(payloadB64, "base64url").toString("utf8"),
	);
	if (jsonResult.isErr()) return err({ kind: "oauth_id_token_invalid" });

	const parsed = idTokenPayloadSchema.safeParse(jsonResult.value);
	if (!parsed.success) return err({ kind: "oauth_id_token_invalid" });

	const claims = parsed.data;
	if (!VALID_ISSUERS.has(claims.iss)) {
		return err({ kind: "oauth_id_token_invalid" });
	}
	if (claims.aud !== env.GOOGLE_OAUTH_CLIENT_ID) {
		return err({ kind: "oauth_id_token_invalid" });
	}

	return ok(claims);
}
