import { defineConfig } from "@trigger.dev/sdk/v3";

/**
 * Trigger.dev v3 project config. Read by the `trigger.dev` CLI when running
 * `dev` / `deploy` — NOT by the Vercel app at runtime. The app uses
 * `@trigger.dev/sdk` only to dispatch tasks by their id.
 *
 * The project ref is passed via `TRIGGER_PROJECT_REF` — locally through
 * `.env.local`, in CI through a GitHub Actions repository variable. We
 * fail fast if missing so a misconfigured environment is obvious rather
 * than silently trying to deploy to the wrong project.
 */
const projectRef = process.env.TRIGGER_PROJECT_REF;
if (!projectRef || projectRef.length === 0) {
	throw new Error(
		"TRIGGER_PROJECT_REF env var is required. Set it in .env.local for local dev, or as a GitHub Actions variable for CI deploys.",
	);
}

export default defineConfig({
	project: projectRef,
	dirs: ["./trigger"],
	runtime: "node",
	logLevel: "info",
	maxDuration: 60,
	retries: {
		enabledInDev: true,
		default: {
			maxAttempts: 3,
			minTimeoutInMs: 1000,
			maxTimeoutInMs: 10000,
			factor: 2,
			randomize: true,
		},
	},
});
