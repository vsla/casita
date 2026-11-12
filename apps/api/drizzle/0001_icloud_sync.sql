ALTER TABLE "photos" ADD COLUMN "source" text DEFAULT 'upload' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "taken_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_events_external_idx" ON "calendar_events" USING btree ("household_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "photos_external_idx" ON "photos" USING btree ("household_id","external_id");