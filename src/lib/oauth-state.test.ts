import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { type OAuthStatePayload, signState, verifyState } from "./oauth-state";

function hmacB64Url(secret: string, message: string): string {
	return createHmac("sha256", secret).update(message).digest("base64url");
}

const SECRET = "test-secret-at-least-32-chars-long-placeholder";
const NOW = 1_700_000_000_000;

function makePayload(
	overrides: Partial<OAuthStatePayload> = {},
): OAuthStatePayload {
	return {
		organizationId: "org_abc",
		userId: "user_xyz",
		nonce: "nonce-123",
		issuedAt: NOW,
		expiresAt: NOW + 10 * 60 * 1000,
		...overrides,
	};
}

function okOrThrow<T, E>(r: { isErr: () => boolean; value?: T; error?: E }): T {
	if (r.isErr()) {
		throw new Error(`expected Ok, got Err: ${JSON.stringify(r.error)}`);
	}
	return r.value as T;
}

describe("oauth-state — round-trip", () => {
	it("sign then verify returns the original payload", () => {
		const payload = makePayload();
		const signed = signState(payload, SECRET);
		const verified = okOrThrow(verifyState(signed, SECRET, NOW));
		expect(verified).toEqual(payload);
	});

	it("produces a `<payload>.<signature>` shape with two base64url parts", () => {
		const signed = signState(makePayload(), SECRET);
		const parts = signed.split(".");
		expect(parts).toHaveLength(2);
		expect(parts[0]).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(parts[1]).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	it("verifies at exactly expiresAt boundary (inclusive)", () => {
		const signed = signState(makePayload(), SECRET);
		const verified = verifyState(signed, SECRET, NOW + 10 * 60 * 1000);
		expect(verified.isOk()).toBe(true);
	});
});

describe("oauth-state — verification errors", () => {
	it("returns invalid_format when the token has no dot", () => {
		const result = verifyState("abcdef", SECRET, NOW);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_state_invalid_format");
	});

	it("returns invalid_format when the token has more than one dot", () => {
		const result = verifyState("a.b.c", SECRET, NOW);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_state_invalid_format");
	});

	it("returns invalid_format when either half is empty", () => {
		const result = verifyState(".signature", SECRET, NOW);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_state_invalid_format");
	});

	it("returns signature_mismatch when signed with a different secret", () => {
		const signed = signState(makePayload(), SECRET);
		const result = verifyState(
			signed,
			"other-secret-32-chars-minimum-xxx",
			NOW,
		);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_state_signature_mismatch");
	});

	it("returns signature_mismatch when the payload is tampered", () => {
		const signed = signState(makePayload(), SECRET);
		const [payloadB64, sigB64] = signed.split(".");
		const decoded = JSON.parse(
			Buffer.from(payloadB64 as string, "base64url").toString("utf8"),
		);
		decoded.organizationId = "org_attacker";
		const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString(
			"base64url",
		);
		const tampered = `${tamperedPayload}.${sigB64}`;
		const result = verifyState(tampered, SECRET, NOW);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_state_signature_mismatch");
	});

	it("returns signature_mismatch when the signature is tampered", () => {
		const signed = signState(makePayload(), SECRET);
		const [payloadB64, sigB64] = signed.split(".");
		const original = sigB64 as string;
		const flipped = original.startsWith("A")
			? `B${original.slice(1)}`
			: `A${original.slice(1)}`;
		const result = verifyState(`${payloadB64}.${flipped}`, SECRET, NOW);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_state_signature_mismatch");
	});

	it("returns expired when nowMs is past expiresAt", () => {
		const signed = signState(makePayload(), SECRET);
		const result = verifyState(signed, SECRET, NOW + 11 * 60 * 1000);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_state_expired");
	});

	it("returns payload_invalid when the payload shape is unexpected", () => {
		// Craft a signed token whose payload is valid JSON but wrong shape.
		const badJson = JSON.stringify({ oops: 1 });
		const badPayloadB64 = Buffer.from(badJson, "utf8").toString("base64url");
		const sigB64 = hmacB64Url(SECRET, badPayloadB64);
		const signed = `${badPayloadB64}.${sigB64}`;
		const result = verifyState(signed, SECRET, NOW);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_state_payload_invalid");
	});

	it("returns payload_invalid when the payload is not valid JSON", () => {
		const notJson = Buffer.from("not-json-at-all", "utf8").toString(
			"base64url",
		);
		const sigB64 = hmacB64Url(SECRET, notJson);
		const result = verifyState(`${notJson}.${sigB64}`, SECRET, NOW);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("oauth_state_payload_invalid");
	});
});

describe("oauth-state — uniqueness", () => {
	it("two signed states with the same secret differ (nonce + issuedAt)", () => {
		const a = signState(makePayload({ nonce: "n1" }), SECRET);
		const b = signState(makePayload({ nonce: "n2" }), SECRET);
		expect(a).not.toBe(b);
	});
});
