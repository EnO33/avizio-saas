import { z } from "zod";
import { type CryptoError, decryptToken, encryptToken } from "#/lib/crypto";
import type {
	DbError,
	GbpError,
	IntegrationError,
	OAuthError,
	ValidationIssue,
} from "#/lib/errors";
import { unknownToMessage } from "#/lib/errors";
import { logger } from "#/lib/logger";
import { err, fromPromise, fromThrowable, ok, type Result } from "#/lib/result";
import {
	type ActiveConnection,
	getActiveConnection,
	markConnectionRevoked,
	updateConnectionTokens,
} from "#/server/db/queries/connections";
import {
	isRefreshTokenRevoked,
	refreshAccessToken,
} from "./google-business-oauth";

const PROVIDER = "google";
const ACCOUNT_MANAGEMENT_BASE =
	"https://mybusinessaccountmanagement.googleapis.com/v1";
const BUSINESS_INFORMATION_BASE =
	"https://mybusinessbusinessinformation.googleapis.com/v1";
const LEGACY_V4_BASE = "https://mybusiness.googleapis.com/v4";

/**
 * Reviews stay on the legacy v4 endpoint — Google hasn't migrated them to
 * the split APIs yet, and access is gated behind the manual approval
 * process (the `0-9780000040916` case). We keep the URL base separate so
 * the distinction is obvious when we grep for legacy usage.
 */

/**
 * Fields we ask Google to return on `listLocations`. The endpoint requires
 * an explicit `readMask`. We keep it narrow to what the picker UI + the
 * review fetcher actually consume — title for display, storefrontAddress
 * for matching against establishments, storeCode as an optional power-user
 * identifier. Adding a field here is free but widens the wire payload.
 */
const LOCATION_READ_MASK = "name,title,storeCode,storefrontAddress";

/**
 * Narrow view of a Business Profile account. Google returns richer objects
 * (type, role, verificationState, etc.) but for Avizio's flow we only need
 * the resource `name` (e.g. "accounts/123456789") to fetch locations and
 * the display name for the picker UI.
 */
export type GbpAccount = {
	readonly name: string;
	readonly accountName: string | null;
};

const accountSchema = z.object({
	name: z.string().min(1),
	accountName: z.string().optional(),
});

const listAccountsResponseSchema = z.object({
	accounts: z.array(accountSchema).optional(),
	nextPageToken: z.string().optional(),
});

const safeJsonParseText = fromThrowable(
	(raw: string) => JSON.parse(raw) as unknown,
	() => "json_parse_failed" as const,
);

function zodIssuesToValidationIssues(
	error: z.ZodError,
): readonly ValidationIssue[] {
	return error.issues.map((i) => ({
		path: i.path.map(String),
		message: i.message,
	}));
}

function toNetworkError(e: unknown): IntegrationError {
	return {
		kind: "integration_network",
		provider: PROVIDER,
		message: unknownToMessage(e),
	};
}

/**
 * Map a non-2xx Business Profile response into a discriminated error.
 *
 * 403 mapping hierarchy:
 *  1. Body mentions the API-not-enabled / accessNotConfigured pattern →
 *     `gbp_legacy_api_access_denied` (reviews gate)
 *  2. Any other 403 → `gbp_insufficient_scope`
 *
 * The blanket "403 = insufficient scope" fallback is pragmatic: the Business
 * Profile APIs almost exclusively use 403 to signal missing `business.manage`,
 * and the specific phrasing varies by endpoint ("Request had insufficient
 * authentication scopes", "PERMISSION_DENIED", "The caller does not have
 * permission", etc.). Keeping a narrow keyword match made the fallback trip
 * into the generic "something went wrong" UI for the most common case.
 */
