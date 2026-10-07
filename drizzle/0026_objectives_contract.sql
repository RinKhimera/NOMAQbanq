ALTER TABLE "cmc_objectives" ALTER COLUMN "normalized_key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "cmc_objectives_normalized_key_key" ON "cmc_objectives" USING btree ("normalized_key") WHERE "cmc_objectives"."needs_fix" = false;--> statement-breakpoint
ALTER TABLE "questions" DROP COLUMN "objectif_cmc";--> statement-breakpoint
ALTER TABLE "training_sessions" DROP COLUMN "objectif_cmc";