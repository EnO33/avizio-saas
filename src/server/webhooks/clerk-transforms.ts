import type {
	OrganizationJSON,
	OrganizationMembershipJSON,
	SessionWebhookEvent,
	UserJSON,
} from "@clerk/backend";
import type {
	NewOrganization,
	NewOrganizationMembership,
	NewUser,
} from "../db/schema";

// `SessionWebhookEventJSON` isn't re-exported from `@clerk/backend` — derive
// it from the event's `data` field.
type SessionWebhookEventJSON = SessionWebhookEvent["data"];

const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

export function userJsonToRow(user: UserJSON): NewUser {
	const primary =
		user.email_addresses.find((e) => e.id === user.primary_email_address_id) ??
		user.email_addresses[0];

	return {
		id: user.id,
		email: primary?.email_address ?? "",
		emailVerified: primary?.verification?.status === "verified",
		firstName: user.first_name,
		lastName: user.last_name,
		imageUrl: user.has_image ? user.image_url : null,
		lastSignInAt: user.last_sign_in_at ? new Date(user.last_sign_in_at) : null,
	};
}

export function organizationJsonToNewRow(
	org: OrganizationJSON,
): NewOrganization {
	return {
		id: org.id,
		name: org.name,
		trialEndsAt: new Date(Date.now() + TRIAL_DURATION_MS),
	};
}

export function organizationJsonToUpdateRow(
	org: OrganizationJSON,
): Pick<NewOrganization, "name" | "updatedAt"> {
	return {
		name: org.name,
		updatedAt: new Date(),
	};
}

export function organizationMembershipJsonToRow(
	mem: OrganizationMembershipJSON,
): NewOrganizationMembership {
	return {
		id: mem.id,
		organizationId: mem.organization.id,
		userId: mem.public_user_data.user_id,
		role: mem.role,
	};
}

export type UserSignInUpdate = {
	readonly userId: string;
	readonly lastSignInAt: Date;
};

export function sessionJsonToUserSignIn(
	session: SessionWebhookEventJSON,
): UserSignInUpdate {
	return {
		userId: session.user_id,
		lastSignInAt: new Date(session.created_at),
	};
}
