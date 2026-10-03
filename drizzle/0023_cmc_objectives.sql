CREATE TABLE "cmc_objectives" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"needs_fix" boolean DEFAULT false NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cmc_objectives_label_key" ON "cmc_objectives" USING btree ("label");--> statement-breakpoint
DROP INDEX "questions_objectif_cmc_idx";--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "objectif_cmc" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "objective_id" text;--> statement-breakpoint
-- Une entrée par valeur distincte, après un nettoyage qui ne change pas le
-- sens (NFC, espaces de bord retirés, espaces internes réduits). Les règles de
-- `features/objectives/label.ts` marquent les valeurs invalides à corriger.
INSERT INTO "cmc_objectives" ("id", "label", "needs_fix")
SELECT gen_random_uuid()::text, v.label,
       char_length(v.label) < 3
         OR char_length(v.label) > 120
         OR v.label !~ '[[:alpha:]]'
         OR strpos(v.label, chr(9)) > 0
  FROM (
    SELECT DISTINCT regexp_replace(
             regexp_replace(normalize(q.objectif_cmc, NFC), '^\s+|\s+$', '', 'g'),
             ' {2,}', ' ', 'g') AS label
      FROM "questions" q
     WHERE q.objective_id IS NULL AND q.objectif_cmc IS NOT NULL
  ) v
ON CONFLICT ("label") DO NOTHING;--> statement-breakpoint
UPDATE "questions" q
   SET "objective_id" = o.id
  FROM "cmc_objectives" o
 WHERE q.objective_id IS NULL
   AND o.label = regexp_replace(
         regexp_replace(normalize(q.objectif_cmc, NFC), '^\s+|\s+$', '', 'g'),
         ' {2,}', ' ', 'g');--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "objective_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_objective_id_cmc_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."cmc_objectives"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_objective_id_idx" ON "questions" USING btree ("objective_id");
