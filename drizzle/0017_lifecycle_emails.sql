ALTER TABLE "user" ADD COLUMN "notify_marketing" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "welcome_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "inactivity_reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "cart_reminder_sent_at" timestamp with time zone;--> statement-breakpoint
-- Backfill anti-blast : la mesure d'inactivité démarre au déploiement. Sans ça,
-- `last_login_at` NULL sur tout le parc rendrait la garde de connexion inerte
-- pendant 21 jours et un étudiant connecté la veille puis déconnecté recevrait
-- la relance (marqueur jamais réinitialisé : tir gâché). Poser « vu maintenant »
-- sur tous les comptes existants garde la relance pour ceux qui décrochent
-- APRÈS le déploiement.
UPDATE "user" SET "last_login_at" = now() WHERE "last_login_at" IS NULL;
