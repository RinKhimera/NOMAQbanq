import { beforeEach, describe, expect, it, vi } from "vitest"
import { STRIPE_API_VERSION } from "@/lib/stripe-api-version"

// Le port est remplacé par le faux partout ailleurs : cette suite est la seule
// à exécuter `lib/stripe.ts` lui-même. Le SDK est un constructeur espionné —
// on prouve ce que le port lui demande, pas ce que Stripe répond.
const { mocks } = vi.hoisted(() => {
  const sdk = {
    prices: { list: vi.fn() },
    checkout: {
      sessions: { retrieve: vi.fn(), list: vi.fn(), create: vi.fn() },
    },
    customers: { list: vi.fn() },
    billingPortal: { sessions: { create: vi.fn() } },
    webhooks: { constructEventAsync: vi.fn() },
  }
  return {
    mocks: {
      sdk,
      StripeCtor: vi.fn(function () {
        return sdk
      }),
      env: {
        STRIPE_SECRET_KEY: "sk_test_x" as string | undefined,
        STRIPE_WEBHOOK_SECRET: "whsec_x" as string | undefined,
      },
    },
  }
})

vi.mock("stripe", () => ({ default: mocks.StripeCtor }))
vi.mock("@/lib/env/server", () => ({ env: mocks.env }))

// Le client est mémoïsé au niveau module : chaque test repart d'un module neuf.
const loadPort = async () => {
  vi.resetModules()
  return import("@/lib/stripe")
}

beforeEach(() => {
  mocks.env.STRIPE_SECRET_KEY = "sk_test_x"
  mocks.env.STRIPE_WEBHOOK_SECRET = "whsec_x"
  mocks.sdk.prices.list.mockResolvedValue({ data: [] })
  mocks.sdk.customers.list.mockResolvedValue({ data: [] })
})

describe("port Stripe — construction du client", () => {
  // Le SDK attend 80 s et réessaie 2 fois par défaut : ~4 min sur un chemin où
  // l'utilisateur attend. La borne est posée UNE fois, ici, pour tous les verbes.
  it("borne timeout/retry et épingle la version d'API, une seule fois", async () => {
    const port = await loadPort()
    await port.listActivePrices(["a"])
    await port.findCustomerByEmail("x@test.invalid")

    expect(mocks.StripeCtor).toHaveBeenCalledTimes(1)
    expect(mocks.StripeCtor).toHaveBeenCalledWith("sk_test_x", {
      apiVersion: STRIPE_API_VERSION,
      timeout: 8000,
      maxNetworkRetries: 1,
    })
  })

  it("clé absente → StripeConfigurationError, aucun client construit", async () => {
    mocks.env.STRIPE_SECRET_KEY = undefined
    const port = await loadPort()
    await expect(port.verifyWebhook("{}", "sig")).rejects.toMatchObject({
      name: "StripeConfigurationError",
      message: "Configuration Stripe manquante (STRIPE_SECRET_KEY)",
    })
    expect(mocks.StripeCtor).not.toHaveBeenCalled()
  })

  it("secret de webhook absent → StripeConfigurationError, signature jamais vérifiée", async () => {
    mocks.env.STRIPE_WEBHOOK_SECRET = undefined
    const port = await loadPort()
    const rejection = await port.verifyWebhook("{}", "sig").catch((e) => e)
    expect(rejection).toBeInstanceOf(Error)
    expect(rejection.name).toBe("StripeConfigurationError")
    expect(mocks.sdk.webhooks.constructEventAsync).not.toHaveBeenCalled()
  })

  it("verifyWebhook → constructEventAsync avec le corps brut et le secret", async () => {
    mocks.sdk.webhooks.constructEventAsync.mockResolvedValue({ id: "evt_1" })
    const port = await loadPort()
    expect(await port.verifyWebhook("{raw}", "sig")).toEqual({ id: "evt_1" })
    expect(mocks.sdk.webhooks.constructEventAsync).toHaveBeenCalledWith(
      "{raw}",
      "sig",
      "whsec_x",
    )
  })
})

