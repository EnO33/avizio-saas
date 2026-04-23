import pino, { type LoggerOptions } from "pino";
import { env } from "./env";

// `process.env.NODE_ENV` is replaced at build time by Vite (and by esbuild
// when Trigger.dev bundles tasks), so this stays a true compile-time
// constant in both target runtimes:
//  - Vite prod : "production" === "development" → false → the pino-pretty
//    transport branch is dead-code-eliminated, no devDep shipped.
//  - Trigger.dev Docker container : `process.env.NODE_ENV` is set to
//    "production" by the runner → false, plain JSON logs.
//  - Local dev (vite dev, trigger dev) : "development" → true, pino-pretty.
//
// Do NOT use `import.meta.env.DEV` here — it's undefined at runtime in
// non-Vite environments (Trigger.dev indexer), and reading `.DEV` crashes
// the module load with "Cannot read properties of undefined (reading 'DEV')".
//
// Do NOT use `env.NODE_ENV === "development"` either — that's a runtime
// check on our Zod-parsed env, which keeps the pino-pretty transport in
// the prod bundle and crashes Vercel with "unable to determine transport".
const isDev = process.env.NODE_ENV === "development";

const redactPaths = [
	"password",
	"passwordHash",
	"token",
	"accessToken",
	"refreshToken",
	"encryptedAccessToken",
	"encryptedRefreshToken",
	"authorization",
	"cookie",
	"email",
	"authorEmail",
	"*.password",
	"*.token",
	"*.accessToken",
	"*.refreshToken",
	"*.email",
	"*.authorization",
	"*.cookie",
	"headers.authorization",
	"headers.cookie",
];

const baseOptions: LoggerOptions = {
	level: isDev ? "debug" : "info",
	redact: { paths: redactPaths, censor: "[REDACTED]" },
	base: { env: env.NODE_ENV },
};

const options: LoggerOptions = isDev
	? {
			...baseOptions,
			transport: {
				target: "pino-pretty",
				options: {
					colorize: true,
					translateTime: "HH:MM:ss.l",
					ignore: "pid,hostname,env",
				},
			},
		}
	: baseOptions;

export const logger = pino(options);
export type Logger = typeof logger;
