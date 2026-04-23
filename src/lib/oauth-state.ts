import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "./env";
import type { OAuthError } from "./errors";
import { err, fromThrowable, ok, type Result } from "./result";

/**
 * Signed payload embedded in the OAuth `state` query parameter. We verify the
 * signature + expiry on callback to prevent cross-site request forgery and
 * replay outside the short-lived consent window.
 */
export type OAuthStatePayload = {
	readonly organizationId: string;
	readonly userId: string;
	readonly nonce: string;
	readonly issuedAt: number;
	readonly expiresAt: number;
};

const payloadSchema = z.object({
	organizationId: z.string().min(1),
	userId: z.string().min(1),
	nonce: z.string().min(1),
	issuedAt: z.number().int().nonnegative(),
	expiresAt: z.number().int().nonnegative(),
});

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const NONCE_LEN = 16;

const safeJsonParse = fromThrowable(
	(raw: string) => JSON.parse(raw) as unknown,
	() => ({ kind: "oauth_state_invalid_format" as const }) satisfies OAuthError,
);

function hmac(secret: string, message: string): Buffer {
	return createHmac("sha256", secret).update(message).digest();
}

/**
 * Produce a signed `state` token of the form `<payload-b64url>.<sig-b64url>`.
 * Pure — callers inject the secret and clock so tests stay deterministic.
 */
export function signState(payload: OAuthStatePayload, secret: string): string {
	const json = JSON.stringify(payload);
	const payloadB64 = Buffer.from(json, "utf8").toString("base64url");
	const signature = hmac(secret, payloadB64).toString("base64url");
	return `${payloadB64}.${signature}`;
}

/**
 * Verify a signed `state` token and return its payload. Checks:
 *  - structural shape (`<b64url>.<b64url>`)
 *  - HMAC-SHA256 signature (constant-time comparison)
 *  - payload schema (Zod)
 *  - expiry against `nowMs`
 */
export function verifyState(
	signed: string,
	secret: string,
	nowMs: number,
): Result<OAuthStatePayload, OAuthError> {
	const parts = signed.split(".");
	if (parts.length !== 2) {
		return err({ kind: "oauth_state_invalid_format" });
	}
	const [payloadB64, signatureB64] = parts;
	if (!payloadB64 || !signatureB64) {
		return err({ kind: "oauth_state_invalid_format" });
	}

	const expected = hmac(secret, payloadB64);
	const provided = Buffer.from(signatureB64, "base64url");
	if (
		provided.length !== expected.length ||
		!timingSafeEqual(provided, expected)
	) {
		return err({ kind: "oauth_state_signature_mismatch" });
	}

	const jsonResult = safeJsonParse(
		Buffer.from(payloadB64, "base64url").toString("utf8"),
	);
	if (jsonResult.isErr()) return err({ kind: "oauth_state_payload_invalid" });

	const parsed = payloadSchema.safeParse(jsonResult.value);
	if (!parsed.success) return err({ kind: "oauth_state_payload_invalid" });

	if (nowMs > parsed.data.expiresAt) {
		return err({ kind: "oauth_state_expired" });
	}

	return ok(parsed.data);
}

/**
 * Env-bound helper used by the OAuth start server fn. TTL defaults to
 * 10 minutes, which comfortably covers a real user consent flow without
 * leaving the window wide open.
 */
export function createState(params: {
	organizationId: string;
	userId: string;
	ttlMs?: number;
}): string {
	const now = Date.now();
	const ttl = params.ttlMs ?? DEFAULT_TTL_MS;
	const payload: OAuthStatePayload = {
		organizationId: params.organizationId,
		userId: params.userId,
		nonce: randomBytes(NONCE_LEN).toString("base64url"),
		issuedAt: now,
		expiresAt: now + ttl,
	};
	return signState(payload, env.OAUTH_STATE_SECRET);
}

/**
 * Env-bound helper used by the OAuth callback route. Uses the current wall
 * clock; tests should call `verifyState` directly to inject a deterministic
 * time.
 */
export function readState(
	signed: string,
): Result<OAuthStatePayload, OAuthError> {
	return verifyState(signed, env.OAUTH_STATE_SECRET, Date.now());
}
