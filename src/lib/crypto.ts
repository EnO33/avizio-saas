import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";
import { err, fromThrowable, ok, type Result } from "./result";

export type CryptoError =
	| { readonly kind: "invalid_format" }
	| { readonly kind: "unknown_version"; readonly version: string }
	| { readonly kind: "decryption_failed" };

const ALGO = "aes-256-gcm";
const NONCE_LEN = 12;
const TAG_LEN = 16;

function getKey(version: string): Result<Buffer, CryptoError> {
	const base64 = env.ENCRYPTION_KEYS_JSON[version];
	if (!base64) return err({ kind: "unknown_version", version });
	return ok(Buffer.from(base64, "base64"));
}

export function encryptToken(plaintext: string): Result<string, CryptoError> {
	const version = env.ENCRYPTION_KEY_CURRENT;
	const keyResult = getKey(version);
	if (keyResult.isErr()) return err(keyResult.error);

	const nonce = randomBytes(NONCE_LEN);
	const cipher = createCipheriv(ALGO, keyResult.value, nonce);
	const ciphertext = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	const combined = Buffer.concat([ciphertext, tag]);

	return ok(
		`${version}:${nonce.toString("base64url")}:${combined.toString("base64url")}`,
	);
}

export function decryptToken(stored: string): Result<string, CryptoError> {
	const parts = stored.split(":");
	if (parts.length !== 3) return err({ kind: "invalid_format" });
	const [version, nonceB64, combinedB64] = parts;
	if (!version || !nonceB64 || !combinedB64) {
		return err({ kind: "invalid_format" });
	}

	const keyResult = getKey(version);
	if (keyResult.isErr()) return err(keyResult.error);

	const nonce = Buffer.from(nonceB64, "base64url");
	const combined = Buffer.from(combinedB64, "base64url");

	if (nonce.length !== NONCE_LEN || combined.length < TAG_LEN) {
		return err({ kind: "invalid_format" });
	}

	const ciphertext = combined.subarray(0, combined.length - TAG_LEN);
	const tag = combined.subarray(combined.length - TAG_LEN);

	const decipher = createDecipheriv(ALGO, keyResult.value, nonce);
	decipher.setAuthTag(tag);

	const decrypted = fromThrowable(
		() =>
			Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
				"utf8",
			),
		(): CryptoError => ({ kind: "decryption_failed" }),
	)();

	if (decrypted.isErr()) return err(decrypted.error);
	return ok(decrypted.value);
}
