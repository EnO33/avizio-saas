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
	linkEstablishmentGoogleLocation,
	listEstablishmentsForOrg,
	type Tone,
	unlinkEstablishmentGoogleLocation,
	updateEstablishment,
} from "#/server/db/queries/establishments";
import {
	getAccessTokenForOrg,
	listAccounts,
	listLocations,
} from "#/server/integrations/google-business";

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

const TONE_VALUES = [
	"warm",
	"professional",
	"direct",
] as const satisfies readonly Tone[];

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
const toneSchema = z.enum(TONE_VALUES);
// 5 000 chars is enough for a few paragraphs of brand voice + do-not-mention
// guardrails without running into prompt-length issues when we inject it.
const brandContextSchema = z
	.string()
	.trim()
	.max(5000, "Contexte trop long (5 000 caractères max)")
	.nullable()
	.transform((v) => (v && v.length > 0 ? v : null));

const createInputSchema = z.object({
	name: nameSchema,
	city: citySchema,
	postalCode: postalCodeSchema,
	businessType: businessTypeSchema,
	languageCode: languageCodeSchema,
	defaultTone: toneSchema.optional(),
	brandContext: brandContextSchema.optional(),
});

const updateInputSchema = z.object({
	id: z.string().min(1),
	name: nameSchema.optional(),
	city: citySchema.optional(),
	postalCode: postalCodeSchema.optional(),
	businessType: businessTypeSchema.optional(),
	languageCode: languageCodeSchema.optional(),
	defaultTone: toneSchema.optional(),
	brandContext: brandContextSchema.optional(),
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

// ── Google Business Profile location picker ────────────────────────────────

export type GbpLocationChoice = {
	readonly locationName: string;
	readonly locationTitle: string;
	readonly accountName: string;
	readonly accountLabel: string | null;
	readonly address: string | null;
};

export type ListGbpLocationsResult =
	| { readonly kind: "ok"; readonly locations: readonly GbpLocationChoice[] }
	| { readonly kind: "unauthenticated" }
	| { readonly kind: "no_connection" }
	| { readonly kind: "insufficient_scope" }
	/**
	 * Google returned 429 on a Business Profile API call. On this provider
	 * it usually means "your project hasn't been approved yet, daily quota
	 * is 0" — distinct from a genuine transient rate limit (which is rare at
	 * our volumes). The UI surfaces both possibilities.
	 */
	| { readonly kind: "rate_limited_or_quota" }
	| { readonly kind: "connection_revoked" }
	| { readonly kind: "error" };

function formatAddress(
	address: {
		postalCode: string | null;
		locality: string | null;
		addressLines: readonly string[];
	} | null,
): string | null {
	if (!address) return null;
	const street = address.addressLines[0] ?? null;
	const cityPart = [address.postalCode, address.locality]
		.filter((s): s is string => Boolean(s))
		.join(" ");
	return [street, cityPart].filter((s) => s && s.length > 0).join(", ") || null;
}

/**
 * Fetch every Google Business Profile location the current Clerk org has
 * access to, flattened across all their accounts. Used by the picker on
 * the establishment edit page. Errors are mapped to UI-displayable kinds
 * so the component can render a clear empty-state message instead of a
 * generic "something went wrong".
 */
export const listGbpLocationsForPicker = createServerFn().handler(
	async (): Promise<ListGbpLocationsResult> => {
		const session = await auth();
		if (!session.isAuthenticated || !session.orgId) {
			return { kind: "unauthenticated" };
		}

		const tokenResult = await getAccessTokenForOrg({
			organizationId: session.orgId,
			platform: "google",
		});
		if (tokenResult.isErr()) {
			const e = tokenResult.error;
			if (e.kind === "no_active_connection") return { kind: "no_connection" };
			if (e.kind === "missing_refresh_token") return { kind: "no_connection" };
			if (e.kind === "connection_revoked")
				return { kind: "connection_revoked" };
			logger.error(
				{
					event: "gbp_picker_token_failed",
					kind: e.kind,
					orgId: session.orgId,
				},
				"Failed to obtain access token for GBP picker",
			);
			return { kind: "error" };
		}

		const accessToken = tokenResult.value.accessToken;
		const accountsResult = await listAccounts(accessToken);
		if (accountsResult.isErr()) {
			const e = accountsResult.error;
			if (e.kind === "gbp_insufficient_scope") {
				return { kind: "insufficient_scope" };
			}
			if (e.kind === "integration_rate_limited") {
				return { kind: "rate_limited_or_quota" };
			}
			logger.error(
				{
					event: "gbp_picker_list_accounts_failed",
					kind: e.kind,
					orgId: session.orgId,
				},
				"listAccounts failed in picker",
			);
			return { kind: "error" };
		}

		const locations: GbpLocationChoice[] = [];
		for (const account of accountsResult.value) {
			const locResult = await listLocations({
				accessToken,
				accountName: account.name,
			});
			if (locResult.isErr()) {
				const e = locResult.error;
				if (e.kind === "gbp_insufficient_scope") {
					return { kind: "insufficient_scope" };
				}
				if (e.kind === "integration_rate_limited") {
					return { kind: "rate_limited_or_quota" };
				}
				// Partial failure on one account shouldn't blank the whole picker —
				// log and keep going with what we have.
				logger.warn(
					{
						event: "gbp_picker_list_locations_failed",
						accountName: account.name,
						kind: e.kind,
					},
					"listLocations failed for one account, skipping",
				);
				continue;
			}
			for (const loc of locResult.value) {
				locations.push({
					locationName: `${account.name}/${loc.name}`,
					locationTitle: loc.title,
					accountName: account.name,
					accountLabel: account.accountName,
					address: formatAddress(loc.address),
				});
			}
		}

		return { kind: "ok", locations };
	},
);

// ── Link / unlink ──────────────────────────────────────────────────────────

const linkLocationSchema = z.object({
	id: z.string().min(1),
	locationName: z.string().min(1),
	locationTitle: z.string().min(1),
});

export type LinkGbpLocationResult =
	| { readonly kind: "ok"; readonly establishment: EstablishmentSummary }
	| { readonly kind: "unauthenticated" }
	| { readonly kind: "not_found" }
	| { readonly kind: "error" };

export const linkGbpLocationFn = createServerFn({ method: "POST" })
	.inputValidator(linkLocationSchema)
	.handler(async ({ data }): Promise<LinkGbpLocationResult> => {
		const session = await auth();
		if (!session.isAuthenticated || !session.orgId) {
			return { kind: "unauthenticated" };
		}

		const result = await linkEstablishmentGoogleLocation({
			id: data.id,
			organizationId: session.orgId,
			googleLocationName: data.locationName,
			googleLocationTitle: data.locationTitle,
		});
		if (result.isErr()) {
			if (result.error.kind === "db_not_found") return { kind: "not_found" };
			logger.error(
				{
					event: "establishment_link_gbp_failed",
					kind: result.error.kind,
					id: data.id,
				},
				"Failed to link establishment to GBP location",
			);
			return { kind: "error" };
		}

		logger.info(
			{
				event: "establishment_linked_gbp",
				establishmentId: data.id,
				locationName: data.locationName,
			},
			"Establishment linked to GBP location",
		);
		return { kind: "ok", establishment: result.value };
	});

export const unlinkGbpLocationFn = createServerFn({ method: "POST" })
	.inputValidator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data }): Promise<LinkGbpLocationResult> => {
		const session = await auth();
		if (!session.isAuthenticated || !session.orgId) {
			return { kind: "unauthenticated" };
		}

		const result = await unlinkEstablishmentGoogleLocation({
			id: data.id,
			organizationId: session.orgId,
		});
		if (result.isErr()) {
			if (result.error.kind === "db_not_found") return { kind: "not_found" };
			logger.error(
				{
					event: "establishment_unlink_gbp_failed",
					kind: result.error.kind,
					id: data.id,
				},
				"Failed to unlink establishment from GBP location",
			);
			return { kind: "error" };
		}

		return { kind: "ok", establishment: result.value };
	});
