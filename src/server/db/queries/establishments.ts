import { and, asc, eq } from "drizzle-orm";
import type { DbError } from "#/lib/errors";
import { unknownToMessage } from "#/lib/errors";
import { err, fromPromise, ok, type Result } from "#/lib/result";
import { db } from "../client";
import { establishments } from "../schema";

export type BusinessType =
	| "restaurant"
	| "hotel"
	| "cafe"
	| "bar"
	| "bakery"
	| "artisan"
	| "retail"
	| "other";

/**
 * Client-safe projection of an establishment. The advanced fields
 * (`brandContext`, `defaultTone`, notification settings) aren't exposed yet
 * because the MVP settings panel doesn't edit them — they'll join this
 * shape when the Sprint 3 per-establishment settings land.
 */
export type EstablishmentSummary = {
	readonly id: string;
	readonly name: string;
	readonly city: string;
	readonly postalCode: string | null;
	readonly businessType: BusinessType;
	readonly languageCode: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
};

export type CreateEstablishmentInput = {
	readonly organizationId: string;
	readonly name: string;
	readonly city: string;
	readonly postalCode: string | null;
	readonly businessType: BusinessType;
	readonly languageCode: string;
};

export type UpdateEstablishmentPatch = {
	readonly name?: string | undefined;
	readonly city?: string | undefined;
	readonly postalCode?: string | null | undefined;
	readonly businessType?: BusinessType | undefined;
	readonly languageCode?: string | undefined;
};

const SUMMARY_COLUMNS = {
	id: establishments.id,
	name: establishments.name,
	city: establishments.city,
	postalCode: establishments.postalCode,
	businessType: establishments.businessType,
	languageCode: establishments.languageCode,
	createdAt: establishments.createdAt,
	updatedAt: establishments.updatedAt,
} as const;

function toDbError(e: unknown): DbError {
	return { kind: "db_unknown", message: unknownToMessage(e) };
}

/**
 * Create a new establishment for the given organization. Returns the full
 * summary of the inserted row so callers don't need a follow-up read.
 */
export async function createEstablishment(
	input: CreateEstablishmentInput,
): Promise<Result<EstablishmentSummary, DbError>> {
	const rows = await fromPromise(
		db
			.insert(establishments)
			.values({
				organizationId: input.organizationId,
				name: input.name,
				city: input.city,
				postalCode: input.postalCode,
				businessType: input.businessType,
				languageCode: input.languageCode,
			})
			.returning(SUMMARY_COLUMNS),
		toDbError,
	);
	if (rows.isErr()) return err(rows.error);
	const first = rows.value[0];
	if (!first)
		return err({ kind: "db_unknown", message: "insert returned no row" });
	return ok(first);
}

/**
 * List the org's establishments alphabetically by name — tends to be the
 * most predictable ordering when the list grows past a few rows.
 */
export async function listEstablishmentsForOrg(
	organizationId: string,
): Promise<Result<EstablishmentSummary[], DbError>> {
	return fromPromise(
		db
			.select(SUMMARY_COLUMNS)
			.from(establishments)
			.where(eq(establishments.organizationId, organizationId))
			.orderBy(asc(establishments.name)),
		toDbError,
	);
}

/**
 * Fetch a single establishment scoped to its org. Returns `db_not_found`
 * when the id doesn't exist or belongs to another org — both are
 * indistinguishable from the caller's side, which is exactly what we want
 * (no enumeration leak).
 */
export async function getEstablishmentForOrg(params: {
	id: string;
	organizationId: string;
}): Promise<Result<EstablishmentSummary, DbError>> {
	const rows = await fromPromise(
		db
			.select(SUMMARY_COLUMNS)
			.from(establishments)
			.where(
				and(
					eq(establishments.id, params.id),
					eq(establishments.organizationId, params.organizationId),
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
 * Update the mutable fields of an establishment. Scoped by org so one
 * org can't touch another's rows. Returns `db_not_found` if the id is
 * unknown (or cross-org).
 */
export async function updateEstablishment(params: {
	id: string;
	organizationId: string;
	patch: UpdateEstablishmentPatch;
}): Promise<Result<EstablishmentSummary, DbError>> {
	const rows = await fromPromise(
		db
			.update(establishments)
			.set({ ...params.patch, updatedAt: new Date() })
			.where(
				and(
					eq(establishments.id, params.id),
					eq(establishments.organizationId, params.organizationId),
				),
			)
			.returning(SUMMARY_COLUMNS),
		toDbError,
	);
	if (rows.isErr()) return err(rows.error);
	const first = rows.value[0];
	if (!first) return err({ kind: "db_not_found" });
	return ok(first);
}

/**
 * Hard-delete an establishment. FK cascades take care of `reviews` and
 * `responses` automatically — that's intended for the MVP (user asked to
 * remove the place, all associated data goes), though we'll likely switch
 * to soft-delete once the review history gains real audit value.
 */
export async function deleteEstablishment(params: {
	id: string;
	organizationId: string;
}): Promise<Result<void, DbError>> {
	const rows = await fromPromise(
		db
			.delete(establishments)
			.where(
				and(
					eq(establishments.id, params.id),
					eq(establishments.organizationId, params.organizationId),
				),
			)
			.returning({ id: establishments.id }),
		toDbError,
	);
	if (rows.isErr()) return err(rows.error);
	if (rows.value.length === 0) return err({ kind: "db_not_found" });
	return ok(undefined);
}
