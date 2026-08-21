import "server-only"
import type Stripe from "stripe"

type PriceShape = Pick<Stripe.Price, "id" | "unit_amount" | "currency">

/**
 * Requête bornée. Le SDK Stripe attend 80 s par défaut et réessaie 2 fois : un
 * appel qui pend peut donc durer ~4 min. Inacceptable sur le chemin du checkout,
 * où l'utilisateur attend, comme dans le cron, dont l'appelant coupe à
 * `--max-time 60` puis relance — soit jusqu'à 4 exécutions complètes par heure.
 */
const PRICE_REQUEST_OPTIONS = { timeout: 8000, maxNetworkRetries: 1 }

/**
 * Résout le prix Stripe d'un produit par sa `lookup_key`. Contrairement à un
 * `price_…`, une `lookup_key` est identique en test et en live : c'est ce qui
 * rend impossible l'usage d'un identifiant du mauvais mode.
 *
 * `onAmbiguous` est appelé si PLUSIEURS prix actifs portent la clé — cas que
 * Stripe n'est pas censé produire, et qu'on refuse de trancher au hasard en
 * silence. Le premier prix est renvoyé quand même : alerter ne doit pas couper
 * la vente.
 *
 * `null` = aucun prix actif ne porte cette clé dans le mode de la clé API.
 */
export const resolveStripePrice = async (
  stripe: Stripe,
  lookupKey: string,
  onAmbiguous?: (lookupKey: string, count: number) => void,
): Promise<Stripe.Price | null> => {
  const { data } = await stripe.prices.list(
    { lookup_keys: [lookupKey], active: true, limit: 2 },
    PRICE_REQUEST_OPTIONS,
  )
  if (data.length > 1) onAmbiguous?.(lookupKey, data.length)
  return data[0] ?? null
}

export type PriceDrift = {
  /**
   * La devise du prix Stripe n'est pas le CAD. Traité à part du montant : la
   * devise d'un prix Stripe est IMMUABLE (on ne modifie pas un prix, on en crée
   * un autre), donc elle ne peut pas avoir « changé » légitimement — c'est une
   * erreur de configuration, pas un état transitoire. Un montant, lui, diverge
   * normalement le temps qu'un `transfer_lookup_key` soit répercuté en base.
   */
  currencyMismatch: boolean
  message: string
}

/**
 * Écart entre le prix AFFICHÉ (`products.priceCad`, en cents, lu par la grille
 * tarifaire et les paywalls) et le prix que Stripe FACTURERA. Les deux vivent
 * dans des systèmes différents ; sans cette comparaison, une modification de
 * tarif au dashboard non répercutée en base passe inaperçue.
 *
 * `null` = ils concordent.
 */
export const describePriceDrift = (
  priceCad: number,
  price: PriceShape,
): PriceDrift | null => {
  const currencyMismatch = price.currency !== "cad"
  const parts: string[] = []
  if (currencyMismatch) parts.push(`devise Stripe ${price.currency} ≠ cad`)
  if (price.unit_amount !== priceCad) {
    parts.push(
      `montant Stripe ${price.unit_amount ?? "null"} ≠ base ${priceCad}`,
    )
  }
  return parts.length > 0
    ? { currencyMismatch, message: `${price.id} : ${parts.join(" · ")}` }
    : null
}
