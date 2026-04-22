import { describe, expect, it } from "vitest";
import { decryptWith, encryptWith, type KeyMap } from "./crypto";

const key1 = Buffer.alloc(32, 0x01);
const key2 = Buffer.alloc(32, 0x02);
const keys: KeyMap = { v1: key1, v2: key2 };

function okOrThrow<T, E>(r: { isErr: () => boolean; value?: T; error?: E }): T {
	if (r.isErr()) {
		throw new Error(`expected Ok, got Err: ${JSON.stringify(r.error)}`);
	}
	return r.value as T;
}

describe("crypto — round-trip", () => {
	it("encrypt then decrypt returns the original plaintext", () => {
		const stored = okOrThrow(encryptWith("hello world", keys, "v1"));
		const decrypted = okOrThrow(decryptWith(stored, keys));
		expect(decrypted).toBe("hello world");
	});

	it("encrypts same plaintext differently each time (nonce randomness)", () => {
		const a = okOrThrow(encryptWith("dup", keys, "v1"));
		const b = okOrThrow(encryptWith("dup", keys, "v1"));
		expect(a).not.toBe(b);
	});

	it("prefixes output with the version used to encrypt", () => {
		const stored = okOrThrow(encryptWith("x", keys, "v2"));
		expect(stored.startsWith("v2:")).toBe(true);
	});

	it("round-trips the empty string", () => {
		const stored = okOrThrow(encryptWith("", keys, "v1"));
		expect(okOrThrow(decryptWith(stored, keys))).toBe("");
	});

	it("round-trips unicode and long strings", () => {
		const plain = "éàü 🎉 ".repeat(500);
		const stored = okOrThrow(encryptWith(plain, keys, "v1"));
		expect(okOrThrow(decryptWith(stored, keys))).toBe(plain);
	});
});

describe("crypto — rotation", () => {
	it("old v1 ciphertexts still decrypt after v2 becomes current", () => {
		const oldCiphertext = okOrThrow(encryptWith("legacy", keys, "v1"));
		const newCiphertext = okOrThrow(encryptWith("modern", keys, "v2"));

		expect(newCiphertext.startsWith("v2:")).toBe(true);
		expect(okOrThrow(decryptWith(oldCiphertext, keys))).toBe("legacy");
		expect(okOrThrow(decryptWith(newCiphertext, keys))).toBe("modern");
	});

	it("decrypting with a key set that dropped v1 yields unknown_version", () => {
		const stored = okOrThrow(encryptWith("x", keys, "v1"));
		const keysWithoutV1: KeyMap = { v2: key2 };
		const result = decryptWith(stored, keysWithoutV1);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("unknown_version");
		if (result.error.kind === "unknown_version") {
			expect(result.error.version).toBe("v1");
		}
	});
});

describe("crypto — encryption errors", () => {
	it("returns unknown_version when encrypting with a missing version", () => {
		const result = encryptWith("x", keys, "v99");
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("unknown_version");
	});
});

describe("crypto — decryption errors", () => {
	it.each([
		["no colons", "not-encrypted"],
		["two parts only", "v1:nonce"],
		["four parts", "v1:a:b:c"],
		["empty middle part", "v1::ciphertext"],
	])("returns invalid_format for %s", (_label, stored) => {
		const result = decryptWith(stored, keys);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("invalid_format");
	});

	it("returns invalid_format when the nonce length is wrong", () => {
		const shortNonce = Buffer.alloc(8).toString("base64url");
		const padding = "A".repeat(30);
		const result = decryptWith(`v1:${shortNonce}:${padding}`, keys);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("invalid_format");
	});

	it("returns decryption_failed when the ciphertext is tampered", () => {
		const stored = okOrThrow(encryptWith("secret", keys, "v1"));
		const last = stored.slice(-1);
		const tampered = stored.slice(0, -1) + (last === "A" ? "B" : "A");
		const result = decryptWith(tampered, keys);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("decryption_failed");
	});

	it("returns decryption_failed when the version prefix is swapped to another key", () => {
		const stored = okOrThrow(encryptWith("x", keys, "v1"));
		const swapped = stored.replace(/^v1:/, "v2:");
		const result = decryptWith(swapped, keys);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("decryption_failed");
	});
});