function toGbpHttpError(
	status: number,
	body: string,
): GbpError | IntegrationError {
	if (status === 401) {
		return { kind: "integration_unauthorized", provider: PROVIDER };
	}
	if (status === 429) {
		return {
			kind: "integration_rate_limited",
			provider: PROVIDER,
			retryAfterMs: 60_000,
		};
	}
	if (status === 403) {
		if (
			body.includes("accessNotConfigured") ||
			body.includes("API_NOT_ENABLED") ||
			body.includes("has not been used")
		) {
			return { kind: "gbp_legacy_api_access_denied" };
		}
		return { kind: "gbp_insufficient_scope", grantedScopes: [] };
	}
	return { kind: "gbp_http_error", status, body };
}

/**
 * GET the authenticated user's Business Profile accounts. Non-paginated for
 * now — the target user persona ("restaurateur avec 1 à 5 établissements")
 * never owns enough accounts to warrant paging, and the account picker UI
 * that'll consume this is already capped at a small list.
 */
export async function listAccounts(
	accessToken: string,
): Promise<Result<GbpAccount[], GbpError | IntegrationError>> {
	const responseResult = await fromPromise(
		fetch(`${ACCOUNT_MANAGEMENT_BASE}/accounts`, {
			headers: { authorization: `Bearer ${accessToken}` },
		}),
		toNetworkError,
	);
	if (responseResult.isErr()) return err(responseResult.error);
	const response = responseResult.value;

	const bodyResult = await fromPromise(response.text(), toNetworkError);
	if (bodyResult.isErr()) return err(bodyResult.error);
	const rawBody = bodyResult.value;

	if (!response.ok) {
		return err(toGbpHttpError(response.status, rawBody));
	}

	const jsonResult = safeJsonParseText(rawBody);
	if (jsonResult.isErr()) {
		return err({
			kind: "gbp_invalid_response",
			issues: [{ path: [], message: "response body is not valid JSON" }],
		});
	}

	const parsed = listAccountsResponseSchema.safeParse(jsonResult.value);
	if (!parsed.success) {
		return err({
			kind: "gbp_invalid_response",
			issues: zodIssuesToValidationIssues(parsed.error),
		});
	}

	const accounts: GbpAccount[] = (parsed.data.accounts ?? []).map((a) => ({
		name: a.name,
		accountName: a.accountName ?? null,
	}));
	return ok(accounts);
}

/**
 * Narrow view of a Business Profile location. Google returns a deeply
 * nested structure (phone numbers, categories, regular/special hours,
 * metadata, etc.); we expose only what the picker UI + review fetcher
 * actually consume.
 */
export type GbpLocation = {
	readonly name: string;
	readonly title: string;
	readonly storeCode: string | null;
	readonly address: GbpPostalAddress | null;
};

export type GbpPostalAddress = {
	readonly regionCode: string;
	readonly postalCode: string | null;
	readonly administrativeArea: string | null;
	readonly locality: string | null;
	readonly addressLines: readonly string[];
};

const postalAddressSchema = z.object({
	regionCode: z.string().min(1),
	languageCode: z.string().optional(),
	postalCode: z.string().optional(),
	administrativeArea: z.string().optional(),
	locality: z.string().optional(),
	addressLines: z.array(z.string()).optional(),
});

const locationSchema = z.object({
	name: z.string().min(1),
	title: z.string().min(1),
	storeCode: z.string().optional(),
	storefrontAddress: postalAddressSchema.optional(),
});

const listLocationsResponseSchema = z.object({
	locations: z.array(locationSchema).optional(),
	nextPageToken: z.string().optional(),
	totalSize: z.number().int().nonnegative().optional(),
});

/**
 * GET the locations belonging to a Business Profile account. `accountName`
 * is the full resource path returned by `listAccounts` (e.g.
 * "accounts/100000000000001") — the function handles the URL construction.
 */
