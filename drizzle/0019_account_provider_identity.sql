-- better-auth 1.7.3 identifie de nouveau un compte par (provider_id, account_id)
-- et n'écrit plus `issuer` : la contrainte NOT NULL rejetterait toute
-- inscription et toute liaison Google. La colonne reste, nullable, pour qu'un
-- retour au code 1.7.2 (qui l'écrit encore) reste possible ; sa suppression est
-- une étape distincte. Le nouvel index unique reprend la garantie de l'ancien
-- sur la nouvelle identité — better-auth lève une erreur s'il trouve deux
-- lignes pour la même paire. Aucun doublon en production au moment de
-- l'écriture.
--
-- 1.7.2 retrouve un compte par `issuer` : ceux créés depuis ce déploiement
-- (issuer NULL) lui seraient invisibles. Après un Instant Rollback vers 1.7.2,
-- une fois la bascule faite (lancé avant, il laisse de côté les comptes créés
-- entre-temps ; idempotent, donc sans risque à relancer) :
-- UPDATE "account" SET "issuer" = CASE "provider_id"
--   WHEN 'credential' THEN 'local:credential'
--   WHEN 'google' THEN 'https://accounts.google.com' END
-- WHERE "issuer" IS NULL;
DROP INDEX "account_issuer_account_id_uidx";--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_id_account_id_uidx" ON "account" USING btree ("provider_id","account_id");