ALTER TABLE "transactions" ADD COLUMN "stripe_dispute_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "dispute_status" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "confirmation_email_message_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "confirmation_email_sent_at" timestamp with time zone;