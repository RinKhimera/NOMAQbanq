CREATE TABLE "payment_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"stripe_event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_alerts_event_user_unique" UNIQUE("stripe_event_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "notify_payment_alerts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_alerts" ADD CONSTRAINT "payment_alerts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;