export async function listLocations(params: {
	accessToken: string;
	accountName: string;
}): Promise<Result<GbpLocation[], GbpError | IntegrationError>> {
	const url = new URL(
		`${BUSINESS_INFORMATION_BASE}/${params.accountName}/locations`,
	);
	url.searchParams.set("readMask", LOCATION_READ_MASK);

	const responseResult = await fromPromise(
		fetch(url.toString(), {
			headers: { authorization: `Bearer ${params.accessToken}` },
		}),
		toNetworkError,
	);
	if (responseResult.isErr()) return err(responseResult.error);
	const response = responseResult.value;

	const bodyResult = await fromPromise(response.text(), toNetworkError);
	if (bodyResult.isErr()) return err(bodyResult.error);
	const rawBody = bodyResult.value;

	if (!response.ok) {
		return err(toGbpHttpError(response.status, rawBody));
	}

	const jsonResult = safeJsonParseText(rawBody);
	if (jsonResult.isErr()) {
		return err({
			kind: "gbp_invalid_response",
			issues: [{ path: [], message: "response body is not valid JSON" }],
		});
	}

	const parsed = listLocationsResponseSchema.safeParse(jsonResult.value);
	if (!parsed.success) {
		return err({
			kind: "gbp_invalid_response",
			issues: zodIssuesToValidationIssues(parsed.error),
		});
	}

	const locations: GbpLocation[] = (parsed.data.locations ?? []).map((l) => ({
		name: l.name,
		title: l.title,
		storeCode: l.storeCode ?? null,
		address: l.storefrontAddress
			? {
					regionCode: l.storefrontAddress.regionCode,
					postalCode: l.storefrontAddress.postalCode ?? null,
					administrativeArea: l.storefrontAddress.administrativeArea ?? null,
					locality: l.storefrontAddress.locality ?? null,
					addressLines: l.storefrontAddress.addressLines ?? [],
				}
			: null,
	}));
	return ok(locations);
}

/**
 * Narrow view of a Business Profile review. Flattens Google's nested
 * `reviewer` + `reviewReply` objects into top-level fields that map
 * directly onto the columns in our `reviews` and `responses` tables.
 */
export type GbpReview = {
	readonly name: string;
	readonly reviewId: string;
	readonly authorName: string;
	readonly authorAvatarUrl: string | null;
	readonly isAnonymous: boolean;
	readonly rating: 1 | 2 | 3 | 4 | 5 | null;
	readonly content: string;
	readonly publishedAt: string;
	readonly updatedAt: string;
	readonly existingReply: {
		readonly content: string;
		readonly updatedAt: string;
	} | null;
};

export type GbpReviewsPage = {
	readonly reviews: readonly GbpReview[];
	readonly nextPageToken: string | null;
	readonly averageRating: number | null;
	readonly totalReviewCount: number;
};

const STAR_RATING_TO_INT: Record<string, GbpReview["rating"]> = {
	ONE: 1,
	TWO: 2,
	THREE: 3,
	FOUR: 4,
	FIVE: 5,
	STAR_RATING_UNSPECIFIED: null,
};

const reviewerSchema = z.object({
	displayName: z.string().min(1),
	profilePhotoUrl: z.string().optional(),
	isAnonymous: z.boolean().optional(),
});

const reviewReplySchema = z.object({
	comment: z.string().min(1),
	updateTime: z.string().min(1),
});

const reviewSchema = z.object({
	name: z.string().min(1),
	reviewId: z.string().min(1),
	reviewer: reviewerSchema,
	starRating: z.enum([
		"ONE",
		"TWO",
		"THREE",
		"FOUR",
		"FIVE",
		"STAR_RATING_UNSPECIFIED",
	]),
	comment: z.string().optional(),
	createTime: z.string().min(1),
	updateTime: z.string().min(1),
	reviewReply: reviewReplySchema.optional(),
});

const listReviewsResponseSchema = z.object({
	reviews: z.array(reviewSchema).optional(),
	averageRating: z.number().optional(),
	totalReviewCount: z.number().int().nonnegative().optional(),
	nextPageToken: z.string().optional(),
});

