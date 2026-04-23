import { defineConfig } from "@trigger.dev/sdk/v3";

/**
 * Trigger.dev v3 project config. Read by the `trigger.dev` CLI when running
 * `dev` / `deploy` — NOT by the Vercel app at runtime. The app uses
 * `@trigger.dev/sdk` only to dispatch tasks by their id.
 *
 * Project ref comes from `TRIGGER_PROJECT_REF` — locally through
 * `.env.local`, in CI through a GitHub Actions repository variable. The
 * placeholder fallback exists only to keep this file importable from
 * inside Trigger's remote Docker builder, which re-imports the config
 * during the indexer step without access to the GH Actions env. The CLI
 * (outside the container) always reads the real ref before kicking off a
 * build — if "Project not found: proj_placeholder" shows up in a deploy
 * run, the env var is missing at the CLI level, not here.
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
