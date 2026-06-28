CREATE TYPE "public"."training_mode" AS ENUM('tutor', 'test');--> statement-breakpoint
ALTER TABLE "exam_answers" ALTER COLUMN "selected_answer" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_answers" ALTER COLUMN "is_correct" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD COLUMN "mode" "training_mode" DEFAULT 'test' NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_participations" DROP COLUMN "pause_phase";--> statement-breakpoint
ALTER TABLE "exam_participations" DROP COLUMN "pause_ended_at";--> statement-breakpoint
ALTER TABLE "exam_participations" DROP COLUMN "is_pause_cut_short";