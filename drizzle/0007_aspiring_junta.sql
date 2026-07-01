CREATE TYPE "public"."exam_audience_type" AS ENUM('subscribers', 'restricted');--> statement-breakpoint
CREATE TABLE "exam_audience" (
	"exam_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_audience_exam_id_user_id_pk" PRIMARY KEY("exam_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "audience_type" "exam_audience_type" DEFAULT 'subscribers' NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_audience" ADD CONSTRAINT "exam_audience_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_audience" ADD CONSTRAINT "exam_audience_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_audience_user_id_idx" ON "exam_audience" USING btree ("user_id");