/**
 * GET a page of reviews for a Business Profile location. Uses the legacy
 * v4 endpoint (`mybusiness.googleapis.com/v4`) — until Google moves reviews
 * onto the split APIs, this is the only path. Access is gated on the
 * approval request; calls before approval return 403 with "API not been
 * used" or "accessNotConfigured", which the shared mapper translates to
 * `gbp_legacy_api_access_denied`.
 *
 * Pagination is surfaced — the caller loops with `pageToken` until the
 * function returns `nextPageToken: null`. 50 reviews per page is the
 * documented Google max.
 */
export async function listReviews(params: {
	accessToken: string;
	locationName: string;
	pageSize?: number;
	pageToken?: string | undefined;
}): Promise<Result<GbpReviewsPage, GbpError | IntegrationError>> {
	const url = new URL(`${LEGACY_V4_BASE}/${params.locationName}/reviews`);
	url.searchParams.set("pageSize", String(params.pageSize ?? 50));
	if (params.pageToken) url.searchParams.set("pageToken", params.pageToken);

	const responseResult = await fromPromise(
		fetch(url.toString(), {
			headers: { authorization: `Bearer ${params.accessToken}` },
		}),
		toNetworkError,
	);
	if (responseResult.isErr()) return err(responseResult.error);
	const response = responseResult.value;

	const bodyResult = await fromPromise(response.text(), toNetworkError);
	if (bodyResult.isErr()) return err(bodyResult.error);
	const rawBody = bodyResult.value;

	if (!response.ok) {
		return err(toGbpHttpError(response.status, rawBody));
	}

	const jsonResult = safeJsonParseText(rawBody);
	if (jsonResult.isErr()) {
		return err({
			kind: "gbp_invalid_response",
			issues: [{ path: [], message: "response body is not valid JSON" }],
		});
	}

	const parsed = listReviewsResponseSchema.safeParse(jsonResult.value);
	if (!parsed.success) {
		return err({
			kind: "gbp_invalid_response",
			issues: zodIssuesToValidationIssues(parsed.error),
		});
	}

	const reviews: GbpReview[] = (parsed.data.reviews ?? []).map((r) => ({
		name: r.name,
		reviewId: r.reviewId,
		authorName: r.reviewer.displayName,
		authorAvatarUrl: r.reviewer.profilePhotoUrl ?? null,
		isAnonymous: r.reviewer.isAnonymous ?? false,
		rating: STAR_RATING_TO_INT[r.starRating] ?? null,
		content: r.comment ?? "",
		publishedAt: r.createTime,
		updatedAt: r.updateTime,
		existingReply: r.reviewReply
			? {
					content: r.reviewReply.comment,
					updatedAt: r.reviewReply.updateTime,
				}
			: null,
	}));

	return ok({
		reviews,
		nextPageToken: parsed.data.nextPageToken ?? null,
		averageRating: parsed.data.averageRating ?? null,
		totalReviewCount: parsed.data.totalReviewCount ?? 0,
	});
}

/**
 * Number of milliseconds before `access_token_expires_at` at which we
 * preemptively refresh. Prevents the classic race where the token looks
 * valid at fetch-start but has expired by the time the request reaches
 * Google. 60 s is generous for server-to-server calls.
 */
const REFRESH_BUFFER_MS = 60_000;

export type AccessTokenBundle = {
	readonly accessToken: string;
	readonly connection: ActiveConnection;
};

export type GetAccessTokenError =
	| { readonly kind: "no_active_connection"; readonly organizationId: string }
	| { readonly kind: "missing_refresh_token"; readonly connectionId: string }
	/** Terminal — refresh token revoked upstream; connection is now soft-deleted. */
	| { readonly kind: "connection_revoked"; readonly connectionId: string }
	| CryptoError
	| OAuthError
	| IntegrationError
	| DbError;

/**
 * Entry point every Google Business Profile API call goes through: returns
 * a fresh access_token for the org's active Google connection, refreshing
 * (and persisting) in place if the stored token is within the expiry
 * buffer. Never hands out an expired or soon-to-expire token.
 *
 * If Google rejects the refresh with `invalid_grant` (user removed app
 * access, admin forced sign-out), the connection is soft-deleted and the
 * caller gets `connection_revoked` — terminal, they should surface the
 * "please reconnect" UX rather than retry.
 */
