-- Custom SQL migration file, put your code below! --

-- Une seule graphie par domaine médical : « Gastroentérologie » rejoint
-- « Gastro-entérologie », dans la banque ET dans l'historique d'entraînement
-- (sinon une session passée pointerait vers un domaine qui n'existe plus).
UPDATE "questions"
SET "domain" = 'Gastro-entérologie'
WHERE "domain" = 'Gastroentérologie';--> statement-breakpoint
UPDATE "training_sessions"
SET "domain" = 'Gastro-entérologie'
WHERE "domain" = 'Gastroentérologie';
