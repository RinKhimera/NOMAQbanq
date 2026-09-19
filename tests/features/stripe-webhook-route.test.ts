import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/stripe/webhook/route"
import { stripeBox } from "../helpers/fake-stripe"

// Contrat d'acquittement de la route, et lui seul : 400 signature (jamais
// rejoué), 500 à rejouer, 200 traité. Le fulfillment est mocké ICI et
// seulement ici (sa table d'événements vit dans stripe-fulfillment.test.ts).
const { mocks } = vi.hoisted(() => ({
  mocks: {
    captureServerError: vi.fn(),
    fulfil: vi.fn<() => Promise<{ deferred?: () => Promise<void> }>>(),
    after: vi.fn<(cb: () => Promise<void>) => void>(),
  },
}))

vi.mock("@/lib/observability", () => ({
  captureServerError: mocks.captureServerError,
}))
vi.mock("@/features/payments/fulfillment", () => ({
  fulfilStripeEvent: mocks.fulfil,
}))
vi.mock("next/server", () => ({ after: mocks.after }))
vi.mock("@/lib/stripe", () =>
  import("../helpers/fake-stripe").then((m) => m.fakeStripe),
)

const request = (
  headers: Record<string, string> = { "stripe-signature": "sig" },
) =>
  new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers,
    body: "{}",
  })

const EVENT = { id: "evt_1", type: "checkout.session.completed" }

beforeEach(() => {
  stripeBox.reset()
  mocks.fulfil.mockResolvedValue({})
})

describe("webhook Stripe — acquittement", () => {
  it("en-tête stripe-signature absent → 400, rien n'est vérifié ni capturé", async () => {
    const res = await POST(request({}))
    expect(res.status).toBe(400)
    expect(stripeBox.calls).toEqual([])
    expect(mocks.fulfil).not.toHaveBeenCalled()
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("signature invalide → 400 sans capture (jamais rejoué)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await POST(request())
    expect(res.status).toBe(400)
    expect(mocks.fulfil).not.toHaveBeenCalled()
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  // Un secret manquant n'est pas une signature invalide : Stripe doit rejouer
  // une fois la configuration réparée.
  it("erreur de configuration → 500 + capture « configuration »", async () => {
    const missing = Object.assign(
      new Error("Configuration Stripe manquante (STRIPE_WEBHOOK_SECRET)"),
      { name: "StripeConfigurationError" },
    )
    stripeBox.failNext("verifyWebhook", missing)
    const res = await POST(request())
    expect(res.status).toBe(500)
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[stripe:webhook]",
      missing,
      { detail: "configuration" },
    )
    expect(mocks.fulfil).not.toHaveBeenCalled()
  })

  it("événement vérifié → transmis tel quel au fulfillment, 200", async () => {
    stripeBox.nextEvent(EVENT)
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(stripeBox.calls).toEqual([
      { verb: "verifyWebhook", input: ["{}", "sig"] },
    ])
    expect(mocks.fulfil).toHaveBeenCalledWith(EVENT)
    expect(mocks.after).not.toHaveBeenCalled()
  })

  // `onRequestError` ne voit jamais cette erreur (catchée puis convertie en
  // Response) : la capture explicite est la seule trace Sentry.
  it("fulfillment qui lève → 500 + capture portant le type d'événement", async () => {
    const boom = new Error("Neon down")
    mocks.fulfil.mockRejectedValueOnce(boom)
    stripeBox.nextEvent(EVENT)
    const res = await POST(request())
    expect(res.status).toBe(500)
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[stripe:webhook]",
      boom,
      { detail: "checkout.session.completed" },
    )
    expect(mocks.after).not.toHaveBeenCalled()
  })

  it("travail différé rendu → confié à after, jamais exécuté avant le 200", async () => {
    const deferred = vi.fn(async () => {})
    mocks.fulfil.mockResolvedValueOnce({ deferred })
    stripeBox.nextEvent(EVENT)
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.after).toHaveBeenCalledWith(deferred)
    expect(deferred).not.toHaveBeenCalled()
  })
})
