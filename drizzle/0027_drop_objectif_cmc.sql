-- Colonnes retirées du schéma Drizzle au déploiement précédent : plus aucune
-- version en service ne les nomme. IF EXISTS : develop les a déjà perdues.
ALTER TABLE "questions" DROP COLUMN IF EXISTS "objectif_cmc";--> statement-breakpoint
ALTER TABLE "training_sessions" DROP COLUMN IF EXISTS "objectif_cmc";
