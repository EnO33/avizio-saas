import { and, desc, eq, isNull } from "drizzle-orm";
import type { DbError } from "#/lib/errors";
import { unknownToMessage } from "#/lib/errors";
import { err, fromPromise, ok, type Result } from "#/lib/result";
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
 * Encrypted tokens needed to revoke a connection upstream. Kept separate
 * from `ConnectionSummary` because this projection intentionally includes
 * ciphertexts — it's for server-side consumption only and must never be
 * returned from a server fn to the client.
 */
export type ConnectionTokens = {
	readonly id: string;
	readonly encryptedAccessToken: string;
	readonly encryptedRefreshToken: string | null;
};

/**
 * Server-only full view of an active connection with everything the token
 * accessor (refresh-if-expired) needs. Includes scopes so callers can detect
 * "business.manage not granted yet" before attempting a call that'll 403.
 */
export type ActiveConnection = {
	readonly id: string;
	readonly organizationId: string;
	readonly platform: "google" | "tripadvisor" | "trustpilot" | "thefork";
	readonly platformAccountId: string;
	readonly platformAccountLabel: string | null;
	readonly encryptedAccessToken: string;
	readonly encryptedRefreshToken: string | null;
	readonly accessTokenExpiresAt: Date | null;
	readonly scopes: readonly string[] | null;
};

/**
 * Fetch the encrypted tokens for a connection, scoped to its organization.
 * Returns `db_not_found` if the id doesn't exist, doesn't belong to the org,
 * or the connection is already revoked.
 */
export async function getConnectionForRevoke(params: {
	id: string;
	organizationId: string;
}): Promise<Result<ConnectionTokens, DbError>> {
	const rows = await fromPromise(
		db
			.select({
				id: connections.id,
				encryptedAccessToken: connections.encryptedAccessToken,
				encryptedRefreshToken: connections.encryptedRefreshToken,
			})
			.from(connections)
			.where(
				and(
					eq(connections.id, params.id),
					eq(connections.organizationId, params.organizationId),
					isNull(connections.revokedAt),
				),
			)
			.limit(1),
		toDbError,
	);
	if (rows.isErr()) return err(rows.error);
	const first = rows.value[0];
	if (!first) return err({ kind: "db_not_found" });
	return ok(first);
}

/**
 * Fetch the active connection (access+refresh tokens, scopes, expiry) for an
 * (organization, platform) pair. Used by the token accessor before any GBP
 * API call. Returns `db_not_found` if no active connection exists — the
 * caller typically falls back to "user must connect" UX.
 */
export async function getActiveConnection(params: {
	organizationId: string;
	platform: "google" | "tripadvisor" | "trustpilot" | "thefork";
}): Promise<Result<ActiveConnection, DbError>> {
	const rows = await fromPromise(
		db
			.select({
				id: connections.id,
				organizationId: connections.organizationId,
				platform: connections.platform,
				platformAccountId: connections.platformAccountId,
				platformAccountLabel: connections.platformAccountLabel,
				encryptedAccessToken: connections.encryptedAccessToken,
				encryptedRefreshToken: connections.encryptedRefreshToken,
				accessTokenExpiresAt: connections.accessTokenExpiresAt,
				scopes: connections.scopes,
			})
			.from(connections)
			.where(
				and(
					eq(connections.organizationId, params.organizationId),
					eq(connections.platform, params.platform),
					isNull(connections.revokedAt),
				),
			)
			.limit(1),
		toDbError,
	);
	if (rows.isErr()) return err(rows.error);
	const first = rows.value[0];
	if (!first) return err({ kind: "db_not_found" });
	return ok(first);
}

/**
 * Persist a refreshed token set. Called right after a successful
 * `refreshAccessToken` call. If Google rotated the refresh_token too we
 * update it; otherwise we leave the stored one intact (Google sometimes
 * omits the rotation, and overwriting with null would break offline access).
 */
export async function updateConnectionTokens(params: {
	id: string;
	encryptedAccessToken: string;
	encryptedRefreshToken?: string | null;
	accessTokenExpiresAt: Date;
	scopes?: readonly string[];
}): Promise<Result<void, DbError>> {
	const now = new Date();
	const baseSet = {
		encryptedAccessToken: params.encryptedAccessToken,
		accessTokenExpiresAt: params.accessTokenExpiresAt,
		updatedAt: now,
	};
	const withRefresh =
		params.encryptedRefreshToken != null
			? { ...baseSet, encryptedRefreshToken: params.encryptedRefreshToken }
			: baseSet;
	const set = params.scopes
		? { ...withRefresh, scopes: [...params.scopes] }
		: withRefresh;

	const rows = await fromPromise(
		db
			.update(connections)
			.set(set)
			.where(and(eq(connections.id, params.id), isNull(connections.revokedAt)))
			.returning({ id: connections.id }),
		toDbError,
	);
	if (rows.isErr()) return err(rows.error);
	if (rows.value.length === 0) return err({ kind: "db_not_found" });
	return ok(undefined);
}

/**
 * Soft-delete a connection by stamping `revoked_at`. Scoped by organization
 * so one org can't clobber another's connection. Returns `db_not_found` when
 * the id is unknown or already revoked — callers usually treat that as a
 * user error worth surfacing.
 */
export async function markConnectionRevoked(params: {
	id: string;
	organizationId: string;
}): Promise<Result<void, DbError>> {
	const now = new Date();
	const rows = await fromPromise(
		db
			.update(connections)
			.set({ revokedAt: now, updatedAt: now })
			.where(
				and(
					eq(connections.id, params.id),
					eq(connections.organizationId, params.organizationId),
					isNull(connections.revokedAt),
				),
			)
			.returning({ id: connections.id }),
		toDbError,
	);
	if (rows.isErr()) return err(rows.error);
	if (rows.value.length === 0) return err({ kind: "db_not_found" });
	return ok(undefined);
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
