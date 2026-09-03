-- Ajout en trois temps (cf. 0013) : Drizzle génère un `ADD COLUMN ... NOT NULL`
-- sans défaut, qui échoue sur une table peuplée. Les valeurs sont celles que
-- better-auth 1.7.2 écrit lui-même : `local:credential` pour le mot de passe
-- (createLocalAccountIssuer) et l'issuer OIDC de Google, déclaré en dur par le
-- fournisseur (`accountIssuer`). Tout autre provider_id est inattendu et fait
-- échouer la migration (SET NOT NULL sur une ligne restée NULL) plutôt que de
-- recevoir une valeur devinée. tests/db/account-issuer-migration.test.ts
-- confronte ces constantes à la bibliothèque installée.
--
-- La connexion par mot de passe en 1.7 ne retrouve une ligne credential que si
-- `account_id = user_id` (sign-in, updatePassword, findCredentialAccount) : une
-- ligne dérogeante serait remplie sans erreur puis inconnectable en silence,
-- d'où le contrôle explicite avant le remplissage.
--
-- Aller simple : un retour au code 1.6.25 (Instant Rollback Vercel, qui ne
-- rejoue aucune migration) insère dans `account` sans `issuer` et casse
-- inscriptions et liaisons Google tant que la contrainte tient. Avant un tel
-- retour : ALTER TABLE "account" ALTER COLUMN "issuer" DROP NOT NULL;
ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "account" WHERE "provider_id" = 'credential' AND "account_id" <> "user_id") THEN
    RAISE EXCEPTION 'account credential avec account_id <> user_id : better-auth 1.7 ne retrouverait pas ces lignes a la connexion';
  END IF;
END $$;--> statement-breakpoint
UPDATE "account" SET "issuer" = 'local:credential' WHERE "provider_id" = 'credential';--> statement-breakpoint
UPDATE "account" SET "issuer" = 'https://accounts.google.com' WHERE "provider_id" = 'google';--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_account_id_uidx" ON "account" USING btree ("issuer","account_id");
