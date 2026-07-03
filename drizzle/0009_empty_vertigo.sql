ALTER TABLE "user" ADD COLUMN "notify_exam_results" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "notify_access_expiry" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_participations" ADD COLUMN "results_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_access" ADD COLUMN "expiry_reminder_sent_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "exam_participations_results_pending_idx" ON "exam_participations" USING btree ("exam_id") WHERE "exam_participations"."status" in ('completed', 'auto_submitted') and "exam_participations"."results_notified_at" is null;--> statement-breakpoint
CREATE INDEX "user_access_expiry_reminder_pending_idx" ON "user_access" USING btree ("expires_at") WHERE "user_access"."expiry_reminder_sent_at" is null;