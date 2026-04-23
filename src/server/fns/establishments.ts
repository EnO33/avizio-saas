import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logger } from "#/lib/logger";
import {
	type BusinessType,
	createEstablishment,
	deleteEstablishment,
	type EstablishmentSummary,
	getEstablishmentForOrg,
	listEstablishmentsForOrg,
	updateEstablishment,
} from "#/server/db/queries/establishments";

const BUSINESS_TYPE_VALUES = [
	"restaurant",
	"hotel",
	"cafe",
	"bar",
	"bakery",
	"artisan",
	"retail",
	"other",
] as const satisfies readonly BusinessType[];

const nameSchema = z.string().trim().min(1).max(100);
const citySchema = z.string().trim().min(1).max(100);
const postalCodeSchema = z
	.string()
	.trim()
	.max(20)
	.nullable()
	.transform((v) => (v && v.length > 0 ? v : null));
const businessTypeSchema = z.enum(BUSINESS_TYPE_VALUES);
const languageCodeSchema = z
	.string()
	.regex(/^[a-z]{2}$/, "Code langue sur 2 lettres (ex. fr)")
	.default("fr");

const createInputSchema = z.object({
	name: nameSchema,
	city: citySchema,
	postalCode: postalCodeSchema,
	businessType: businessTypeSchema,
	languageCode: languageCodeSchema,
});

const updateInputSchema = z.object({
	id: z.string().min(1),
	name: nameSchema.optional(),
	city: citySchema.optional(),
	postalCode: postalCodeSchema.optional(),
	businessType: businessTypeSchema.optional(),
	languageCode: languageCodeSchema.optional(),
});

const idInputSchema = z.object({ id: z.string().min(1) });

export type CreateEstablishmentResult =
	| { readonly kind: "ok"; readonly establishment: EstablishmentSummary }
	| { readonly kind: "unauthenticated" }
	| { readonly kind: "error" };

export type UpdateEstablishmentResult =
	| { readonly kind: "ok"; readonly establishment: EstablishmentSummary }
	| { readonly kind: "unauthenticated" }
	| { readonly kind: "not_found" }
	| { readonly kind: "error" };

export type DeleteEstablishmentResult =
	| { readonly kind: "ok" }
	| { readonly kind: "unauthenticated" }
	| { readonly kind: "not_found" }
	| { readonly kind: "error" };

// ── Reads ──────────────────────────────────────────────────────────────────

/**
 * List the org's establishments. Returns an empty array if the session has
 * no active org — the UI flow already blocks establishment management
 * behind an org being picked, so this is defensive.
 */
export const listEstablishments = createServerFn().handler(
	async (): Promise<EstablishmentSummary[]> => {
		const session = await auth();
		if (!session.isAuthenticated || !session.orgId) return [];

		const result = await listEstablishmentsForOrg(session.orgId);
		if (result.isErr()) {
			logger.error(
				{
					event: "establishments_list_failed",
					kind: result.error.kind,
					orgId: session.orgId,
				},
				"Failed to list establishments",
			);
			return [];
		}
		return result.value;
	},
);

/**
 * Fetch a single establishment by id. Returns null when the id is unknown
 * or belongs to another org — the caller surfaces a 404 UI in that case.
 */
export const getEstablishment = createServerFn()
	.inputValidator(idInputSchema)
	.handler(async ({ data }): Promise<EstablishmentSummary | null> => {
		const session = await auth();
		if (!session.isAuthenticated || !session.orgId) return null;

		const result = await getEstablishmentForOrg({
			id: data.id,
			organizationId: session.orgId,
		});
		if (result.isErr()) {
			if (result.error.kind !== "db_not_found") {
				logger.error(
					{
						event: "establishment_get_failed",
						kind: result.error.kind,
						id: data.id,
					},
					"Failed to load establishment",
				);
			}
			return null;
		}
		return result.value;
	});

// ── Mutations ──────────────────────────────────────────────────────────────

export const createEstablishmentFn = createServerFn({ method: "POST" })
	.inputValidator(createInputSchema)
	.handler(async ({ data }): Promise<CreateEstablishmentResult> => {
		const session = await auth();
		if (!session.isAuthenticated || !session.orgId) {
			return { kind: "unauthenticated" };
		}

		const result = await createEstablishment({
			organizationId: session.orgId,
			...data,
		});
		if (result.isErr()) {
			logger.error(
				{
					event: "establishment_create_failed",
					kind: result.error.kind,
					orgId: session.orgId,
				},
				"Failed to create establishment",
			);
			return { kind: "error" };
		}

		logger.info(
			{
				event: "establishment_created",
				establishmentId: result.value.id,
				orgId: session.orgId,
			},
			"Establishment created",
		);
		return { kind: "ok", establishment: result.value };
	});

export const updateEstablishmentFn = createServerFn({ method: "POST" })
	.inputValidator(updateInputSchema)
	.handler(async ({ data }): Promise<UpdateEstablishmentResult> => {
		const session = await auth();
		if (!session.isAuthenticated || !session.orgId) {
			return { kind: "unauthenticated" };
		}

		const { id, ...patch } = data;
		const result = await updateEstablishment({
			id,
			organizationId: session.orgId,
			patch,
		});
		if (result.isErr()) {
			if (result.error.kind === "db_not_found") return { kind: "not_found" };
			logger.error(
				{
					event: "establishment_update_failed",
					kind: result.error.kind,
					id,
				},
				"Failed to update establishment",
			);
			return { kind: "error" };
		}

		return { kind: "ok", establishment: result.value };
	});

export const deleteEstablishmentFn = createServerFn({ method: "POST" })
	.inputValidator(idInputSchema)
	.handler(async ({ data }): Promise<DeleteEstablishmentResult> => {
		const session = await auth();
		if (!session.isAuthenticated || !session.orgId) {
			return { kind: "unauthenticated" };
		}

		const result = await deleteEstablishment({
			id: data.id,
			organizationId: session.orgId,
		});
		if (result.isErr()) {
			if (result.error.kind === "db_not_found") return { kind: "not_found" };
			logger.error(
				{
					event: "establishment_delete_failed",
					kind: result.error.kind,
					id: data.id,
				},
				"Failed to delete establishment",
			);
			return { kind: "error" };
		}

		logger.info(
			{
				event: "establishment_deleted",
				establishmentId: data.id,
				orgId: session.orgId,
			},
			"Establishment deleted",
		);
		return { kind: "ok" };
	});
