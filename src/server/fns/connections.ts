import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { decryptToken } from "#/lib/crypto";
import { logger } from "#/lib/logger";
import {
	type ConnectionSummary,
	getConnectionForRevoke,
	listConnectionsForOrg,
	markConnectionRevoked,
} from "#/server/db/queries/connections";
import { revokeGoogleToken } from "#/server/integrations/google-business-oauth";

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

export type DisconnectResult =
	| { readonly kind: "ok" }
	| { readonly kind: "unauthenticated" }
	| { readonly kind: "not_found" }
	| { readonly kind: "error" };

/**
 * Revoke the upstream token (best-effort) and soft-delete the connection
 * row. Best-effort on Google's side means a revoke HTTP failure is logged
 * but does NOT prevent the DB soft-delete — from the user's POV they asked
 * to disconnect, so we disconnect locally no matter what. Worst case they
 * have a dead token sitting on Google's side that would expire on its own.
 */
export const disconnectConnection = createServerFn({ method: "POST" })
	.inputValidator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data }): Promise<DisconnectResult> => {
		const session = await auth();
		if (!session.isAuthenticated || !session.orgId) {
			return { kind: "unauthenticated" };
		}

		const connectionResult = await getConnectionForRevoke({
			id: data.id,
			organizationId: session.orgId,
		});
		if (connectionResult.isErr()) {
			if (connectionResult.error.kind === "db_not_found") {
				return { kind: "not_found" };
			}
			logger.error(
				{
					event: "disconnect_fetch_failed",
					kind: connectionResult.error.kind,
					connectionId: data.id,
				},
				"Failed to load connection for revoke",
			);
			return { kind: "error" };
		}
		const conn = connectionResult.value;

		// Best-effort revoke upstream. Both tokens are passed through Google's
		// revoke endpoint — revoking the access_token alone doesn't invalidate
		// the refresh_token, which would otherwise remain usable.
		const accessPlain = decryptToken(conn.encryptedAccessToken);
		if (accessPlain.isOk()) {
			const revoke = await revokeGoogleToken(accessPlain.value);
			if (revoke.isErr()) {
				logger.warn(
					{
						event: "disconnect_revoke_access_failed",
						kind: revoke.error.kind,
						connectionId: data.id,
					},
					"Google access token revoke failed — continuing to soft-delete",
				);
			}
		} else {
			logger.error(
				{ event: "disconnect_decrypt_access_failed", connectionId: data.id },
				"Failed to decrypt access token — skipping revoke",
			);
		}

		if (conn.encryptedRefreshToken) {
			const refreshPlain = decryptToken(conn.encryptedRefreshToken);
			if (refreshPlain.isOk()) {
				const revoke = await revokeGoogleToken(refreshPlain.value);
				if (revoke.isErr()) {
					logger.warn(
						{
							event: "disconnect_revoke_refresh_failed",
							kind: revoke.error.kind,
							connectionId: data.id,
						},
						"Google refresh token revoke failed — continuing to soft-delete",
					);
				}
			} else {
				logger.error(
					{
						event: "disconnect_decrypt_refresh_failed",
						connectionId: data.id,
					},
					"Failed to decrypt refresh token — skipping revoke",
				);
			}
		}

		const markResult = await markConnectionRevoked({
			id: data.id,
			organizationId: session.orgId,
		});
		if (markResult.isErr()) {
			if (markResult.error.kind === "db_not_found") {
				return { kind: "not_found" };
			}
			logger.error(
				{
					event: "disconnect_mark_revoked_failed",
					kind: markResult.error.kind,
					connectionId: data.id,
				},
				"Failed to soft-delete connection",
			);
			return { kind: "error" };
		}

		logger.info(
			{
				event: "connection_disconnected",
				connectionId: data.id,
				orgId: session.orgId,
			},
			"Connection revoked and soft-deleted",
		);
		return { kind: "ok" };
	});
