import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────

export const platformEnum = pgEnum("platform", [
	"google",
	"tripadvisor",
	"trustpilot",
	"thefork",
]);

export const reviewStatusEnum = pgEnum("review_status", [
	"new",
	"in_progress",
	"responded",
	"skipped",
]);

export const responseStatusEnum = pgEnum("response_status", [
	"draft",
	"approved",
	"published",
	"failed",
]);

export const toneEnum = pgEnum("tone", ["warm", "professional", "direct"]);

export const planEnum = pgEnum("plan", ["trial", "solo", "group", "cancelled"]);

export const businessTypeEnum = pgEnum("business_type", [
	"restaurant",
	"hotel",
	"cafe",
	"bar",
	"bakery",
	"artisan",
	"retail",
	"other",
]);

// ─── Organizations (mirror of Clerk orgs) ─────────────────────────────────

export const organizations = pgTable("organizations", {
	id: text("id").primaryKey(), // Clerk organization id
	name: text("name").notNull(),
	stripeCustomerId: text("stripe_customer_id"),
	stripeSubscriptionId: text("stripe_subscription_id"),
	plan: planEnum("plan").notNull().default("trial"),
	trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
	currentPeriodEndsAt: timestamp("current_period_ends_at", {
		withTimezone: true,
	}),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

// ─── Establishments ───────────────────────────────────────────────────────

export const establishments = pgTable(
	"establishments",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => createId()),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		city: text("city").notNull(),
		postalCode: text("postal_code"),
		businessType: businessTypeEnum("business_type").notNull(),
		defaultTone: toneEnum("default_tone").notNull().default("warm"),
		// Free-form context injected into prompt (menu, values, do-not-mention, etc.)
		brandContext: text("brand_context"),
		languageCode: text("language_code").notNull().default("fr"),
		notifyOnLowRating: boolean("notify_on_low_rating").notNull().default(true),
		lowRatingThreshold: integer("low_rating_threshold").notNull().default(3),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => ({
		orgIdx: index("establishments_org_idx").on(t.organizationId),
	}),
);

// ─── Connections (OAuth + API creds, encrypted) ───────────────────────────

export const connections = pgTable(
	"connections",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => createId()),
		establishmentId: text("establishment_id")
			.notNull()
			.references(() => establishments.id, { onDelete: "cascade" }),
		platform: platformEnum("platform").notNull(),
		platformAccountId: text("platform_account_id").notNull(),
		platformAccountLabel: text("platform_account_label"),
		// Ciphertext only. Decryption happens in server/lib/crypto.ts.
		encryptedAccessToken: text("encrypted_access_token").notNull(),
		encryptedRefreshToken: text("encrypted_refresh_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		scopes: text("scopes").array(),
		lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
		lastSyncError: text("last_sync_error"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
	},
	(t) => ({
		uniqueConn: uniqueIndex("connections_unique_idx").on(
			t.establishmentId,
			t.platform,
			t.platformAccountId,
		),
		estIdx: index("connections_est_idx").on(t.establishmentId),
	}),
);

// ─── Reviews (fetched from platforms) ─────────────────────────────────────

export const reviews = pgTable(
	"reviews",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => createId()),
		establishmentId: text("establishment_id")
			.notNull()
			.references(() => establishments.id, { onDelete: "cascade" }),
		platform: platformEnum("platform").notNull(),
		platformReviewId: text("platform_review_id").notNull(),
		authorName: text("author_name").notNull(),
		authorAvatarUrl: text("author_avatar_url"),
		rating: integer("rating").notNull(), // 1..5
		content: text("content").notNull(),
		languageCode: text("language_code"),
		publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
		status: reviewStatusEnum("status").notNull().default("new"),
		// Raw payload from the platform for debug / future reprocessing
		rawPayload: jsonb("raw_payload"),
		fetchedAt: timestamp("fetched_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => ({
		uniqueReview: uniqueIndex("reviews_platform_unique").on(
			t.platform,
			t.platformReviewId,
		),
		estStatusIdx: index("reviews_est_status_idx").on(
			t.establishmentId,
			t.status,
		),
		publishedIdx: index("reviews_published_idx").on(t.publishedAt),
	}),
);

// ─── Responses (draft + published) ────────────────────────────────────────

export const responses = pgTable(
	"responses",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => createId()),
		reviewId: text("review_id")
			.notNull()
			.references(() => reviews.id, { onDelete: "cascade" }),
		content: text("content").notNull(),
		aiGenerated: boolean("ai_generated").notNull().default(true),
		tone: toneEnum("tone").notNull(),
		// Model + prompt version for reproducibility / quality analysis
		modelId: text("model_id"),
		promptVersion: text("prompt_version"),
		status: responseStatusEnum("status").notNull().default("draft"),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		publishedByUserId: text("published_by_user_id"), // Clerk user id
		platformResponseId: text("platform_response_id"),
		failureKind: text("failure_kind"), // discriminated: 'token_expired' | 'rate_limited' | ...
		failureDetail: text("failure_detail"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => ({
		reviewIdx: index("responses_review_idx").on(t.reviewId),
		statusIdx: index("responses_status_idx").on(t.status),
	}),
);

// ─── Audit log (immutable) ────────────────────────────────────────────────

export const auditLog = pgTable(
	"audit_log",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => createId()),
		organizationId: text("organization_id").notNull(),
		actorUserId: text("actor_user_id").notNull(),
		action: text("action").notNull(), // 'response.publish' | 'connection.create' | ...
		subjectType: text("subject_type").notNull(),
		subjectId: text("subject_id").notNull(),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => ({
		orgCreatedIdx: index("audit_org_created_idx").on(
			t.organizationId,
			t.createdAt,
		),
	}),
);

// ─── Relations ────────────────────────────────────────────────────────────

export const organizationsRelations = relations(organizations, ({ many }) => ({
	establishments: many(establishments),
}));

export const establishmentsRelations = relations(
	establishments,
	({ one, many }) => ({
		organization: one(organizations, {
			fields: [establishments.organizationId],
			references: [organizations.id],
		}),
		connections: many(connections),
		reviews: many(reviews),
	}),
);

export const connectionsRelations = relations(connections, ({ one }) => ({
	establishment: one(establishments, {
		fields: [connections.establishmentId],
		references: [establishments.id],
	}),
}));

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
	establishment: one(establishments, {
		fields: [reviews.establishmentId],
		references: [establishments.id],
	}),
	responses: many(responses),
}));

export const responsesRelations = relations(responses, ({ one }) => ({
	review: one(reviews, {
		fields: [responses.reviewId],
		references: [reviews.id],
	}),
}));

// ─── Type exports ─────────────────────────────────────────────────────────

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type Establishment = typeof establishments.$inferSelect;
export type NewEstablishment = typeof establishments.$inferInsert;

export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;

export type Response = typeof responses.$inferSelect;
export type NewResponse = typeof responses.$inferInsert;

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
