ALTER TABLE "organization" ADD COLUMN "invite_code" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "invite_enabled" boolean DEFAULT false NOT NULL;