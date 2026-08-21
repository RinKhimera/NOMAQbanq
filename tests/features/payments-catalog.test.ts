import { describe, expect, it, vi } from "vitest"
import {
  describePriceDrift,
  resolveStripePrice,
} from "@/features/payments/catalog"

// `describePriceDrift` est pur : c'est lui qui decide si le prix affiche en base
// et le prix que Stripe facturera racontent la meme chose. Chaque cas est ecrit
// par paire — une version qui concorde, une version qui diverge — sinon rien ne
// prouve que la comparaison mord reellement.
const PRICE = {
  id: "price_1",
  unit_amount: 5000,
  currency: "cad",
} as const

describe("describePriceDrift", () => {
  it("montant et devise concordants → aucune derive", () => {
    expect(describePriceDrift(5000, PRICE)).toBeNull()
  })

  // Un montant diverge legalement : `transfer_lookup_key` deplace la cle sur un
  // nouveau prix quand le tarif change. On alerte, on ne bloque pas.
  it("montant divergent → derive NON bloquante, decrite avec les deux valeurs", () => {
    const drift = describePriceDrift(3000, PRICE)
    expect(drift?.currencyMismatch).toBe(false)
    expect(drift?.message).toContain("5000")
    expect(drift?.message).toContain("3000")
  })

  // La devise d'un prix Stripe est immuable : elle ne peut pas avoir « change ».
  // Une devise ≠ cad signifie que la cle pointe sur le mauvais prix.
  it("devise du prix Stripe ≠ cad → derive bloquante", () => {
    const drift = describePriceDrift(5000, { ...PRICE, currency: "usd" })
    expect(drift?.currencyMismatch).toBe(true)
    expect(drift?.message).toContain("usd")
  })

  it("unit_amount null (prix a montant libre) → derive non bloquante", () => {
    const drift = describePriceDrift(5000, { ...PRICE, unit_amount: null })
    expect(drift).not.toBeNull()
    expect(drift?.currencyMismatch).toBe(false)
  })
})

describe("resolveStripePrice", () => {
  it("interroge Stripe sur la cle, en prix actifs seulement, requete bornee", async () => {
    const list = vi.fn(async () => ({ data: [PRICE] }))
    const stripe = { prices: { list } } as never

    const price = await resolveStripePrice(stripe, "exam_access")

    expect(price).toEqual(PRICE)
    expect(list).toHaveBeenCalledWith(
      { lookup_keys: ["exam_access"], active: true, limit: 2 },
      { timeout: 8000, maxNetworkRetries: 1 },
    )
  })

  it("aucun prix actif pour la cle → null (et non une exception)", async () => {
    const stripe = { prices: { list: async () => ({ data: [] }) } } as never
    expect(await resolveStripePrice(stripe, "inconnu")).toBeNull()
  })

  // `limit: 2` n'a d'interet que si quelqu'un lit le second element : sans ca,
  // une cle portee par deux prix actifs se reglerait au hasard, en silence.
  it("deux prix actifs pour la meme cle → anomalie signalee", async () => {
    const onAmbiguous = vi.fn()
    const stripe = {
      prices: {
        list: async () => ({ data: [PRICE, { ...PRICE, id: "price_2" }] }),
      },
    } as never

    const price = await resolveStripePrice(stripe, "exam_access", onAmbiguous)

    expect(price).toEqual(PRICE)
    expect(onAmbiguous).toHaveBeenCalledWith("exam_access", 2)
  })
})
