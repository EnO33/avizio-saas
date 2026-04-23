import type {
	OrganizationJSON,
	OrganizationMembershipJSON,
	SessionWebhookEvent,
	UserJSON,
} from "@clerk/backend";
import { eq } from "drizzle-orm";
import type { DbError } from "#/lib/errors";
import { unknownToMessage } from "#/lib/errors";
import { fromPromise, ok, type Result } from "#/lib/result";
import { db } from "../db/client";
import { organizationMemberships, organizations, users } from "../db/schema";
import {
	organizationJsonToNewRow,
	organizationJsonToUpdateRow,
	organizationMembershipJsonToRow,
	sessionJsonToUserSignIn,
	userJsonToRow,
} from "./clerk-transforms";

type SessionWebhookEventJSON = SessionWebhookEvent["data"];

type VoidResult = Result<void, DbError>;

function toDbError(e: unknown): DbError {
	return { kind: "db_unknown", message: unknownToMessage(e) };
}

export async function handleUserUpsert(user: UserJSON): Promise<VoidResult> {
	const row = userJsonToRow(user);
	return fromPromise(
		db
			.insert(users)
			.values(row)
			.onConflictDoUpdate({
				target: users.id,
				set: {
					email: row.email,
					emailVerified: row.emailVerified,
					firstName: row.firstName,
					lastName: row.lastName,
					imageUrl: row.imageUrl,
					lastSignInAt: row.lastSignInAt,
					updatedAt: new Date(),
				},
			}),
		toDbError,
	).map(() => undefined);
}

export async function handleUserDelete(userId: string): Promise<VoidResult> {
	return fromPromise(
		db.delete(users).where(eq(users.id, userId)),
		toDbError,
	).map(() => undefined);
}

export async function handleOrganizationUpsert(
	org: OrganizationJSON,
): Promise<VoidResult> {
	return fromPromise(
		db
			.insert(organizations)
			.values(organizationJsonToNewRow(org))
			.onConflictDoUpdate({
				target: organizations.id,
				// Intentionally narrow: `trialEndsAt` is set once at creation and
				// must not be reset by subsequent `organization.updated` events.
				set: organizationJsonToUpdateRow(org),
			}),
		toDbError,
	).map(() => undefined);
}

export async function handleOrganizationDelete(
	orgId: string,
): Promise<VoidResult> {
	return fromPromise(
		db.delete(organizations).where(eq(organizations.id, orgId)),
		toDbError,
	).map(() => undefined);
}

export async function handleMembershipUpsert(
	mem: OrganizationMembershipJSON,
): Promise<VoidResult> {
	const row = organizationMembershipJsonToRow(mem);
	return fromPromise(
		db
			.insert(organizationMemberships)
			.values(row)
			.onConflictDoUpdate({
				target: organizationMemberships.id,
				set: {
					role: row.role,
					updatedAt: new Date(),
				},
			}),
		toDbError,
	).map(() => undefined);
}

export async function handleMembershipDelete(
	membershipId: string,
): Promise<VoidResult> {
	return fromPromise(
		db
			.delete(organizationMemberships)
			.where(eq(organizationMemberships.id, membershipId)),
		toDbError,
	).map(() => undefined);
}

export async function handleSessionCreated(
	session: SessionWebhookEventJSON,
): Promise<VoidResult> {
	const { userId, lastSignInAt } = sessionJsonToUserSignIn(session);
	// If the user row doesn't exist yet (e.g. `session.created` arrived before
	// `user.created` in a fresh signup), UPDATE affects 0 rows and returns OK —
	// the subsequent `user.created` handler will insert with last_sign_in_at
	// already populated from `UserJSON.last_sign_in_at`, so no data is lost.
	return fromPromise(
		db
			.update(users)
			.set({ lastSignInAt, updatedAt: new Date() })
			.where(eq(users.id, userId)),
		toDbError,
	).map(() => undefined);
}

export function handleUnknownEvent(): Promise<VoidResult> {
	// Not an error — just skip. The webhook subscription might emit events
	// we don't care about (email.*, sms.*, etc.).
	return Promise.resolve(ok(undefined));
}
