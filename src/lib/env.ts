import { fromThrowable } from "neverthrow";
import { z } from "zod";

const safeJsonParse = fromThrowable(
	(raw: string) => JSON.parse(raw) as unknown,
	() => "json_parse_failed" as const,
);

const encryptionKeysMapSchema = z.record(
	z.string().regex(/^v\d+$/, "version keys must match v<number>"),
	z
		.base64()
		.refine(
			(s) => Buffer.from(s, "base64").length === 32,
			"encryption key must be base64 of exactly 32 bytes",
		),
);

const encryptionKeysJsonField = z.string().transform((raw, ctx) => {
	const parsed = safeJsonParse(raw);
	if (parsed.isErr()) {
		ctx.addIssue({ code: "custom", message: "not valid JSON" });
		return z.NEVER;
	}
	const validated = encryptionKeysMapSchema.safeParse(parsed.value);
	if (!validated.success) {
		ctx.addIssue({
			code: "custom",
			message: z.prettifyError(validated.error),
		});
		return z.NEVER;
	}
	return validated.data;
});

const envSchema = z
	.object({
		DATABASE_URL: z.url().startsWith("postgres"),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		CLERK_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
		CLERK_SECRET_KEY: z.string().startsWith("sk_"),
		CLERK_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
		ENCRYPTION_KEYS_JSON: encryptionKeysJsonField,
		ENCRYPTION_KEY_CURRENT: z.string().regex(/^v\d+$/, "must match v<number>"),
		GOOGLE_OAUTH_CLIENT_ID: z
			.string()
			.endsWith(".apps.googleusercontent.com")
			.describe("OAuth 2.0 Client ID from Google Cloud Console"),
		GOOGLE_OAUTH_CLIENT_SECRET: z
			.string()
			.startsWith("GOCSPX-")
			.describe("OAuth 2.0 Client secret from Google Cloud Console"),
		OAUTH_STATE_SECRET: z
			.string()
			.min(32, "OAUTH_STATE_SECRET must be at least 32 characters")
			.describe("HMAC key used to sign/verify the OAuth `state` parameter"),
		ANTHROPIC_API_KEY: z
			.string()
			.startsWith("sk-ant-")
			.describe("Anthropic API key for Claude models (response generation)"),
	})
	.refine((data) => data.ENCRYPTION_KEY_CURRENT in data.ENCRYPTION_KEYS_JSON, {
		message:
			"ENCRYPTION_KEY_CURRENT must reference a version present in ENCRYPTION_KEYS_JSON",
		path: ["ENCRYPTION_KEY_CURRENT"],
	});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	console.error(
		"Invalid environment variables:\n",
		z.prettifyError(parsed.error),
	);
	throw new Error("Invalid environment variables. See logs above.");
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
