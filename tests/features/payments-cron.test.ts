import { beforeEach, describe, expect, it, vi } from "vitest"
import { auditProductPriceDrift } from "@/features/payments/cron"

// La verification au checkout ne voit que les produits qu'on achete. Cette tache
// couvre ceux qui dorment — un produit peu demande peut deriver des semaines.
const { mocks } = vi.hoisted(() => ({
  mocks: {
    captureServerError: vi.fn(),
    productRows: { current: [] as unknown[] },
    pricesList:
      vi.fn<
        () => Promise<{
          data: {
            id: string
            lookup_key: string | null
            unit_amount: number | null
            currency: string
          }[]
        }>
      >(),
    env: { STRIPE_SECRET_KEY: "sk_test_x" as string | undefined },
  },
}))

const selectChain = () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => mocks.productRows.current,
  }
  return chain
}

vi.mock("@/db", () => ({ db: { select: () => selectChain() } }))
vi.mock("@/db/schema", () => ({
  products: { code: {}, priceCad: {}, stripePriceLookupKey: {}, isActive: {} },
}))
vi.mock("@/lib/env/server", () => ({ env: mocks.env }))
vi.mock("@/lib/observability", () => ({
  captureServerError: mocks.captureServerError,
}))
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ prices: { list: mocks.pricesList } }),
}))

// Les cles sont celles de l'ALIAS du `select` Drizzle (`lookupKey`), pas les noms
// de colonnes : c'est ce que la vraie requete retourne.
const PRODUCT = {
  code: "exam_access",
  priceCad: 5000,
  lookupKey: "exam_access",
}

beforeEach(() => {
  mocks.env.STRIPE_SECRET_KEY = "sk_test_x"
  mocks.productRows.current = [PRODUCT]
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("auditProductPriceDrift", () => {
  it("prix conforme → aucune alerte", async () => {
    mocks.pricesList.mockResolvedValue({
      data: [
        {
          id: "price_1",
          lookup_key: "exam_access",
          unit_amount: 5000,
          currency: "cad",
        },
      ],
    })

    const res = await auditProductPriceDrift()

    expect(res).toEqual({ checked: 1, drifted: 0, failed: false })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("prix divergent → une alerte, le produit est compte comme derive", async () => {
    mocks.pricesList.mockResolvedValue({
      data: [
        {
          id: "price_1",
          lookup_key: "exam_access",
          unit_amount: 9900,
          currency: "cad",
        },
      ],
    })

    const res = await auditProductPriceDrift()

    expect(res).toEqual({ checked: 1, drifted: 1, failed: false })
    expect(mocks.captureServerError).toHaveBeenCalledTimes(1)
  })

  it("lookup_key sans prix actif → alerte dediee", async () => {
    mocks.pricesList.mockResolvedValue({ data: [] })

    const res = await auditProductPriceDrift()

    expect(res).toEqual({ checked: 1, drifted: 1, failed: false })
    expect(mocks.captureServerError).toHaveBeenCalledTimes(1)
  })

  // `lookup_keys` accepte 10 cles par requete : au-dela, une seule liste
  // tronquerait en silence et les produits surnumeraires passeraient pour
  // « sans prix actif ».
  it("plus de 10 produits → decoupage en plusieurs appels", async () => {
    mocks.productRows.current = Array.from({ length: 12 }, (_, i) => ({
      code: `p${i}`,
      priceCad: 5000,
      lookupKey: `key_${i}`,
    }))
    mocks.pricesList.mockImplementation(async () => ({
      data: mocks.productRows.current.map((r) => {
        const row = r as { lookupKey: string }
        return {
          id: `price_${row.lookupKey}`,
          lookup_key: row.lookupKey,
          unit_amount: 5000,
          currency: "cad",
        }
      }),
    }))

    const res = await auditProductPriceDrift()

    expect(mocks.pricesList).toHaveBeenCalledTimes(2)
    expect(res).toEqual({ checked: 12, drifted: 0, failed: false })
  })

  it("Stripe non configure → tache neutre, aucun appel", async () => {
    mocks.env.STRIPE_SECRET_KEY = undefined
    const res = await auditProductPriceDrift()
    expect(res).toEqual({ checked: 0, drifted: 0, failed: false })
    expect(mocks.pricesList).not.toHaveBeenCalled()
  })

  // Invariant capital : un audit informatif ne doit JAMAIS faire repondre 500 au
  // cron. L'appelant GitHub Actions relance sur erreur — une panne Stripe
  // rejouerait clotures et notifications jusqu'a 4 fois par heure.
  it("Stripe en panne → echec signale, aucune exception propagee", async () => {
    mocks.pricesList.mockRejectedValue(new Error("Stripe down"))

    const res = await auditProductPriceDrift()

    expect(res).toEqual({ checked: 0, drifted: 0, failed: true })
    expect(mocks.captureServerError).toHaveBeenCalled()
  })

  it("borne la requete Stripe (le SDK attend 80 s et reessaie 2 fois par defaut)", async () => {
    mocks.pricesList.mockResolvedValue({
      data: [
        {
          id: "price_1",
          lookup_key: "exam_access",
          unit_amount: 5000,
          currency: "cad",
        },
      ],
    })

    await auditProductPriceDrift()

    expect(mocks.pricesList).toHaveBeenCalledWith(expect.anything(), {
      timeout: 8000,
      maxNetworkRetries: 1,
    })
  })
})
