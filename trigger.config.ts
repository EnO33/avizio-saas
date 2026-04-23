import { defineConfig } from "@trigger.dev/sdk/v3";

/**
 * Trigger.dev v3 project config. Read by the `trigger.dev` CLI when running
 * `dev` / `deploy` — NOT by the Vercel app at runtime. The app uses
 * `@trigger.dev/sdk` only to dispatch tasks by their id.
 *
 * `project` must match the ref shown in the Trigger.dev dashboard (format
 * `proj_xxxxxxxxxxxxxxxxxxxx`). We read it from env so we don't have to
 * commit a project-specific string — set `TRIGGER_PROJECT_REF` locally
 * (via `.env.local`) and in the Trigger.dev GitHub Action secrets when
 * we wire up auto-deploy.
 */
export default defineConfig({
	project: process.env.TRIGGER_PROJECT_REF ?? "proj_placeholder",
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
