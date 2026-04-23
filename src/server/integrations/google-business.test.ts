import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listAccounts, listLocations, listReviews } from "./google-business";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

// Fixture shaped after Google's documented response at
// https://developers.google.com/my-business/reference/accountmanagement/rest/v1/accounts/list
const LIST_ACCOUNTS_FIXTURE = {
	accounts: [
		{
			name: "accounts/100000000000001",
			accountName: "Le Gourmet",
			type: "LOCATION_GROUP",
			role: "OWNER",
			verificationState: "VERIFIED",
		},
		{
			name: "accounts/100000000000002",
			accountName: "Ma Boulangerie",
			type: "PERSONAL",
			role: "OWNER",
			verificationState: "VERIFIED",
		},
	],
};

describe("listAccounts", () => {
	beforeEach(() => {
		vi.spyOn(globalThis, "fetch");
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("GETs the accountmanagement v1 endpoint with a Bearer token", async () => {
		const fetchMock = vi.mocked(globalThis.fetch);
		fetchMock.mockResolvedValueOnce(jsonResponse(LIST_ACCOUNTS_FIXTURE));

		const result = await listAccounts("at-1234");
		expect(result.isOk()).toBe(true);

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(
			"https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
		);
		const headers = init.headers as Record<string, string>;
		expect(headers.authorization).toBe("Bearer at-1234");
	});

	it("returns a narrow projection with name + accountName", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			jsonResponse(LIST_ACCOUNTS_FIXTURE),
		);

		const result = await listAccounts("at");
		expect(result.isOk()).toBe(true);
		if (result.isErr()) throw new Error("unreachable");
		expect(result.value).toEqual([
			{ name: "accounts/100000000000001", accountName: "Le Gourmet" },
			{ name: "accounts/100000000000002", accountName: "Ma Boulangerie" },
		]);
	});

	it("returns an empty array when Google's response omits `accounts`", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({}));
		const result = await listAccounts("at");
		expect(result.isOk()).toBe(true);
		if (result.isErr()) throw new Error("unreachable");
		expect(result.value).toEqual([]);
	});

	it("handles accounts with a missing accountName by nulling the field", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			jsonResponse({
				accounts: [{ name: "accounts/xyz" }],
			}),
		);
		const result = await listAccounts("at");
		expect(result.isOk()).toBe(true);
		if (result.isErr()) throw new Error("unreachable");
		expect(result.value).toEqual([{ name: "accounts/xyz", accountName: null }]);
	});

	it("returns integration_unauthorized on HTTP 401", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response("expired", { status: 401 }),
		);

		const result = await listAccounts("at");
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("integration_unauthorized");
	});

	it("returns gbp_insufficient_scope on 403 with insufficient scope body", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: {
						code: 403,
						message: "Request had insufficient authentication scopes.",
						status: "PERMISSION_DENIED",
					},
				}),
				{ status: 403 },
			),
		);

		const result = await listAccounts("at");
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("gbp_insufficient_scope");
	});

	it("returns gbp_legacy_api_access_denied when Google says API not enabled", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: {
						code: 403,
						message:
							"My Business Account Management API has not been used in project 123 before or it is disabled.",
						status: "PERMISSION_DENIED",
					},
				}),
				{ status: 403 },
			),
		);

		const result = await listAccounts("at");
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("gbp_legacy_api_access_denied");
	});

	it("returns integration_rate_limited on HTTP 429", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response("slow down", { status: 429 }),
		);

		const result = await listAccounts("at");
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("integration_rate_limited");
	});

	it("returns gbp_http_error on other 4xx / 5xx", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response("oops", { status: 500 }),
		);

		const result = await listAccounts("at");
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("gbp_http_error");
		if (result.error.kind !== "gbp_http_error") throw new Error("unreachable");
		expect(result.error.status).toBe(500);
	});

	it("returns gbp_invalid_response when the body is not JSON", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response("<html>nope</html>", { status: 200 }),
		);

		const result = await listAccounts("at");
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("gbp_invalid_response");
	});

	it("returns gbp_invalid_response when an account is missing `name`", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			jsonResponse({ accounts: [{ accountName: "No Name" }] }),
		);

		const result = await listAccounts("at");
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("gbp_invalid_response");
	});

	it("returns integration_network on fetch rejection", async () => {
		vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error("ENETDOWN"));

		const result = await listAccounts("at");
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("integration_network");
	});
});

// Fixture shaped after
// https://developers.google.com/my-business/reference/businessinformation/rest/v1/accounts.locations/list
const LIST_LOCATIONS_FIXTURE = {
	locations: [
		{
			name: "locations/987654321",
			title: "Le Gourmet - Lyon",
			storeCode: "LG-LYON-01",
			storefrontAddress: {
				regionCode: "FR",
				languageCode: "fr",
				postalCode: "69001",
				administrativeArea: "Rhône",
				locality: "Lyon",
				addressLines: ["12 Rue Mercière"],
			},
		},
		{
			name: "locations/555666777",
			title: "Le Gourmet - Annexe",
			storefrontAddress: {
				regionCode: "FR",
				locality: "Villeurbanne",
				addressLines: ["3 Avenue Henri Barbusse"],
			},
		},
	],
	totalSize: 2,
};

