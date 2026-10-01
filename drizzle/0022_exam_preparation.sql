ALTER TABLE "exams" ALTER COLUMN "start_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "exams" ALTER COLUMN "end_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "exams" ALTER COLUMN "completion_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "finalized_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
UPDATE "exams" SET "finalized_at" = "created_at";--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "target_question_count" integer;--> statement-breakpoint
UPDATE "exams" SET "target_question_count" = (SELECT count(*) FROM "exam_questions" WHERE "exam_questions"."exam_id" = "exams"."id");--> statement-breakpoint
ALTER TABLE "exams" ALTER COLUMN "target_question_count" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_finalized_complete" CHECK ("exams"."finalized_at" is null or ("exams"."start_date" is not null and "exams"."end_date" is not null and "exams"."completion_time" is not null));
