ALTER TABLE "questions" ADD COLUMN "key_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "key_confirmed_by" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "key_confirmed_answer_count" integer;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "key_confirmed_note" text;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_key_confirmed_by_user_id_fk" FOREIGN KEY ("key_confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;