export async function getAccessTokenForOrg(params: {
	organizationId: string;
	platform: "google";
	now?: Date;
}): Promise<Result<AccessTokenBundle, GetAccessTokenError>> {
	const now = params.now ?? new Date();

	const connResult = await getActiveConnection({
		organizationId: params.organizationId,
		platform: params.platform,
	});
	if (connResult.isErr()) {
		if (connResult.error.kind === "db_not_found") {
			return err({
				kind: "no_active_connection",
				organizationId: params.organizationId,
			});
		}
		return err(connResult.error);
	}
	const conn = connResult.value;

	const plainAccessResult = decryptToken(conn.encryptedAccessToken);
	if (plainAccessResult.isErr()) return err(plainAccessResult.error);

	const expiresAt = conn.accessTokenExpiresAt;
	const stillValid =
		expiresAt !== null &&
		expiresAt.getTime() - now.getTime() > REFRESH_BUFFER_MS;
	if (stillValid) {
		return ok({ accessToken: plainAccessResult.value, connection: conn });
	}

	// Token expired / near expiry — need to refresh.
	if (!conn.encryptedRefreshToken) {
		// No refresh token stored means we can't recover without a re-consent
		// by the user. Surface a dedicated kind so the caller can route them
		// to the "connect Google" button.
		return err({ kind: "missing_refresh_token", connectionId: conn.id });
	}

	const plainRefreshResult = decryptToken(conn.encryptedRefreshToken);
	if (plainRefreshResult.isErr()) return err(plainRefreshResult.error);

	const refreshResult = await refreshAccessToken({
		refreshToken: plainRefreshResult.value,
	});

	if (refreshResult.isErr()) {
		if (isRefreshTokenRevoked(refreshResult.error)) {
			logger.warn(
				{
					event: "gbp_refresh_token_revoked",
					connectionId: conn.id,
					orgId: conn.organizationId,
				},
				"Refresh token revoked upstream — soft-deleting connection",
			);
			// Best-effort — even if the mark fails the user will still see
			// the revoked error and can trigger a re-connect.
			await markConnectionRevoked({
				id: conn.id,
				organizationId: conn.organizationId,
			});
			return err({ kind: "connection_revoked", connectionId: conn.id });
		}
		return err(refreshResult.error);
	}

	const tokens = refreshResult.value;

	const encAccessResult = encryptToken(tokens.access_token);
	if (encAccessResult.isErr()) return err(encAccessResult.error);

	let encRefreshValue: string | null = null;
	if (tokens.refresh_token) {
		const encRefreshResult = encryptToken(tokens.refresh_token);
		if (encRefreshResult.isErr()) return err(encRefreshResult.error);
		encRefreshValue = encRefreshResult.value;
	}

	const newExpiresAt = new Date(now.getTime() + tokens.expires_in * 1000);
	const newScopes = tokens.scope.split(" ");

	const updateResult = await updateConnectionTokens({
		id: conn.id,
		encryptedAccessToken: encAccessResult.value,
		encryptedRefreshToken: encRefreshValue,
		accessTokenExpiresAt: newExpiresAt,
		scopes: newScopes,
	});
	if (updateResult.isErr()) return err(updateResult.error);

	logger.debug(
		{
			event: "gbp_access_token_refreshed",
			connectionId: conn.id,
			orgId: conn.organizationId,
			expiresAt: newExpiresAt,
		},
		"Access token refreshed and persisted",
	);

	return ok({
		accessToken: tokens.access_token,
		connection: {
			...conn,
			encryptedAccessToken: encAccessResult.value,
			encryptedRefreshToken: encRefreshValue ?? conn.encryptedRefreshToken,
			accessTokenExpiresAt: newExpiresAt,
			scopes: newScopes,
		},
	});
}
