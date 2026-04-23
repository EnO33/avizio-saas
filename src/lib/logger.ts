import pino, { type LoggerOptions } from "pino";
import { env } from "./env";

// `import.meta.env.DEV` is a Vite build-time constant. In a prod build it
// is replaced literally by `false`, so the `pino-pretty` branch (and its
// import) is dead-code-eliminated — no transport target shipped to prod,
// and no runtime dependency on a devDep that isn't bundled.
//
// Do NOT use `env.NODE_ENV === "development"` here: that's a runtime check,
// which means the prod bundle still references `pino-pretty` transport,
// and Vercel crashes with `unable to determine transport target`.
const isDev = import.meta.env.DEV;

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
