CREATE TABLE "fraction_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"fraction_id" text NOT NULL,
	"name" text NOT NULL,
	"nif" text,
	"mobile" text,
	"phone" text,
	"email" text,
	"notes" text,
	"user_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "fraction_contacts" ADD CONSTRAINT "fraction_contacts_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraction_contacts" ADD CONSTRAINT "fraction_contacts_fraction_id_fractions_id_fk" FOREIGN KEY ("fraction_id") REFERENCES "public"."fractions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraction_contacts" ADD CONSTRAINT "fraction_contacts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraction_contacts" ADD CONSTRAINT "fraction_contacts_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fraction_contacts_org_fraction_idx" ON "fraction_contacts" USING btree ("org_id","fraction_id");--> statement-breakpoint
CREATE INDEX "fraction_contacts_org_user_idx" ON "fraction_contacts" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fraction_contacts_fraction_user_idx" ON "fraction_contacts" USING btree ("fraction_id","user_id");