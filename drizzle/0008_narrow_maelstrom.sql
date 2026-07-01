CREATE TYPE "public"."question_image_kind" AS ENUM('statement', 'explanation');--> statement-breakpoint
ALTER TABLE "question_images" ADD COLUMN "kind" "question_image_kind" DEFAULT 'statement' NOT NULL;--> statement-breakpoint
CREATE INDEX "question_images_question_kind_idx" ON "question_images" USING btree ("question_id","kind");--> statement-breakpoint
ALTER TABLE "question_explanations" DROP COLUMN "image_path";