describe("port Stripe — verbes", () => {
  // `limit: 100` et PAS le nombre de clés : une clé peut porter plusieurs prix
  // actifs, un `limit` égal au nombre de clés tronquerait la liste.
  it("listActivePrices : prix actifs seulement, limit 100", async () => {
    mocks.sdk.prices.list.mockResolvedValue({
      data: [{ id: "price_1", unit_amount: 5000, currency: "cad" }],
    })
    const port = await loadPort()
    const prices = await port.listActivePrices(["a", "b"])
    expect(prices).toEqual([
      { id: "price_1", unit_amount: 5000, currency: "cad" },
    ])
    expect(mocks.sdk.prices.list).toHaveBeenCalledWith({
      lookup_keys: ["a", "b"],
      active: true,
      limit: 100,
    })
  })

  // `resource_missing` = session_id d'URL périmé ou forgé : flux métier, pas une
  // capture Sentry. Jumeau : toute autre erreur remonte telle quelle.
  it("retrieveCheckoutSession : resource_missing → null, autre erreur → remonte", async () => {
    const port = await loadPort()
    mocks.sdk.checkout.sessions.retrieve.mockRejectedValueOnce(
      Object.assign(new Error("No such checkout.session"), {
        code: "resource_missing",
      }),
    )
    expect(await port.retrieveCheckoutSession("cs_perime")).toBeNull()

    const boom = new Error("Stripe API down")
    mocks.sdk.checkout.sessions.retrieve.mockRejectedValueOnce(boom)
    await expect(port.retrieveCheckoutSession("cs_x")).rejects.toBe(boom)
  })

  it("retrieveCheckoutSession : ne rend que les six champs lus par l'app", async () => {
    mocks.sdk.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_1",
      payment_status: "paid",
      amount_total: 5000,
      currency: "cad",
      customer_email: "x@test.invalid",
      metadata: { userId: "u1" },
      client_secret: "secret",
    })
    const port = await loadPort()
    expect(await port.retrieveCheckoutSession("cs_1")).toEqual({
      id: "cs_1",
      payment_status: "paid",
      amount_total: 5000,
      currency: "cad",
      customer_email: "x@test.invalid",
      metadata: { userId: "u1" },
    })
  })

  it("findCheckoutSessionByPaymentIntent : première session ou null", async () => {
    const port = await loadPort()
    mocks.sdk.checkout.sessions.list.mockResolvedValueOnce({
      data: [{ id: "cs_early", url: null }],
    })
    expect(await port.findCheckoutSessionByPaymentIntent("pi_1")).toEqual({
      id: "cs_early",
    })
    expect(mocks.sdk.checkout.sessions.list).toHaveBeenCalledWith({
      payment_intent: "pi_1",
      limit: 1,
    })
    mocks.sdk.checkout.sessions.list.mockResolvedValueOnce({ data: [] })
    expect(await port.findCheckoutSessionByPaymentIntent("pi_2")).toBeNull()
  })

  it("createCheckoutSession et createPortalSession : id/url seulement", async () => {
    mocks.sdk.checkout.sessions.create.mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.test/1",
      metadata: {},
    })
    mocks.sdk.billingPortal.sessions.create.mockResolvedValue({
      id: "bps_1",
      url: "https://billing.stripe.test/p",
    })
    const port = await loadPort()
    const params = { mode: "payment" as const, line_items: [] }
    expect(await port.createCheckoutSession(params)).toEqual({
      id: "cs_1",
      url: "https://checkout.stripe.test/1",
    })
    expect(mocks.sdk.checkout.sessions.create).toHaveBeenCalledWith(params)
    expect(
      await port.createPortalSession({ customer: "cus_1", return_url: "/r" }),
    ).toEqual({ url: "https://billing.stripe.test/p" })
  })

  it("findCustomerByEmail : premier customer ou null", async () => {
    const port = await loadPort()
    mocks.sdk.customers.list.mockResolvedValueOnce({
      data: [{ id: "cus_1" }],
    })
    expect(await port.findCustomerByEmail("x@test.invalid")).toEqual({
      id: "cus_1",
    })
    expect(mocks.sdk.customers.list).toHaveBeenCalledWith({
      email: "x@test.invalid",
      limit: 1,
    })
    mocks.sdk.customers.list.mockResolvedValueOnce({ data: [] })
    expect(await port.findCustomerByEmail("y@test.invalid")).toBeNull()
  })
})
