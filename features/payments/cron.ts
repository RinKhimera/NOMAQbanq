import { eq } from "drizzle-orm"
import "server-only"
import type Stripe from "stripe"
import { db } from "@/db"
import { products } from "@/db/schema"
import { env } from "@/lib/env/server"
import { captureServerError } from "@/lib/observability"
import { getStripe } from "@/lib/stripe"
import { describePriceDrift } from "./catalog"

export type PriceDriftResult = {
  checked: number
  drifted: number
  failed: boolean
}

// Borne de l'API Stripe : `prices.list` accepte au plus 10 `lookup_keys` par
// requête. Au-delà, la liste serait tronquée en silence et les produits
// surnuméraires passeraient pour « sans prix actif ».
const LOOKUP_KEYS_PER_CALL = 10

/**
 * Compare le prix AFFICHÉ (`products.priceCad`) au prix que Stripe FACTURERAIT,
 * pour tous les produits actifs. Le contrôle équivalent au checkout ne couvre
 * que les produits qu'on achète : un produit peu demandé peut dériver des
 * semaines sans que personne ne l'apprenne.
 *
 * Lecture seule : aucune écriture en base, aucune écriture chez Stripe.
 *
 * **Ne lève JAMAIS.** Une panne Stripe ferait répondre 500 au dispatcher, or
 * l'appelant GitHub Actions relance sur erreur (`--retry 3 --retry-all-errors`) :
 * un audit informatif provoquerait jusqu'à 4 exécutions complètes du cron par
 * heure, clôtures et notifications comprises. L'échec se signale par `failed`
 * et par Sentry, pas par une exception.
 */
export async function auditProductPriceDrift(): Promise<PriceDriftResult> {
  if (!env.STRIPE_SECRET_KEY) return { checked: 0, drifted: 0, failed: false }

  const rows = await db
    .select({
      code: products.code,
      priceCad: products.priceCad,
      lookupKey: products.stripePriceLookupKey,
    })
    .from(products)
    .where(eq(products.isActive, true))
    .limit(50)
  if (rows.length === 0) return { checked: 0, drifted: 0, failed: false }

  const byLookupKey = new Map<string, Stripe.Price>()
  try {
    const stripe = getStripe()
    for (let i = 0; i < rows.length; i += LOOKUP_KEYS_PER_CALL) {
      const { data } = await stripe.prices.list(
        {
          lookup_keys: rows
            .slice(i, i + LOOKUP_KEYS_PER_CALL)
            .map((r) => r.lookupKey),
          active: true,
          limit: LOOKUP_KEYS_PER_CALL,
        },
        // Mêmes bornes qu'au checkout : le SDK attend 80 s et réessaie 2 fois par
        // défaut, contre un `--max-time 60` côté appelant.
        { timeout: 8000, maxNetworkRetries: 1 },
      )
      for (const price of data) {
        if (price.lookup_key) byLookupKey.set(price.lookup_key, price)
      }
    }
  } catch (error) {
    captureServerError("[cron:price-drift]", error, {
      detail: `lecture des prix Stripe impossible (${rows.length} produits non audités)`,
    })
    return { checked: 0, drifted: 0, failed: true }
  }

  let drifted = 0
  for (const row of rows) {
    const price = byLookupKey.get(row.lookupKey)
    if (!price) {
      drifted++
      captureServerError(
        "[cron:price-drift]",
        new Error("aucun prix actif pour cette lookup_key"),
        { detail: `produit ${row.code} · lookup_key ${row.lookupKey}` },
      )
      continue
    }
    const drift = describePriceDrift(row.priceCad, price)
    if (drift) {
      drifted++
      captureServerError(
        "[cron:price-drift]",
        new Error(
          drift.currencyMismatch
            ? "devise du prix Stripe inattendue"
            : "prix affiché divergent du prix Stripe",
        ),
        { detail: `produit ${row.code} · ${drift.message}` },
      )
    }
  }

  return { checked: rows.length, drifted, failed: false }
}
