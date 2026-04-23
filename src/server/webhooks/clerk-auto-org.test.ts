import type { EmailAddressJSON, UserJSON } from "@clerk/backend";
import { describe, expect, it } from "vitest";
import { deriveOrgName } from "./clerk-auto-org";

// cast-reason: minimal test fixtures
function makeEmail(id: string, email: string): EmailAddressJSON {
	return {
		id,
		email_address: email,
		verification: { status: "verified" } as EmailAddressJSON["verification"],
	} as EmailAddressJSON;
}

// cast-reason: minimal test fixtures
function makeUser(overrides: Partial<UserJSON> = {}): UserJSON {
	return {
		id: "user_123",
		first_name: null,
		last_name: null,
		primary_email_address_id: "email_primary",
		email_addresses: [makeEmail("email_primary", "alice.durand@example.com")],
		...overrides,
	} as UserJSON;
}

describe("deriveOrgName", () => {
	it("uses the first name when available", () => {
		expect(deriveOrgName(makeUser({ first_name: "Alice" }))).toBe("Alice");
	});

	it("trims surrounding whitespace on the first name", () => {
		expect(deriveOrgName(makeUser({ first_name: "  Alice  " }))).toBe("Alice");
	});

	it("falls back to the email local part when there's no first name", () => {
		expect(deriveOrgName(makeUser({ first_name: null }))).toBe("alice.durand");
	});

	it("treats a blank first name as missing", () => {
		expect(deriveOrgName(makeUser({ first_name: "   " }))).toBe("alice.durand");
	});

	it("prefers the primary email over non-primary addresses", () => {
		const user = makeUser({
			first_name: null,
			primary_email_address_id: "email_primary",
			email_addresses: [
				makeEmail("email_other", "secondary@example.com"),
				makeEmail("email_primary", "primary@example.com"),
			],
		});
		expect(deriveOrgName(user)).toBe("primary");
	});

	it("falls back to a generic label when no name or email is usable", () => {
		const user = makeUser({
			first_name: null,
			primary_email_address_id: null,
			email_addresses: [],
		});
		expect(deriveOrgName(user)).toBe("Mon organisation");
	});
});
