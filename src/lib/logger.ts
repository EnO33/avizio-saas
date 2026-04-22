import pino, { type LoggerOptions } from "pino";
import { env } from "./env";

const isDev = env.NODE_ENV === "development";

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
