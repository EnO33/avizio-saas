import { createClerkClient, type UserJSON } from "@clerk/backend";
import { env } from "#/lib/env";
import type { DbError } from "#/lib/errors";
import { unknownToMessage } from "#/lib/errors";
import { err, fromPromise, ok, type Result } from "#/lib/result";

type VoidResult = Result<void, DbError>;

// A single backend client per process — the underlying fetch calls are
// stateless, so reuse is safe and avoids reparsing options per webhook.
const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

function toDbError(e: unknown): DbError {
	return { kind: "db_unknown", message: unknownToMessage(e) };
}

/**
 * Best-effort name for the auto-created org: first name → email local-part →
 * generic French fallback. The user can rename it later via the Clerk UI.
 */
export function deriveOrgName(user: UserJSON): string {
	if (user.first_name && user.first_name.trim().length > 0) {
		return user.first_name.trim();
	}
	const primary = user.email_addresses.find(
		(e) => e.id === user.primary_email_address_id,
	);
	const email =
		primary?.email_address ?? user.email_addresses[0]?.email_address;
	if (email) {
		const local = email.split("@")[0];
		if (local && local.length > 0) return local;
	}
	return "Mon organisation";
}

/**
 * On `user.created`, make sure the user lands with at least one organization.
 * Our whole data model is org-scoped (connections, establishments, reviews),
 * so a user without an active org can't do anything meaningful.
 *
 * Idempotent: if the user already has at least one membership we skip — this
 * handles both webhook retries and users who created an org themselves in the
 * brief window between `user.created` and this handler running.
 */
export async function handleUserCreatedAutoOrg(
	user: UserJSON,
): Promise<VoidResult> {
	const memberships = await fromPromise(
		clerkClient.users.getOrganizationMembershipList({ userId: user.id }),
		toDbError,
	);
	if (memberships.isErr()) return err(memberships.error);
	if (memberships.value.totalCount > 0) return ok(undefined);

	const name = deriveOrgName(user);
	return fromPromise(
		clerkClient.organizations.createOrganization({
			name,
			createdBy: user.id,
		}),
		toDbError,
	).map(() => undefined);
}
