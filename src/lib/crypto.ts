import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";
import { err, fromThrowable, ok, type Result } from "./result";

export type CryptoError =
	| { readonly kind: "invalid_format" }
	| { readonly kind: "unknown_version"; readonly version: string }
	| { readonly kind: "decryption_failed" };

export type KeyMap = Readonly<Record<string, Buffer>>;

const ALGO = "aes-256-gcm";
const NONCE_LEN = 12;
const TAG_LEN = 16;

const envKeys: KeyMap = Object.freeze(
	Object.fromEntries(
		Object.entries(env.ENCRYPTION_KEYS_JSON).map(([version, base64]) => [
			version,
			Buffer.from(base64, "base64"),
		]),
	),
);

export function encryptWith(
	plaintext: string,
	keys: KeyMap,
	version: string,
): Result<string, CryptoError> {
	const key = keys[version];
	if (!key) return err({ kind: "unknown_version", version });

	const nonce = randomBytes(NONCE_LEN);
	const cipher = createCipheriv(ALGO, key, nonce);
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

export function decryptWith(
	stored: string,
	keys: KeyMap,
): Result<string, CryptoError> {
	const parts = stored.split(":");
	if (parts.length !== 3) return err({ kind: "invalid_format" });
	const [version, nonceB64, combinedB64] = parts;
	if (!version || !nonceB64 || !combinedB64) {
		return err({ kind: "invalid_format" });
	}

	const key = keys[version];
	if (!key) return err({ kind: "unknown_version", version });

	const nonce = Buffer.from(nonceB64, "base64url");
	const combined = Buffer.from(combinedB64, "base64url");

	if (nonce.length !== NONCE_LEN || combined.length < TAG_LEN) {
		return err({ kind: "invalid_format" });
	}

	const ciphertext = combined.subarray(0, combined.length - TAG_LEN);
	const tag = combined.subarray(combined.length - TAG_LEN);

	const decipher = createDecipheriv(ALGO, key, nonce);
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

export const encryptToken = (plaintext: string): Result<string, CryptoError> =>
	encryptWith(plaintext, envKeys, env.ENCRYPTION_KEY_CURRENT);

export const decryptToken = (stored: string): Result<string, CryptoError> =>
	decryptWith(stored, envKeys);
