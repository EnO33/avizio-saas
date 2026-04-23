import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "#/lib/env";
import {
	buildAuthUrl,
	decodeIdToken,
	exchangeCodeForTokens,
	GOOGLE_OAUTH_SCOPES,
	type GoogleIdTokenClaims,
	isRefreshTokenRevoked,
	refreshAccessToken,
	revokeGoogleToken,
} from "./google-business-oauth";

// ── fixtures ───────────────────────────────────────────────────────────────

const REDIRECT = "http://localhost:3000/api/oauth/google/callback";

function makeIdToken(claims: Partial<GoogleIdTokenClaims> = {}): string {
	const payload: GoogleIdTokenClaims = {
		iss: "https://accounts.google.com",
		aud: env.GOOGLE_OAUTH_CLIENT_ID,
		sub: "1234567890",
		exp: Math.floor(Date.now() / 1000) + 3600,
		email: "owner@example.com",
		email_verified: true,
		name: "Owner Example",
		...claims,
	};
	const header = Buffer.from(
		JSON.stringify({ alg: "RS256", kid: "test" }),
		"utf8",
	).toString("base64url");
	const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
		"base64url",
	);
	return `${header}.${payloadB64}.test-signature`;
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

// ── buildAuthUrl ───────────────────────────────────────────────────────────

describe("buildAuthUrl", () => {
	it("points at Google's v2 auth endpoint", () => {
		const url = new URL(buildAuthUrl({ state: "abc", redirectUri: REDIRECT }));
		expect(url.origin + url.pathname).toBe(
			"https://accounts.google.com/o/oauth2/v2/auth",
		);
	});

	it("includes client_id, redirect_uri, state and the standard scope set", () => {
		const url = new URL(buildAuthUrl({ state: "abc", redirectUri: REDIRECT }));
		expect(url.searchParams.get("client_id")).toBe(env.GOOGLE_OAUTH_CLIENT_ID);
		expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT);
		expect(url.searchParams.get("state")).toBe("abc");
		expect(url.searchParams.get("response_type")).toBe("code");
		expect(url.searchParams.get("scope")).toBe(GOOGLE_OAUTH_SCOPES.join(" "));
	});

	it("forces offline access and consent prompt so refresh_token is always returned", () => {
		const url = new URL(buildAuthUrl({ state: "abc", redirectUri: REDIRECT }));
		expect(url.searchParams.get("access_type")).toBe("offline");
		expect(url.searchParams.get("prompt")).toBe("consent");
		expect(url.searchParams.get("include_granted_scopes")).toBe("true");
	});

	it("passes through login_hint when provided", () => {
		const url = new URL(
			buildAuthUrl({
				state: "abc",
				redirectUri: REDIRECT,
				loginHint: "boss@resto.fr",
			}),
		);
		expect(url.searchParams.get("login_hint")).toBe("boss@resto.fr");
	});

	it("omits login_hint when not provided", () => {
		const url = new URL(buildAuthUrl({ state: "abc", redirectUri: REDIRECT }));
		expect(url.searchParams.has("login_hint")).toBe(false);
	});
});

// ── decodeIdToken ──────────────────────────────────────────────────────────

describe("decodeIdToken", () => {
	it("returns the claims on a well-formed token", () => {
		const token = makeIdToken();
		const result = decodeIdToken(token);
		expect(result.isOk()).toBe(true);
		if (result.isErr()) throw new Error("unreachable");
		expect(result.value.sub).toBe("1234567890");
		expect(result.value.email).toBe("owner@example.com");
	});

	it("accepts `accounts.google.com` as issuer (without protocol)", () => {
		const token = makeIdToken({ iss: "accounts.google.com" });
		expect(decodeIdToken(token).isOk()).toBe(true);
	});

	it("returns invalid when issuer is unknown", () => {
		const token = makeIdToken({ iss: "https://evil.com" });
		const result = decodeIdToken(token);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_id_token_invalid");
	});

	it("returns invalid when audience doesn't match the client id", () => {
		const token = makeIdToken({ aud: "other-client-id" });
		const result = decodeIdToken(token);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_id_token_invalid");
	});

	it.each([
		["not enough parts", "only.two"],
		["too many parts", "a.b.c.d"],
		["empty payload", "header..signature"],
		["not base64url", "a.!!!.c"],
	])("returns invalid for malformed token (%s)", (_label, token) => {
		const result = decodeIdToken(token);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_id_token_invalid");
	});

	it("returns invalid when required claims are missing", () => {
		// Build a token whose payload is valid JSON but missing `sub`.
		const badPayload = Buffer.from(
			JSON.stringify({
				iss: "https://accounts.google.com",
				aud: env.GOOGLE_OAUTH_CLIENT_ID,
				exp: 9_999_999_999,
			}),
			"utf8",
		).toString("base64url");
		const result = decodeIdToken(`header.${badPayload}.sig`);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_id_token_invalid");
	});
});

