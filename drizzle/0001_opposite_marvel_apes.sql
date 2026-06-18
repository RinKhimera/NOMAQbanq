CREATE TYPE "public"."access_type" AS ENUM('exam', 'training');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('CAD', 'XAF');--> statement-breakpoint
CREATE TYPE "public"."exam_participation_status" AS ENUM('in_progress', 'completed', 'auto_submitted');--> statement-breakpoint
CREATE TYPE "public"."exam_pause_phase" AS ENUM('before_pause', 'during_pause', 'after_pause');--> statement-breakpoint
CREATE TYPE "public"."product_code" AS ENUM('exam_access', 'training_access', 'exam_access_promo', 'training_access_promo', 'premium_access');--> statement-breakpoint
CREATE TYPE "public"."training_status" AS ENUM('in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('stripe', 'manual');--> statement-breakpoint
CREATE TYPE "public"."upload_type" AS ENUM('avatar', 'question-image');--> statement-breakpoint
CREATE TABLE "exam_answers" (
	"id" text PRIMARY KEY NOT NULL,
	"participation_id" text NOT NULL,
	"question_id" text NOT NULL,
	"selected_answer" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_answers_participation_question_unique" UNIQUE("participation_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "exam_participations" (
	"id" text PRIMARY KEY NOT NULL,
	"exam_id" text NOT NULL,
	"user_id" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"status" "exam_participation_status" DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"pause_phase" "exam_pause_phase",
	"pause_started_at" timestamp with time zone,
	"pause_ended_at" timestamp with time zone,
	"is_pause_cut_short" boolean,
	"total_pause_duration_ms" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_participations_exam_user_unique" UNIQUE("exam_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "exam_questions" (
	"exam_id" text NOT NULL,
	"question_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "exam_questions_exam_id_question_id_pk" PRIMARY KEY("exam_id","question_id"),
	CONSTRAINT "exam_questions_exam_position_unique" UNIQUE("exam_id","position")
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"completion_time" integer NOT NULL,
	"enable_pause" boolean DEFAULT false NOT NULL,
	"pause_duration_minutes" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_explanations" (
	"question_id" text PRIMARY KEY NOT NULL,
	"explanation" text NOT NULL,
	"references" jsonb
);
--> statement-breakpoint
CREATE TABLE "question_images" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"url" text NOT NULL,
	"storage_path" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"correct_answer" text NOT NULL,
	"options" jsonb NOT NULL,
	"objectif_cmc" text NOT NULL,
	"domain" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_session_items" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"question_id" text NOT NULL,
	"position" integer NOT NULL,
	"selected_answer" text,
	"is_correct" boolean,
	"answered_at" timestamp with time zone,
	CONSTRAINT "training_session_items_session_question_unique" UNIQUE("session_id","question_id"),
	CONSTRAINT "training_session_items_session_position_unique" UNIQUE("session_id","position")
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" "training_status" NOT NULL,
	"domain" text,
	"objectif_cmc" text,
	"question_count" integer NOT NULL,
	"score" integer,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"code" "product_code" NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price_cad" integer NOT NULL,
	"duration_days" integer NOT NULL,
	"access_type" "access_type" NOT NULL,
	"stripe_product_id" text NOT NULL,
	"stripe_price_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_combo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_id" text NOT NULL,
	"type" "transaction_type" NOT NULL,
	"status" "transaction_status" NOT NULL,
	"amount_paid" integer NOT NULL,
	"currency" "currency" NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"stripe_event_id" text,
	"payment_method" text,
	"recorded_by" text,
	"notes" text,
	"access_type" "access_type" NOT NULL,
	"duration_days" integer NOT NULL,
	"access_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_access" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"access_type" "access_type" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_transaction_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_access_user_access_type_unique" UNIQUE("user_id","access_type")
);
--> statement-breakpoint
CREATE TABLE "upload_rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"upload_type" "upload_type" NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	CONSTRAINT "upload_rate_limits_user_type_unique" UNIQUE("user_id","upload_type")
);
--> statement-breakpoint
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_participation_id_exam_participations_id_fk" FOREIGN KEY ("participation_id") REFERENCES "public"."exam_participations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_participations" ADD CONSTRAINT "exam_participations_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_participations" ADD CONSTRAINT "exam_participations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_explanations" ADD CONSTRAINT "question_explanations_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_images" ADD CONSTRAINT "question_images_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_items" ADD CONSTRAINT "training_session_items_session_id_training_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_items" ADD CONSTRAINT "training_session_items_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access" ADD CONSTRAINT "user_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access" ADD CONSTRAINT "user_access_last_transaction_id_transactions_id_fk" FOREIGN KEY ("last_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_rate_limits" ADD CONSTRAINT "upload_rate_limits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_answers_participation_id_idx" ON "exam_answers" USING btree ("participation_id");--> statement-breakpoint
CREATE INDEX "exam_answers_question_id_idx" ON "exam_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "exam_participations_exam_id_idx" ON "exam_participations" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "exam_participations_user_id_idx" ON "exam_participations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "exam_participations_status_idx" ON "exam_participations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "exam_questions_question_id_idx" ON "exam_questions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "exams_is_active_idx" ON "exams" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "exams_start_date_idx" ON "exams" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "exams_end_date_idx" ON "exams" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "exams_is_active_start_date_idx" ON "exams" USING btree ("is_active","start_date");--> statement-breakpoint
CREATE INDEX "exams_created_by_idx" ON "exams" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "question_images_question_id_idx" ON "question_images" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "questions_domain_idx" ON "questions" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "questions_objectif_cmc_idx" ON "questions" USING btree ("objectif_cmc");--> statement-breakpoint
CREATE INDEX "training_session_items_session_id_idx" ON "training_session_items" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "training_session_items_question_id_idx" ON "training_session_items" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "training_sessions_user_status_idx" ON "training_sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "training_sessions_user_started_at_idx" ON "training_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "training_sessions_status_idx" ON "training_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "training_sessions_status_expires_at_idx" ON "training_sessions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "products_code_idx" ON "products" USING btree ("code");--> statement-breakpoint
CREATE INDEX "products_stripe_product_id_idx" ON "products" USING btree ("stripe_product_id");--> statement-breakpoint
CREATE INDEX "products_is_active_idx" ON "products" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_stripe_event_id_unique" ON "transactions" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "transactions_user_id_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_stripe_session_id_idx" ON "transactions" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE INDEX "transactions_status_idx" ON "transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transactions_type_idx" ON "transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "transactions_user_access_type_idx" ON "transactions" USING btree ("user_id","access_type");--> statement-breakpoint
CREATE INDEX "transactions_created_at_idx" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transactions_status_created_at_idx" ON "transactions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "user_access_user_id_idx" ON "user_access" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_access_expires_at_idx" ON "user_access" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "upload_rate_limits_user_id_idx" ON "upload_rate_limits" USING btree ("user_id");