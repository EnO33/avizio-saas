import { and, desc, eq, isNull } from "drizzle-orm";
import type { DbError } from "#/lib/errors";
import { unknownToMessage } from "#/lib/errors";
import { fromPromise, type Result } from "#/lib/result";
import { db } from "../client";
import { connections } from "../schema";

/**
 * Client-safe projection of a `connections` row. Crucially does NOT carry the
 * encrypted access/refresh tokens — tokens stay server-side, only the
 * metadata needed to render the dashboard is shipped over the wire.
 */
export type ConnectionSummary = {
	readonly id: string;
	readonly platform: "google" | "tripadvisor" | "trustpilot" | "thefork";
	readonly platformAccountLabel: string | null;
	readonly scopes: readonly string[] | null;
	readonly createdAt: Date;
	readonly accessTokenExpiresAt: Date | null;
	readonly lastSyncedAt: Date | null;
	readonly lastSyncError: string | null;
};

export type UpsertGoogleConnectionInput = {
	readonly organizationId: string;
	readonly platformAccountId: string;
	readonly platformAccountLabel: string | null;
	readonly encryptedAccessToken: string;
	readonly encryptedRefreshToken: string | null;
	readonly accessTokenExpiresAt: Date;
	readonly scopes: readonly string[];
};

function toDbError(e: unknown): DbError {
	return { kind: "db_unknown", message: unknownToMessage(e) };
}

/**
 * List the org's active platform connections in reverse chronological order
 * of creation. Revoked rows are filtered out — a revoked connection is
 * effectively gone from the user's point of view, they have to reconnect.
 */
export async function listConnectionsForOrg(
	organizationId: string,
): Promise<Result<ConnectionSummary[], DbError>> {
	return fromPromise(
		db
			.select({
				id: connections.id,
				platform: connections.platform,
				platformAccountLabel: connections.platformAccountLabel,
				scopes: connections.scopes,
				createdAt: connections.createdAt,
				accessTokenExpiresAt: connections.accessTokenExpiresAt,
				lastSyncedAt: connections.lastSyncedAt,
				lastSyncError: connections.lastSyncError,
			})
			.from(connections)
			.where(
				and(
					eq(connections.organizationId, organizationId),
					isNull(connections.revokedAt),
				),
			)
			.orderBy(desc(connections.createdAt)),
		toDbError,
	);
}

/**
 * Upsert a Google platform connection scoped to an organization. Conflict key
 * is (organization_id, platform, platform_account_id) — which ensures a
 * re-consent on the same Google account refreshes tokens in place instead of
 * creating a duplicate row.
 *
 * Note on refresh_token: Google sometimes omits it on re-consent even with
 * `prompt=consent`. When null we keep whatever was stored previously so we
 * don't lose offline access accidentally.
 */
export async function upsertGoogleConnection(
	input: UpsertGoogleConnectionInput,
): Promise<Result<void, DbError>> {
	const scopesArray: string[] = [...input.scopes];
	const baseSet = {
		platformAccountLabel: input.platformAccountLabel,
		encryptedAccessToken: input.encryptedAccessToken,
		accessTokenExpiresAt: input.accessTokenExpiresAt,
		scopes: scopesArray,
		revokedAt: null,
		updatedAt: new Date(),
	};
	const set = input.encryptedRefreshToken
		? { ...baseSet, encryptedRefreshToken: input.encryptedRefreshToken }
		: baseSet;

	return fromPromise(
		db
			.insert(connections)
			.values({
				organizationId: input.organizationId,
				platform: "google",
				platformAccountId: input.platformAccountId,
				platformAccountLabel: input.platformAccountLabel,
				encryptedAccessToken: input.encryptedAccessToken,
				encryptedRefreshToken: input.encryptedRefreshToken,
				accessTokenExpiresAt: input.accessTokenExpiresAt,
				scopes: scopesArray,
			})
			.onConflictDoUpdate({
				target: [
					connections.organizationId,
					connections.platform,
					connections.platformAccountId,
				],
				set,
			}),
		toDbError,
	).map(() => undefined);
}
