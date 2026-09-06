CREATE TABLE "user_bans" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"banned_by" text,
	"banned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lifted_by" text,
	"lifted_at" timestamp with time zone,
	"lift_reason" text
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_bans" ADD CONSTRAINT "user_bans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bans" ADD CONSTRAINT "user_bans_banned_by_user_id_fk" FOREIGN KEY ("banned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bans" ADD CONSTRAINT "user_bans_lifted_by_user_id_fk" FOREIGN KEY ("lifted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_bans_user_id_idx" ON "user_bans" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_bans_active_uidx" ON "user_bans" USING btree ("user_id") WHERE "user_bans"."lifted_at" is null;