// ── exchangeCodeForTokens ──────────────────────────────────────────────────

describe("exchangeCodeForTokens", () => {
	beforeEach(() => {
		vi.spyOn(globalThis, "fetch");
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("POSTs form-encoded credentials to Google's token endpoint", async () => {
		const fetchMock = vi.mocked(globalThis.fetch);
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				access_token: "at",
				expires_in: 3599,
				refresh_token: "rt",
				scope: GOOGLE_OAUTH_SCOPES.join(" "),
				token_type: "Bearer",
				id_token: makeIdToken(),
			}),
		);

		const result = await exchangeCodeForTokens({
			code: "auth-code",
			redirectUri: REDIRECT,
		});
		expect(result.isOk()).toBe(true);

		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://oauth2.googleapis.com/token");
		expect(init.method).toBe("POST");
		const body = new URLSearchParams(init.body as string);
		expect(body.get("code")).toBe("auth-code");
		expect(body.get("grant_type")).toBe("authorization_code");
		expect(body.get("redirect_uri")).toBe(REDIRECT);
		expect(body.get("client_id")).toBe(env.GOOGLE_OAUTH_CLIENT_ID);
		expect(body.get("client_secret")).toBe(env.GOOGLE_OAUTH_CLIENT_SECRET);
	});

	it("returns oauth_token_exchange_failed on HTTP 4xx with the response body", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response("invalid_grant", { status: 400 }),
		);

		const result = await exchangeCodeForTokens({
			code: "bad-code",
			redirectUri: REDIRECT,
		});
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_token_exchange_failed");
		if (result.error.kind !== "oauth_token_exchange_failed") {
			throw new Error("unreachable");
		}
		expect(result.error.status).toBe(400);
		expect(result.error.body).toBe("invalid_grant");
	});

	it("returns invalid_response when the body is not JSON", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response("<html>oops</html>", {
				status: 200,
				headers: { "content-type": "text/html" },
			}),
		);

		const result = await exchangeCodeForTokens({
			code: "c",
			redirectUri: REDIRECT,
		});
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_token_exchange_invalid_response");
	});

	it("returns invalid_response when the JSON doesn't match the schema", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			jsonResponse({ access_token: "at" }), // missing required fields
		);

		const result = await exchangeCodeForTokens({
			code: "c",
			redirectUri: REDIRECT,
		});
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_token_exchange_invalid_response");
	});

	it("returns integration_network on fetch rejection", async () => {
		vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error("ENETDOWN"));

		const result = await exchangeCodeForTokens({
			code: "c",
			redirectUri: REDIRECT,
		});
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("integration_network");
	});
});

// ── revokeGoogleToken ──────────────────────────────────────────────────────

describe("revokeGoogleToken", () => {
	beforeEach(() => {
		vi.spyOn(globalThis, "fetch");
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("POSTs the token to Google's revoke endpoint", async () => {
		const fetchMock = vi.mocked(globalThis.fetch);
		fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));

		const result = await revokeGoogleToken("my-token");
		expect(result.isOk()).toBe(true);

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://oauth2.googleapis.com/revoke");
		expect(init.method).toBe("POST");
		expect(new URLSearchParams(init.body as string).get("token")).toBe(
			"my-token",
		);
	});

	it("treats a 400 with invalid_token as success (already revoked)", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response(JSON.stringify({ error: "invalid_token" }), {
				status: 400,
			}),
		);

		const result = await revokeGoogleToken("already-dead");
		expect(result.isOk()).toBe(true);
	});

	it("surfaces other 4xx responses as oauth_token_exchange_failed", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response("nope", { status: 403 }),
		);

		const result = await revokeGoogleToken("bad");
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_token_exchange_failed");
		if (result.error.kind !== "oauth_token_exchange_failed") {
			throw new Error("unreachable");
		}
		expect(result.error.status).toBe(403);
	});

	it("returns integration_network on fetch rejection", async () => {
		vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error("ENETDOWN"));

		const result = await revokeGoogleToken("x");
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("integration_network");
	});
});

