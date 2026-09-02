import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createCustomerPortal,
  createStripeCheckout,
  deleteManualTransaction,
  loadAdminTransactions,
  loadMoreMyTransactions,
  loadTransactionAccessImpact,
  loadTransactionStats,
  loadUserAccessStatus,
  recordManualPayment,
  updateManualTransaction,
} from "@/features/payments/actions"

// Ce fichier couvre ce qui appartient en propre a `actions.ts` : gardes, validation
// zod, mapping des erreurs metier vers un message, revalidation, et la reecriture
// anti-open-redirect des URLs Stripe. La semantique SQL (octroi/revocation d'acces)
// est verifiee sur une vraie base dans tests/integration/payments-actions.test.ts —
// ici `db.transaction` est simule au niveau du resultat, jamais de son callback.
const { mocks } = vi.hoisted(() => ({
  mocks: {
    captureServerError: vi.fn(),
    revalidatePath: vi.fn(),
    transaction: vi.fn<(cb: unknown) => Promise<unknown>>(async () => "tx_1"),
    productRows: { current: [] as unknown[] },
    insertValues: vi.fn(async () => undefined),
    checkoutCreate:
      vi.fn<
        (arg: {
          success_url: string
          cancel_url: string
        }) => Promise<{ id: string; url: string | null }>
      >(),
    pricesList: vi.fn<
      () => Promise<{
        data: { id: string; unit_amount: number | null; currency: string }[]
      }>
    >(),
    customersList: vi.fn<() => Promise<{ data: { id: string }[] }>>(),
    portalCreate:
      vi.fn<(arg: { return_url: string }) => Promise<{ url: string }>>(),
    requireSession: vi.fn(async () => ({
      user: { id: "u1", email: "u1@test.invalid" },
    })),
    requireRole: vi.fn(async () => ({ user: { id: "admin1", role: "admin" } })),
    getMyTransactions: vi.fn(async () => ({ items: [], nextCursor: null })),
    getAllTransactions: vi.fn(async () => ({ items: [], nextCursor: null })),
    getTransactionStats: vi.fn(async () => ({ totalTransactions: 0 })),
    getTransactionAccessImpact: vi.fn<() => Promise<unknown>>(async () => null),
    getAccessStatus: vi.fn<() => Promise<unknown>>(async () => null),
  },
}))

const selectChain = () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => mocks.productRows.current,
  }
  return chain
}

vi.mock("@/db", () => ({
  db: {
    transaction: mocks.transaction,
    select: () => selectChain(),
    insert: () => ({ values: mocks.insertValues }),
  },
}))
vi.mock("@/db/schema", () => {
  const codes = [
    "exam_access",
    "training_access",
    "exam_access_promo",
    "training_access_promo",
    "premium_access",
  ] as const
  return {
    products: { id: {}, code: { enumValues: codes } },
    transactions: { id: {} },
    user: { id: {} },
    productCode: { enumValues: codes },
    currency: { enumValues: ["CAD", "XAF"] },
  }
})
vi.mock("@/features/payments/dal", () => ({
  getAccessStatus: mocks.getAccessStatus,
  getAllTransactions: mocks.getAllTransactions,
  getMyTransactions: mocks.getMyTransactions,
  getTransactionAccessImpact: mocks.getTransactionAccessImpact,
  getTransactionStats: mocks.getTransactionStats,
}))
vi.mock("@/features/payments/lib", () => ({
  grantManualAccess: vi.fn(),
  recomputeAccess: vi.fn(),
}))
vi.mock("@/lib/auth-guards", () => ({
  requireSession: mocks.requireSession,
  requireRole: mocks.requireRole,
}))
vi.mock("@/lib/base-url", () => ({ getBaseUrl: () => "https://app.test" }))
vi.mock("@/lib/observability", () => ({
  captureServerError: mocks.captureServerError,
}))
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: { sessions: { create: mocks.checkoutCreate } },
    customers: { list: mocks.customersList },
    billingPortal: { sessions: { create: mocks.portalCreate } },
    prices: { list: mocks.pricesList },
  }),
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

const ACTIVE_PRODUCT = {
  id: "p1",
  stripePriceId: "price_1",
  stripePriceLookupKey: "exam_access",
  name: "Accès examens",
  priceCad: 5000,
  accessType: "exam",
  durationDays: 90,
  isCombo: false,
  isActive: true,
}

