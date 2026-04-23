ALTER TABLE "connections" DROP CONSTRAINT "connections_establishment_id_establishments_id_fk";
--> statement-breakpoint
DROP INDEX "connections_est_idx";--> statement-breakpoint
DROP INDEX "connections_unique_idx";--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "organization_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connections_org_idx" ON "connections" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connections_unique_idx" ON "connections" USING btree ("organization_id","platform","platform_account_id");--> statement-breakpoint
ALTER TABLE "connections" DROP COLUMN "establishment_id";