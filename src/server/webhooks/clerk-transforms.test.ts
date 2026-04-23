import type {
	EmailAddressJSON,
	OrganizationJSON,
	OrganizationMembershipJSON,
	UserJSON,
} from "@clerk/backend";
import { describe, expect, it } from "vitest";
import {
	organizationJsonToNewRow,
	organizationJsonToUpdateRow,
	organizationMembershipJsonToRow,
	userJsonToRow,
} from "./clerk-transforms";

// Test fixtures don't need every Clerk field — we only care about what the
// transforms touch. `as` keeps the fixtures readable without polluting the
// prod types.
// cast-reason: minimal test fixtures
function makeEmail(
	id: string,
	email: string,
	verified: boolean,
): EmailAddressJSON {
	return {
		id,
		email_address: email,
		verification: verified
			? ({ status: "verified" } as EmailAddressJSON["verification"])
			: null,
	} as EmailAddressJSON;
}

// cast-reason: minimal test fixtures
function makeUser(overrides: Partial<UserJSON> = {}): UserJSON {
	return {
		id: "user_123",
		first_name: "Alice",
		last_name: "Durand",
		image_url: "https://example.com/alice.png",
		has_image: true,
		primary_email_address_id: "email_primary",
		email_addresses: [makeEmail("email_primary", "alice@example.com", true)],
		last_sign_in_at: null,
		...overrides,
	} as UserJSON;
}

describe("userJsonToRow", () => {
	it("extracts the primary email via primary_email_address_id", () => {
		const user = makeUser({
			email_addresses: [
				makeEmail("email_secondary", "other@example.com", false),
				makeEmail("email_primary", "alice@example.com", true),
			],
			primary_email_address_id: "email_primary",
		});
		const row = userJsonToRow(user);
		expect(row.email).toBe("alice@example.com");
		expect(row.emailVerified).toBe(true);
	});

	it("falls back to the first email when primary_email_address_id is unknown", () => {
		const user = makeUser({
			email_addresses: [makeEmail("email_first", "first@example.com", false)],
			primary_email_address_id: "email_missing",
		});
		const row = userJsonToRow(user);
		expect(row.email).toBe("first@example.com");
		expect(row.emailVerified).toBe(false);
	});

	it("returns empty email string when the user has no email addresses", () => {
		const user = makeUser({
			email_addresses: [],
			primary_email_address_id: null,
		});
		const row = userJsonToRow(user);
		expect(row.email).toBe("");
		expect(row.emailVerified).toBe(false);
	});

	it("preserves null first_name / last_name", () => {
		const user = makeUser({ first_name: null, last_name: null });
		const row = userJsonToRow(user);
		expect(row.firstName).toBeNull();
		expect(row.lastName).toBeNull();
	});

	it("sets imageUrl to null when has_image is false", () => {
		const user = makeUser({
			has_image: false,
			image_url: "https://img.clerk.com/default-avatar.png",
		});
		const row = userJsonToRow(user);
		expect(row.imageUrl).toBeNull();
	});

	it("keeps imageUrl when has_image is true", () => {
		const user = makeUser({
			has_image: true,
			image_url: "https://example.com/a.png",
		});
		const row = userJsonToRow(user);
		expect(row.imageUrl).toBe("https://example.com/a.png");
	});

	it("converts last_sign_in_at number to Date, or null", () => {
		const ts = 1_700_000_000_000;
		expect(
			userJsonToRow(makeUser({ last_sign_in_at: ts })).lastSignInAt,
		).toEqual(new Date(ts));
		expect(
			userJsonToRow(makeUser({ last_sign_in_at: null })).lastSignInAt,
		).toBeNull();
	});
});

// cast-reason: minimal test fixtures
function makeOrg(overrides: Partial<OrganizationJSON> = {}): OrganizationJSON {
	return {
		id: "org_abc",
		name: "Acme",
		...overrides,
	} as OrganizationJSON;
}

describe("organizationJsonToNewRow", () => {
	it("sets id, name, and a 14-day trial end", () => {
		const before = Date.now();
		const row = organizationJsonToNewRow(makeOrg({ id: "org_1", name: "A" }));
		const after = Date.now();
		expect(row.id).toBe("org_1");
		expect(row.name).toBe("A");
		expect(row.trialEndsAt).toBeInstanceOf(Date);
		const expectedMin = before + 14 * 24 * 60 * 60 * 1000;
		const expectedMax = after + 14 * 24 * 60 * 60 * 1000;
		const actual = row.trialEndsAt?.getTime() ?? 0;
		expect(actual).toBeGreaterThanOrEqual(expectedMin);
		expect(actual).toBeLessThanOrEqual(expectedMax);
	});
});

describe("organizationJsonToUpdateRow", () => {
	it("sets only name and updatedAt (never touches trialEndsAt)", () => {
		const row = organizationJsonToUpdateRow(makeOrg({ name: "New Name" }));
		expect(row.name).toBe("New Name");
		expect(row.updatedAt).toBeInstanceOf(Date);
		expect(Object.keys(row)).toEqual(["name", "updatedAt"]);
	});
});

// cast-reason: minimal test fixtures
function makeMembership(
	overrides: Partial<OrganizationMembershipJSON> = {},
): OrganizationMembershipJSON {
	return {
		id: "orgmem_123",
		role: "org:admin",
		organization: { id: "org_abc" } as OrganizationJSON,
		public_user_data: {
			user_id: "user_123",
			identifier: "alice@example.com",
			first_name: "Alice",
			last_name: "Durand",
			image_url: "",
			has_image: false,
		},
		...overrides,
	} as OrganizationMembershipJSON;
}

describe("organizationMembershipJsonToRow", () => {
	it("extracts id, org id, user id, and role", () => {
		const row = organizationMembershipJsonToRow(
			makeMembership({
				id: "orgmem_9",
				role: "org:member",
				organization: { id: "org_xyz" } as OrganizationJSON,
				public_user_data: {
					user_id: "user_42",
					identifier: "",
					first_name: null,
					last_name: null,
					image_url: "",
					has_image: false,
				},
			}),
		);
		expect(row.id).toBe("orgmem_9");
		expect(row.organizationId).toBe("org_xyz");
		expect(row.userId).toBe("user_42");
		expect(row.role).toBe("org:member");
	});

	it("passes custom roles through without transformation", () => {
		const row = organizationMembershipJsonToRow(
			makeMembership({ role: "org:custom_manager" }),
		);
		expect(row.role).toBe("org:custom_manager");
	});
});