describe("listLocations", () => {
	beforeEach(() => {
		vi.spyOn(globalThis, "fetch");
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("GETs /v1/accounts/{id}/locations with Bearer token + readMask", async () => {
		const fetchMock = vi.mocked(globalThis.fetch);
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify(LIST_LOCATIONS_FIXTURE), { status: 200 }),
		);

		const result = await listLocations({
			accessToken: "at-1234",
			accountName: "accounts/100000000000001",
		});
		expect(result.isOk()).toBe(true);

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		const parsed = new URL(url);
		expect(parsed.origin).toBe(
			"https://mybusinessbusinessinformation.googleapis.com",
		);
		expect(parsed.pathname).toBe("/v1/accounts/100000000000001/locations");
		expect(parsed.searchParams.get("readMask")).toBe(
			"name,title,storeCode,storefrontAddress",
		);
		const headers = init.headers as Record<string, string>;
		expect(headers.authorization).toBe("Bearer at-1234");
	});

	it("narrows the location projection and flattens address fields", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response(JSON.stringify(LIST_LOCATIONS_FIXTURE), { status: 200 }),
		);

		const result = await listLocations({
			accessToken: "at",
			accountName: "accounts/1",
		});
		expect(result.isOk()).toBe(true);
		if (result.isErr()) throw new Error("unreachable");
		expect(result.value).toEqual([
			{
				name: "locations/987654321",
				title: "Le Gourmet - Lyon",
				storeCode: "LG-LYON-01",
				address: {
					regionCode: "FR",
					postalCode: "69001",
					administrativeArea: "Rhône",
					locality: "Lyon",
					addressLines: ["12 Rue Mercière"],
				},
			},
			{
				name: "locations/555666777",
				title: "Le Gourmet - Annexe",
				storeCode: null,
				address: {
					regionCode: "FR",
					postalCode: null,
					administrativeArea: null,
					locality: "Villeurbanne",
					addressLines: ["3 Avenue Henri Barbusse"],
				},
			},
		]);
	});

	it("handles a location with no storefrontAddress by nulling the address", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					locations: [{ name: "locations/1", title: "Virtual Shop" }],
				}),
				{ status: 200 },
			),
		);

		const result = await listLocations({
			accessToken: "at",
			accountName: "accounts/1",
		});
		expect(result.isOk()).toBe(true);
		if (result.isErr()) throw new Error("unreachable");
		expect(result.value[0]?.address).toBeNull();
	});

	it("returns an empty array when Google's response omits `locations`", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response("{}", { status: 200 }),
		);
		const result = await listLocations({
			accessToken: "at",
			accountName: "accounts/1",
		});
		expect(result.isOk()).toBe(true);
		if (result.isErr()) throw new Error("unreachable");
		expect(result.value).toEqual([]);
	});

	it("propagates HTTP errors via the shared mapper", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response("expired", { status: 401 }),
		);

		const result = await listLocations({
			accessToken: "at",
			accountName: "accounts/1",
		});
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("integration_unauthorized");
	});

	it("returns gbp_invalid_response when a location is missing `title`", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response(JSON.stringify({ locations: [{ name: "locations/1" }] }), {
				status: 200,
			}),
		);

		const result = await listLocations({
			accessToken: "at",
			accountName: "accounts/1",
		});
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("gbp_invalid_response");
	});
});

// Fixture shaped after the legacy v4 schema
// https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list
const LIST_REVIEWS_FIXTURE = {
	reviews: [
		{
			name: "accounts/100/locations/987/reviews/rev-1",
			reviewId: "rev-1",
			reviewer: {
				displayName: "Alice Martin",
				profilePhotoUrl: "https://example.com/alice.png",
				isAnonymous: false,
			},
			starRating: "FIVE",
			comment: "Excellent accueil, on reviendra !",
			createTime: "2026-04-20T14:30:00Z",
			updateTime: "2026-04-20T14:30:00Z",
			reviewReply: {
				comment: "Merci Alice, à très vite !",
				updateTime: "2026-04-20T15:00:00Z",
			},
		},
		{
			name: "accounts/100/locations/987/reviews/rev-2",
			reviewId: "rev-2",
			reviewer: { displayName: "Anonymous user", isAnonymous: true },
			starRating: "TWO",
			// No `comment` (rating-only review)
			createTime: "2026-04-19T10:00:00Z",
			updateTime: "2026-04-19T10:00:00Z",
		},
	],
	averageRating: 4.3,
	totalReviewCount: 27,
	nextPageToken: "page-2",
};

