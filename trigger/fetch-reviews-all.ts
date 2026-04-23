import { logger, schedules } from "@trigger.dev/sdk/v3";
import { listAllActiveGoogleConnections } from "#/server/db/queries/connections";
import { listEstablishmentsWithGoogleLink } from "#/server/db/queries/establishments";
import { getAccessTokenForOrg } from "#/server/integrations/google-business";
import { fetchAndUpsertReviewsForEstablishment } from "#/server/services/gbp-review-sync";

/**
 * Cron that walks every active Google connection, fetches its linked
 * establishments and upserts the reviews for each. Runs every 6 hours —
 * matches the cadence we promised users in the landing copy and keeps us
 * well below Google's daily quota even with hundreds of establishments.
 *
 * Per-org / per-establishment errors are logged + swallowed so one broken
 * tenant doesn't block the run for everyone else. Page-level token / quota
 * errors are logged with enough context to correlate with the Google
 * approval state.
 */
export const fetchReviewsAllTask = schedules.task({
	id: "fetch-reviews-all",
	cron: "0 */6 * * *",
	maxDuration: 900, // 15 min upper bound for the whole fan-out
	run: async (payload) => {
		logger.info("fetch-reviews-all starting", {
			scheduledFor: payload.timestamp,
		});

		const connectionsResult = await listAllActiveGoogleConnections();
		if (connectionsResult.isErr()) {
			logger.error("Failed to list Google connections — aborting run", {
				kind: connectionsResult.error.kind,
			});
			return { ok: false, reason: "list_connections_failed" };
		}
		const connections = connectionsResult.value;
		logger.info(`Found ${connections.length} active Google connections`);

		let orgsVisited = 0;
		let establishmentsSynced = 0;
		let totalInserted = 0;
		let totalUpdated = 0;
		let totalSkipped = 0;

		for (const conn of connections) {
			orgsVisited++;
			const tokenResult = await getAccessTokenForOrg({
				organizationId: conn.organizationId,
				platform: "google",
			});
			if (tokenResult.isErr()) {
				logger.warn(
					`Skipping org ${conn.organizationId}: can't obtain access token`,
					{ kind: tokenResult.error.kind },
				);
				continue;
			}

			const establishmentsResult = await listEstablishmentsWithGoogleLink(
				conn.organizationId,
			);
			if (establishmentsResult.isErr()) {
				logger.warn(
					`Skipping org ${conn.organizationId}: can't list establishments`,
					{ kind: establishmentsResult.error.kind },
				);
				continue;
			}
			const linkedEstablishments = establishmentsResult.value;
			if (linkedEstablishments.length === 0) continue;

			for (const est of linkedEstablishments) {
				const syncResult = await fetchAndUpsertReviewsForEstablishment({
					accessToken: tokenResult.value.accessToken,
					establishmentId: est.id,
					googleLocationName: est.googleLocationName,
					establishmentLanguageCode: est.languageCode,
				});
				if (syncResult.isErr()) {
					logger.warn(
						`Sync failed for establishment ${est.id} — moving on`,
						{ kind: syncResult.error.kind },
					);
					continue;
				}
				establishmentsSynced++;
				totalInserted += syncResult.value.inserted;
				totalUpdated += syncResult.value.updated;
				totalSkipped += syncResult.value.skipped;
				logger.info(`Synced ${est.id}`, {
					inserted: syncResult.value.inserted,
					updated: syncResult.value.updated,
					skipped: syncResult.value.skipped,
					pages: syncResult.value.pages,
				});
			}
		}

		logger.info("fetch-reviews-all completed", {
			orgsVisited,
			establishmentsSynced,
			totalInserted,
			totalUpdated,
			totalSkipped,
		});

		return {
			ok: true,
			orgsVisited,
			establishmentsSynced,
			totalInserted,
			totalUpdated,
			totalSkipped,
		};
	},
});
