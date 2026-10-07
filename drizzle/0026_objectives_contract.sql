ALTER TABLE "cmc_objectives" ALTER COLUMN "normalized_key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "cmc_objectives_normalized_key_key" ON "cmc_objectives" USING btree ("normalized_key") WHERE "cmc_objectives"."needs_fix" = false;
-- Les DROP de questions.objectif_cmc et training_sessions.objectif_cmc partent
-- dans une migration du déploiement suivant : la version en service pendant ce
-- build déclare encore ces colonnes, et Drizzle les nomme dans chaque INSERT
-- (valeur `default`).