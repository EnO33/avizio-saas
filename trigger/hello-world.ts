import { logger, schedules } from "@trigger.dev/sdk/v3";

/**
 * Minimal scheduled task that proves the Trigger.dev wiring works end-to-end:
 * deploy, cron dispatch, execution, structured logs, run visibility in the
 * Trigger.dev dashboard. It doesn't touch the DB or any external API on
 * purpose — the real review-fetching job will replace it in
 * `feat/trigger-fetch-reviews` once Google Business Profile access is
 * approved.
 *
 * Cron: every 6 hours (matches the planned cadence for the actual
 * review fetcher).
 */
export const helloWorldTask = schedules.task({
	id: "hello-world",
	cron: "0 */6 * * *",
	run: async (payload) => {
		logger.info("Hello from the Avizio scheduled task", {
			scheduledFor: payload.timestamp,
			lastTimestamp: payload.lastTimestamp,
			timezone: payload.timezone,
		});
		return { ok: true, scheduledFor: payload.timestamp };
	},
});