describe("listReviews", () => {
	beforeEach(() => {
		vi.spyOn(globalThis, "fetch");
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("GETs the legacy v4 endpoint with Bearer + pageSize defaulting to 50", async () => {
		const fetchMock = vi.mocked(globalThis.fetch);
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify(LIST_REVIEWS_FIXTURE), { status: 200 }),
		);

		const result = await listReviews({
			accessToken: "at-1234",
			locationName: "accounts/100/locations/987",
		});
		expect(result.isOk()).toBe(true);

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		const parsed = new URL(url);
		expect(parsed.origin).toBe("https://mybusiness.googleapis.com");
		expect(parsed.pathname).toBe("/v4/accounts/100/locations/987/reviews");
		expect(parsed.searchParams.get("pageSize")).toBe("50");
		expect(parsed.searchParams.has("pageToken")).toBe(false);
		const headers = init.headers as Record<string, string>;
		expect(headers.authorization).toBe("Bearer at-1234");
	});

	it("forwards pageToken when provided", async () => {
		const fetchMock = vi.mocked(globalThis.fetch);
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify(LIST_REVIEWS_FIXTURE), { status: 200 }),
		);

		await listReviews({
			accessToken: "at",
			locationName: "accounts/1/locations/2",
			pageSize: 25,
			pageToken: "cursor-xyz",
		});

		const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
		const parsed = new URL(url);
		expect(parsed.searchParams.get("pageSize")).toBe("25");
		expect(parsed.searchParams.get("pageToken")).toBe("cursor-xyz");
	});

	it("flattens reviewer + reviewReply and maps star enum to 1..5", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response(JSON.stringify(LIST_REVIEWS_FIXTURE), { status: 200 }),
		);

		const result = await listReviews({
			accessToken: "at",
			locationName: "accounts/100/locations/987",
		});
		expect(result.isOk()).toBe(true);
		if (result.isErr()) throw new Error("unreachable");
		expect(result.value.reviews[0]).toEqual({
			name: "accounts/100/locations/987/reviews/rev-1",
			reviewId: "rev-1",
			authorName: "Alice Martin",
			authorAvatarUrl: "https://example.com/alice.png",
			isAnonymous: false,
			rating: 5,
			content: "Excellent accueil, on reviendra !",
			publishedAt: "2026-04-20T14:30:00Z",
			updatedAt: "2026-04-20T14:30:00Z",
			existingReply: {
				content: "Merci Alice, à très vite !",
				updatedAt: "2026-04-20T15:00:00Z",
			},
		});
		expect(result.value.reviews[1]).toEqual({
			name: "accounts/100/locations/987/reviews/rev-2",
			reviewId: "rev-2",
			authorName: "Anonymous user",
			authorAvatarUrl: null,
			isAnonymous: true,
			rating: 2,
			content: "",
			publishedAt: "2026-04-19T10:00:00Z",
			updatedAt: "2026-04-19T10:00:00Z",
			existingReply: null,
		});
	});

	it("surfaces pagination metadata in the response", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response(JSON.stringify(LIST_REVIEWS_FIXTURE), { status: 200 }),
		);

		const result = await listReviews({
			accessToken: "at",
			locationName: "accounts/100/locations/987",
		});
		expect(result.isOk()).toBe(true);
		if (result.isErr()) throw new Error("unreachable");
		expect(result.value.nextPageToken).toBe("page-2");
		expect(result.value.averageRating).toBe(4.3);
		expect(result.value.totalReviewCount).toBe(27);
	});

	it("maps STAR_RATING_UNSPECIFIED to null", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					reviews: [
						{
							name: "accounts/1/locations/1/reviews/r",
							reviewId: "r",
							reviewer: { displayName: "X" },
							starRating: "STAR_RATING_UNSPECIFIED",
							createTime: "2026-01-01T00:00:00Z",
							updateTime: "2026-01-01T00:00:00Z",
						},
					],
				}),
				{ status: 200 },
			),
		);

		const result = await listReviews({
			accessToken: "at",
			locationName: "accounts/1/locations/1",
		});
		expect(result.isOk()).toBe(true);
		if (result.isErr()) throw new Error("unreachable");
		expect(result.value.reviews[0]?.rating).toBeNull();
	});

	it("returns gbp_legacy_api_access_denied when Google gates the endpoint", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: {
						code: 403,
						message:
							"Google My Business API has not been used in project 123 before or it is disabled.",
						status: "PERMISSION_DENIED",
					},
				}),
				{ status: 403 },
			),
		);

		const result = await listReviews({
			accessToken: "at",
			locationName: "accounts/1/locations/1",
		});
		expect(result.isErr()).toBe(true);
		if (result.isOk()) throw new Error("unreachable");
		expect(result.error.kind).toBe("gbp_legacy_api_access_denied");
	});

	it("returns empty page when Google's response has no reviews", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response(JSON.stringify({ averageRating: 0, totalReviewCount: 0 }), {
				status: 200,
			}),
		);

		const result = await listReviews({
			accessToken: "at",
			locationName: "accounts/1/locations/1",
		});
		expect(result.isOk()).toBe(true);
		if (result.isErr()) throw new Error("unreachable");
		expect(result.value.reviews).toEqual([]);
		expect(result.value.nextPageToken).toBeNull();
		expect(result.value.totalReviewCount).toBe(0);
	});
});