// ── refreshAccessToken ─────────────────────────────────────────────────────

describe("refreshAccessToken", () => {
	beforeEach(() => {
		vi.spyOn(globalThis, "fetch");
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("POSTs form-encoded credentials with grant_type=refresh_token", async () => {
		const fetchMock = vi.mocked(globalThis.fetch);
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				access_token: "new-at",
				expires_in: 3599,
				scope: GOOGLE_OAUTH_SCOPES.join(" "),
				token_type: "Bearer",
			}),
		);

		const result = await refreshAccessToken({ refreshToken: "old-rt" });
		expect(result.isOk()).toBe(true);

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://oauth2.googleapis.com/token");
		expect(init.method).toBe("POST");
		const body = new URLSearchParams(init.body as string);
		expect(body.get("grant_type")).toBe("refresh_token");
		expect(body.get("refresh_token")).toBe("old-rt");
		expect(body.get("client_id")).toBe(env.GOOGLE_OAUTH_CLIENT_ID);
		expect(body.get("client_secret")).toBe(env.GOOGLE_OAUTH_CLIENT_SECRET);
	});

	it("returns the parsed response when Google omits a new refresh_token", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			jsonResponse({
				access_token: "new-at",
				expires_in: 3599,
				scope: "openid email profile",
				token_type: "Bearer",
			}),
		);

		const result = await refreshAccessToken({ refreshToken: "rt" });
		expect(result.isOk()).toBe(true);
		if (result.isErr()) throw new Error("unreachable");
		expect(result.value.access_token).toBe("new-at");
		expect(result.value.refresh_token).toBeUndefined();
	});

	it("preserves a rotated refresh_token when Google returns one", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			jsonResponse({
				access_token: "new-at",
				expires_in: 3599,
				refresh_token: "rotated-rt",
				scope: "openid email profile",
				token_type: "Bearer",
			}),
		);

		const result = await refreshAccessToken({ refreshToken: "rt" });
		expect(result.isOk()).toBe(true);
		if (result.isErr()) throw new Error("unreachable");
		expect(result.value.refresh_token).toBe("rotated-rt");
	});

	it("returns oauth_token_exchange_failed on HTTP 400 with invalid_grant", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
		);

		const result = await refreshAccessToken({ refreshToken: "revoked" });
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_token_exchange_failed");
		expect(isRefreshTokenRevoked(result.error)).toBe(true);
	});

	it("returns oauth_token_exchange_failed on other HTTP errors", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response("server error", { status: 500 }),
		);

		const result = await refreshAccessToken({ refreshToken: "x" });
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_token_exchange_failed");
		expect(isRefreshTokenRevoked(result.error)).toBe(false);
	});

	it("returns invalid_response when the body is malformed", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response("<html>oops</html>", { status: 200 }),
		);

		const result = await refreshAccessToken({ refreshToken: "x" });
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_token_exchange_invalid_response");
	});

	it("returns integration_network on fetch rejection", async () => {
		vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error("ENETDOWN"));

		const result = await refreshAccessToken({ refreshToken: "x" });
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("integration_network");
	});
});

describe("isRefreshTokenRevoked", () => {
	it("returns true for 400 + invalid_grant body", () => {
		const error = {
			kind: "oauth_token_exchange_failed",
			status: 400,
			body: '{"error":"invalid_grant"}',
		} as const;
		expect(isRefreshTokenRevoked(error)).toBe(true);
	});

	it("returns false for 400 without invalid_grant", () => {
		const error = {
			kind: "oauth_token_exchange_failed",
			status: 400,
			body: '{"error":"invalid_request"}',
		} as const;
		expect(isRefreshTokenRevoked(error)).toBe(false);
	});

	it("returns false for non-token-exchange errors", () => {
		expect(isRefreshTokenRevoked({ kind: "oauth_id_token_invalid" })).toBe(
			false,
		);
	});
});
