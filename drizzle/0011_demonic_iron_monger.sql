CREATE TABLE "quiz_rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"action" text NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	CONSTRAINT "quiz_rate_limits_key_action_unique" UNIQUE("key","action")
);
