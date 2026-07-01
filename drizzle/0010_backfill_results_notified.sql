-- Custom SQL migration file, put your code below! --

-- Backfill anti-blast : marque comme « déjà notifié » toutes les participations des
-- examens DÉJÀ CLOS au moment du déploiement. Sans ça, le cron de notifications
-- (colonne `results_notified_at` ajoutée en 0009) enverrait un email « résultats
-- disponibles » pour TOUT le backlog historique au premier run (l'app est en prod
-- avec des mois de données). Les examens qui clôturent APRÈS ce déploiement gardent
-- `results_notified_at = NULL` et sont notifiés normalement.
UPDATE "exam_participations"
SET "results_notified_at" = now()
FROM "exams"
WHERE "exam_participations"."exam_id" = "exams"."id"
  AND "exams"."end_date" < now()
  AND "exam_participations"."results_notified_at" IS NULL;
