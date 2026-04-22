import { z } from "zod";

const envSchema = z.object({
	DATABASE_URL: z.url().startsWith("postgres"),
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	CLERK_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
	CLERK_SECRET_KEY: z.string().startsWith("sk_"),
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
