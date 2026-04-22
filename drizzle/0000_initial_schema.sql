CREATE TYPE "public"."business_type" AS ENUM('restaurant', 'hotel', 'cafe', 'bar', 'bakery', 'artisan', 'retail', 'other');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('trial', 'solo', 'group', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('google', 'tripadvisor', 'trustpilot', 'thefork');--> statement-breakpoint
CREATE TYPE "public"."response_status" AS ENUM('draft', 'approved', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('new', 'in_progress', 'responded', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."tone" AS ENUM('warm', 'professional', 'direct');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" text PRIMARY KEY NOT NULL,
	"establishment_id" text NOT NULL,
	"platform" "platform" NOT NULL,
	"platform_account_id" text NOT NULL,
	"platform_account_label" text,
	"encrypted_access_token" text NOT NULL,
	"encrypted_refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"scopes" text[],
	"last_synced_at" timestamp with time zone,
	"last_sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "establishments" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"postal_code" text,
	"business_type" "business_type" NOT NULL,
	"default_tone" "tone" DEFAULT 'warm' NOT NULL,
	"brand_context" text,
	"language_code" text DEFAULT 'fr' NOT NULL,
	"notify_on_low_rating" boolean DEFAULT true NOT NULL,
	"low_rating_threshold" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan" "plan" DEFAULT 'trial' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"current_period_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text NOT NULL,
	"content" text NOT NULL,
	"ai_generated" boolean DEFAULT true NOT NULL,
	"tone" "tone" NOT NULL,
	"model_id" text,
	"prompt_version" text,
	"status" "response_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"published_by_user_id" text,
	"platform_response_id" text,
	"failure_kind" text,
	"failure_detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"establishment_id" text NOT NULL,
	"platform" "platform" NOT NULL,
	"platform_review_id" text NOT NULL,
	"author_name" text NOT NULL,
	"author_avatar_url" text,
	"rating" integer NOT NULL,
	"content" text NOT NULL,
	"language_code" text,
	"published_at" timestamp with time zone NOT NULL,
	"status" "review_status" DEFAULT 'new' NOT NULL,
	"raw_payload" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "establishments" ADD CONSTRAINT "establishments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_org_created_idx" ON "audit_log" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "connections_unique_idx" ON "connections" USING btree ("establishment_id","platform","platform_account_id");--> statement-breakpoint
CREATE INDEX "connections_est_idx" ON "connections" USING btree ("establishment_id");--> statement-breakpoint
CREATE INDEX "establishments_org_idx" ON "establishments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "responses_review_idx" ON "responses" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "responses_status_idx" ON "responses" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_platform_unique" ON "reviews" USING btree ("platform","platform_review_id");--> statement-breakpoint
CREATE INDEX "reviews_est_status_idx" ON "reviews" USING btree ("establishment_id","status");--> statement-breakpoint
CREATE INDEX "reviews_published_idx" ON "reviews" USING btree ("published_at");