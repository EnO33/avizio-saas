import type {
	OrganizationJSON,
	OrganizationMembershipJSON,
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
	userJsonToRow,
} from "./clerk-transforms";

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

export function handleUnknownEvent(): Promise<VoidResult> {
	// Not an error — just skip. The webhook subscription might emit events
	// we don't care about (session.*, email.*, etc.).
	return Promise.resolve(ok(undefined));
}
