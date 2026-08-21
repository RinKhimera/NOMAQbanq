-- Ajout en trois temps : Drizzle génère un `ADD COLUMN ... NOT NULL` sans défaut,
-- qui échoue sur une table déjà peuplée. Le backfill vient du `code` produit : le
-- catalogue Stripe porte, dans les DEUX modes, une `lookup_key` égale au code
-- (vérifié en test et en live le 2026-08-21). Le `::text` est nécessaire, `code`
-- étant de type enum `product_code`.
ALTER TABLE "products" ADD COLUMN "stripe_price_lookup_key" text;--> statement-breakpoint
UPDATE "products" SET "stripe_price_lookup_key" = "code"::text;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "stripe_price_lookup_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "presentment_amount" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "presentment_currency" text;
