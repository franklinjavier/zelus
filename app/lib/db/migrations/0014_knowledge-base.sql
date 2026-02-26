ALTER TABLE "documents" ADD COLUMN "type" text DEFAULT 'file' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "body" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "pinned_at" timestamp;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "file_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "file_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "file_size" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "mime_type" DROP NOT NULL;