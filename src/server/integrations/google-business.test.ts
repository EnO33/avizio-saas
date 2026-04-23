import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listAccounts } from "./google-business";

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
