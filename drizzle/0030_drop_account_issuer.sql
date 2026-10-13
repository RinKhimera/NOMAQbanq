-- Colonne retirée du schéma Drizzle au déploiement précédent : plus aucune
-- version en service ne la nomme. L'unicité d'un compte reste portée par
-- l'index (provider_id, account_id) de 0019.
--
-- La consigne de remplissage de 0019 après un retour vers better-auth 1.7.2 est
-- caduque : ce retour exigerait désormais de recréer la colonne et de la
-- remplir avant la bascule.
ALTER TABLE "account" DROP COLUMN "issuer";
