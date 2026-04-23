import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { logger } from "#/lib/logger";
import {
	type ConnectionSummary,
	listConnectionsForOrg,
} from "#/server/db/queries/connections";

/**
 * Returns the active platform connections for the caller's current
 * organization. Empty array when the session has no active org or the DB
 * read fails — the dashboard already surfaces a bootstrap flow for the
 * former and a connection banner for any callback-level failure, so we
 * prefer an empty list over a route-level error here.
 */
export const listConnections = createServerFn().handler(
	async (): Promise<ConnectionSummary[]> => {
		const session = await auth();
		if (!session.isAuthenticated || !session.orgId) return [];

		const result = await listConnectionsForOrg(session.orgId);
		if (result.isErr()) {
			logger.error(
				{
					event: "connections_list_failed",
					kind: result.error.kind,
					orgId: session.orgId,
				},
				"Failed to list connections",
			);
			return [];
		}
		return result.value;
	},
);