const manualInput = {
  userId: "u1",
  productCode: "exam_access" as const,
  amountPaid: 5000,
  currency: "CAD" as const,
  paymentMethod: "Virement",
}

const updateInput = {
  transactionId: "t1",
  amountPaid: 5000,
  currency: "CAD" as const,
  paymentMethod: "Virement",
}

const rejectWith = (message: string) =>
  mocks.transaction.mockRejectedValueOnce(new Error(message))

beforeEach(() => {
  mocks.productRows.current = [ACTIVE_PRODUCT]
  mocks.pricesList.mockResolvedValue({
    data: [{ id: "price_resolved", unit_amount: 5000, currency: "cad" }],
  })
})

describe("recordManualPayment", () => {
  it("valide l'entree avant d'ouvrir la transaction", async () => {
    const res = await recordManualPayment({
      ...manualInput,
      paymentMethod: "   ",
    })
    expect(res).toEqual({
      success: false,
      error: "Méthode de paiement requise",
    })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("succes : renvoie l'id et revalide les deux pages admin", async () => {
    mocks.transaction.mockResolvedValueOnce("tx_abc")
    const res = await recordManualPayment(manualInput)
    expect(res).toEqual({ success: true, transactionId: "tx_abc" })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/transactions")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/utilisateurs")
  })

  it.each([
    ["PRODUCT_NOT_FOUND", "Produit introuvable"],
    ["USER_NOT_FOUND", "Utilisateur introuvable"],
  ])("%s → %s, sans capture Sentry", async (thrown, expected) => {
    rejectWith(thrown)
    const res = await recordManualPayment(manualInput)
    expect(res).toEqual({ success: false, error: expected })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("erreur inattendue → message generique + capture avec l'admin", async () => {
    rejectWith("connection terminated")
    const res = await recordManualPayment(manualInput)
    expect(res).toEqual({ success: false, error: "Erreur serveur. Réessayez." })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[recordManualPayment]",
      expect.any(Error),
      { userId: "admin1" },
    )
  })
})

describe("updateManualTransaction", () => {
  it("refuse un statut hors enum (zod) sans ouvrir la transaction", async () => {
    const res = await updateManualTransaction({
      ...updateInput,
      status: "pending" as never,
    })
    expect(res.success).toBe(false)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("succes : revalide les pages admin", async () => {
    const res = await updateManualTransaction({
      ...updateInput,
      status: "refunded",
    })
    expect(res).toEqual({ success: true })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/transactions")
  })

  it.each([
    ["TX_NOT_FOUND", "Transaction introuvable"],
    [
      "TX_NOT_MANUAL",
      "Seules les transactions manuelles peuvent être modifiées",
    ],
  ])("%s → %s, sans capture", async (thrown, expected) => {
    rejectWith(thrown)
    const res = await updateManualTransaction(updateInput)
    expect(res).toEqual({ success: false, error: expected })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("erreur inattendue → capture sans userId", async () => {
    rejectWith("deadlock detected")
    const res = await updateManualTransaction(updateInput)
    expect(res).toEqual({ success: false, error: "Erreur serveur. Réessayez." })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[updateManualTransaction]",
      expect.any(Error),
    )
  })
})

describe("deleteManualTransaction", () => {
  it("id vide → refus avant toute transaction", async () => {
    const res = await deleteManualTransaction("")
    expect(res).toEqual({ success: false, error: "Transaction requise" })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("succes : propage accessRevoked au client", async () => {
    mocks.transaction.mockResolvedValueOnce(true)
    const res = await deleteManualTransaction("t1")
    expect(res).toEqual({ success: true, accessRevoked: true })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/utilisateurs")
  })

  it.each([
    ["TX_NOT_FOUND", "Transaction introuvable"],
    [
      "TX_NOT_MANUAL",
      "Seules les transactions manuelles peuvent être supprimées",
    ],
  ])("%s → %s, sans capture", async (thrown, expected) => {
    rejectWith(thrown)
    const res = await deleteManualTransaction("t1")
    expect(res).toEqual({ success: false, error: expected })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("erreur inattendue → capture", async () => {
    rejectWith("update or delete violates foreign key")
    const res = await deleteManualTransaction("t1")
    expect(res).toEqual({ success: false, error: "Erreur serveur. Réessayez." })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[deleteManualTransaction]",
      expect.any(Error),
    )
  })
})

describe("createStripeCheckout", () => {
  const input = {
    productCode: "exam_access",
    successPath: "/tableau-de-bord",
    cancelPath: "/tarifs",
  }

  it("reçu garanti, CGU obligatoires et 3DS demandé sur chaque session", async () => {
    mocks.checkoutCreate.mockResolvedValueOnce({
      id: "cs_1",
      url: "https://stripe.test/pay",
    })
    await createStripeCheckout(input)

    expect(mocks.checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        // `receipt_email` posé sur le PaymentIntent : Stripe envoie alors un
        // reçu en live quel que soit le réglage « Paiements réussis ».
        payment_intent_data: {
          receipt_email: "u1@test.invalid",
          description: "Accès examens",
        },
        consent_collection: { terms_of_service: "required" },
        payment_method_options: {
          card: { request_three_d_secure: "any" },
        },
      }),
    )
  })

  // Sans URL de CGU dans le compte, Stripe refuse la session : « Réessayez »
  // enverrait chercher une panne réseau alors que c'est une configuration.
  it("URL des CGU absente du compte Stripe → message de configuration + alerte nommée", async () => {
    mocks.checkoutCreate.mockRejectedValueOnce(
      Object.assign(new Error("terms of service URL missing"), {
        type: "StripeInvalidRequestError",
        param: "consent_collection[terms_of_service]",
      }),
    )
    const res = await createStripeCheckout(input)

    expect(res).toEqual({
      error: "Ce produit est mal configuré. Contactez le support.",
    })
    expect(mocks.insertValues).not.toHaveBeenCalled()
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[createStripeCheckout]",
      expect.any(Error),
      expect.objectContaining({
        userId: "u1",
        detail: expect.stringContaining("URL des CGU"),
      }),
    )
  })

  // Une erreur de configuration de compte peut arriver sans `param` : le
  // message doit suffire à la reconnaître.
  it("erreur CGU sans param (message seul) → même traitement", async () => {
    mocks.checkoutCreate.mockRejectedValueOnce(
      Object.assign(
        new Error(
          "There must be a valid terms of service URL set in your Dashboard settings.",
        ),
        { type: "StripeInvalidRequestError", param: null },
      ),
    )
    const res = await createStripeCheckout(input)

    expect(res).toEqual({
      error: "Ce produit est mal configuré. Contactez le support.",
    })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[createStripeCheckout]",
      expect.any(Error),
      expect.objectContaining({
        detail: expect.stringContaining("URL des CGU"),
      }),
    )
  })

  it("produit absent de la base → refus avant Stripe", async () => {
    mocks.productRows.current = []
    const res = await createStripeCheckout(input)
    expect(res).toEqual({ error: "Produit introuvable" })
    expect(mocks.checkoutCreate).not.toHaveBeenCalled()
  })

  it("produit desactive → refus avant Stripe", async () => {
    mocks.productRows.current = [{ ...ACTIVE_PRODUCT, isActive: false }]
    const res = await createStripeCheckout(input)
    expect(res).toEqual({ error: "Ce produit n'est plus disponible" })
    expect(mocks.checkoutCreate).not.toHaveBeenCalled()
  })

  it("facture le prix resolu par lookup_key, pas un identifiant stocke", async () => {
    mocks.checkoutCreate.mockResolvedValueOnce({
      id: "cs_1",
      url: "https://stripe.test/pay",
    })
    await createStripeCheckout(input)

    expect(mocks.pricesList).toHaveBeenCalledWith(
      { lookup_keys: ["exam_access"], active: true, limit: 2 },
      { timeout: 8000, maxNetworkRetries: 1 },
    )
    const arg = mocks.checkoutCreate.mock.calls[0]![0] as unknown as {
      line_items: { price: string }[]
    }
    expect(arg.line_items[0].price).toBe("price_resolved")
  })

  // Phase 1 : la lookup_key n'est pas encore eprouvee en production, le pointeur
  // historique l'est. Une cle qui ne resout rien alerte mais ne coupe pas la vente.
  it("lookup_key sans prix actif → repli sur stripe_price_id, vente conservee", async () => {
    mocks.pricesList.mockResolvedValue({ data: [] })
    mocks.checkoutCreate.mockResolvedValueOnce({
      id: "cs_1",
      url: "https://stripe.test/pay",
    })

    const res = await createStripeCheckout(input)

    expect(res).toEqual({ checkoutUrl: "https://stripe.test/pay" })
    const arg = mocks.checkoutCreate.mock.calls[0]![0] as unknown as {
      line_items: { price: string }[]
    }
    expect(arg.line_items[0].price).toBe("price_1")
    expect(mocks.captureServerError).toHaveBeenCalled()
  })

  // Le repli doit couvrir l'ECHEC de l'appel autant que la cle absente : sans ca,
  // une cle restreinte sans `prices:read` (ou un 429) renverrait « Reessayez »
  // pour une panne permanente, au lieu de vendre via le pointeur historique.
  it("resolution en echec (permission, 429) → repli sur stripe_price_id, vente conservee", async () => {
    mocks.pricesList.mockRejectedValue(
      Object.assign(new Error("permission denied"), {
        code: "more_permissions_required",
      }),
    )
    mocks.checkoutCreate.mockResolvedValueOnce({
      id: "cs_1",
      url: "https://stripe.test/pay",
    })

    const res = await createStripeCheckout(input)

    expect(res).toEqual({ checkoutUrl: "https://stripe.test/pay" })
    const arg = mocks.checkoutCreate.mock.calls[0]![0] as unknown as {
      line_items: { price: string }[]
    }
    expect(arg.line_items[0].price).toBe("price_1")
    expect(mocks.captureServerError).toHaveBeenCalled()
  })

  // Un montant diverge legalement le temps qu'un changement de tarif Stripe soit
  // repercute en base : alerter suffit, couper les ventes couterait plus cher.
  it("montant Stripe divergent → alerte mais la vente aboutit", async () => {
    mocks.pricesList.mockResolvedValue({
      data: [{ id: "price_resolved", unit_amount: 9900, currency: "cad" }],
    })
    mocks.checkoutCreate.mockResolvedValueOnce({
      id: "cs_1",
      url: "https://stripe.test/pay",
    })

    const res = await createStripeCheckout(input)

    expect(res).toEqual({ checkoutUrl: "https://stripe.test/pay" })
    expect(mocks.captureServerError).toHaveBeenCalled()
  })

  // La devise d'un prix Stripe est immuable : un ecart de devise n'est jamais un
  // etat transitoire legitime, c'est une cle qui pointe sur le mauvais prix.
  it("devise Stripe ≠ cad → refus, aucune session ni pending", async () => {
    mocks.pricesList.mockResolvedValue({
      data: [{ id: "price_resolved", unit_amount: 5000, currency: "usd" }],
    })

    const res = await createStripeCheckout(input)

    expect(res).toEqual({
      error: "Ce produit est mal configuré. Contactez le support.",
    })
    expect(mocks.checkoutCreate).not.toHaveBeenCalled()
    expect(mocks.insertValues).not.toHaveBeenCalled()
    expect(mocks.captureServerError).toHaveBeenCalled()
  })

  it("prix Stripe conforme → aucune alerte", async () => {
    mocks.checkoutCreate.mockResolvedValueOnce({
      id: "cs_1",
      url: "https://stripe.test/pay",
    })
    await createStripeCheckout(input)
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("session Stripe sans url → erreur, aucun pending insere", async () => {
    mocks.checkoutCreate.mockResolvedValueOnce({ id: "cs_1", url: null })
    const res = await createStripeCheckout(input)
    expect(res).toEqual({
      error: "Échec de création de la session de paiement",
    })
    expect(mocks.insertValues).not.toHaveBeenCalled()
  })

  // safePath : une URL absolue ou un `//host` passe pour un chemin cote client et
  // sortirait l'utilisateur du domaine apres paiement.
  it.each([
    ["//evil.test/pwn", "https://app.test/tableau-de-bord"],
    ["https://evil.test", "https://app.test/tableau-de-bord"],
    ["pas-un-chemin", "https://app.test/tableau-de-bord"],
  ])("successPath %s → repli interne", async (successPath, expectedPrefix) => {
    mocks.checkoutCreate.mockResolvedValueOnce({
      id: "cs_1",
      url: "https://stripe.test/pay",
    })
    await createStripeCheckout({
      ...input,
      successPath,
      cancelPath: "//evil.test",
    })
    const arg = mocks.checkoutCreate.mock.calls[0]![0]
    expect(arg.success_url).toBe(
      `${expectedPrefix}?session_id={CHECKOUT_SESSION_ID}`,
    )
    expect(arg.cancel_url).toBe("https://app.test/tarifs")
  })

  it("chemin interne valide conserve tel quel", async () => {
    mocks.checkoutCreate.mockResolvedValueOnce({
      id: "cs_1",
      url: "https://stripe.test/pay",
    })
    await createStripeCheckout({
      ...input,
      successPath: "/merci",
      cancelPath: "/tarifs?annule=1",
    })
    const arg = mocks.checkoutCreate.mock.calls[0]![0]
    expect(arg.success_url).toBe(
      "https://app.test/merci?session_id={CHECKOUT_SESSION_ID}",
    )
    expect(arg.cancel_url).toBe("https://app.test/tarifs?annule=1")
  })

  it("panne Stripe → message generique + capture", async () => {
    mocks.checkoutCreate.mockRejectedValueOnce(new Error("Stripe API down"))
    const res = await createStripeCheckout(input)
    expect(res).toEqual({
      error: "Erreur lors de la création du paiement. Réessayez.",
    })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[createStripeCheckout]",
      expect.any(Error),
      { userId: "u1" },
    )
  })
})

describe("createCustomerPortal", () => {
  it("aucun customer Stripe → message metier, pas de portail", async () => {
    mocks.customersList.mockResolvedValueOnce({ data: [] })
    const res = await createCustomerPortal("/tableau-de-bord/abonnements")
    expect(res).toEqual({ error: "Aucun historique de paiement Stripe" })
    expect(mocks.portalCreate).not.toHaveBeenCalled()
  })

  it("returnPath externe → repli interne dans return_url", async () => {
    mocks.customersList.mockResolvedValueOnce({ data: [{ id: "cus_1" }] })
    mocks.portalCreate.mockResolvedValueOnce({ url: "https://stripe.test/p" })
    const res = await createCustomerPortal("https://evil.test")
    expect(res).toEqual({ portalUrl: "https://stripe.test/p" })
    expect(mocks.portalCreate.mock.calls[0]![0].return_url).toBe(
      "https://app.test/tableau-de-bord/abonnements",
    )
  })

  it("panne Stripe → message generique + capture", async () => {
    mocks.customersList.mockRejectedValueOnce(new Error("Stripe API down"))
    const res = await createCustomerPortal("/tableau-de-bord/abonnements")
    expect(res).toEqual({
      error: "Impossible d'ouvrir le portail de facturation. Réessayez.",
    })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[createCustomerPortal]",
      expect.any(Error),
      { userId: "u1" },
    )
  })
})

describe("chargeurs de pages (garde + delegation)", () => {
  it("loadMoreMyTransactions exige une session et passe le curseur", async () => {
    await loadMoreMyTransactions("cur_1")
    expect(mocks.requireSession).toHaveBeenCalled()
    expect(mocks.getMyTransactions).toHaveBeenCalledWith({ cursor: "cur_1" })
  })

  it("loadAdminTransactions exige le role admin et passe les filtres", async () => {
    const params = { cursor: null, type: "manual" as const }
    await loadAdminTransactions(params)
    expect(mocks.requireRole).toHaveBeenCalledWith(["admin"])
    expect(mocks.getAllTransactions).toHaveBeenCalledWith(params)
  })

  it("loadTransactionStats exige le role admin", async () => {
    await loadTransactionStats()
    expect(mocks.requireRole).toHaveBeenCalledWith(["admin"])
    expect(mocks.getTransactionStats).toHaveBeenCalled()
  })

  it("loadTransactionAccessImpact exige le role admin", async () => {
    mocks.getTransactionAccessImpact.mockResolvedValueOnce({
      willAffectAccess: true,
    })
    const res = await loadTransactionAccessImpact("t1")
    expect(mocks.requireRole).toHaveBeenCalledWith(["admin"])
    expect(res).toEqual({ willAffectAccess: true })
  })

  it("loadUserAccessStatus : accès inexistant → statut vide plutot que null", async () => {
    const res = await loadUserAccessStatus("u9")
    expect(mocks.requireRole).toHaveBeenCalledWith(["admin"])
    expect(res).toEqual({ examAccess: null, trainingAccess: null })
  })

  it("loadUserAccessStatus : statut existant transmis tel quel", async () => {
    const status = {
      examAccess: { expiresAt: 1, daysRemaining: 2 },
      trainingAccess: null,
    }
    mocks.getAccessStatus.mockResolvedValueOnce(status)
    const res = await loadUserAccessStatus("u9")
    expect(res).toEqual(status)
  })
})
