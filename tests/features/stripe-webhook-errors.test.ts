import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/stripe/webhook/route"

const { mocks } = vi.hoisted(() => ({
  mocks: {
    captureServerError: vi.fn(),
    completeStripeTransaction: vi.fn<() => Promise<unknown>>(),
    fail: vi.fn(),
    constructEventAsync: vi.fn<() => Promise<unknown>>(),
  },
}))

vi.mock("@/lib/observability", () => ({
  captureServerError: mocks.captureServerError,
}))
vi.mock("@/features/payments/stripe", () => ({
  completeStripeTransaction: mocks.completeStripeTransaction,
  failStripeTransaction: mocks.fail,
}))
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEventAsync: mocks.constructEventAsync },
  }),
  getStripeWebhookSecret: () => "whsec_test",
}))

const request = () =>
  new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig" },
    body: "{}",
  })

beforeEach(() => {
  vi.clearAllMocks()
  // Défaut happy path pour les tests qui ne posent pas leur propre valeur.
  mocks.completeStripeTransaction.mockResolvedValue({ status: "completed" })
})

describe("webhook Stripe — contrat HTTP", () => {
  it("échec de fulfillment → captureServerError + 500 (retry Stripe conservé)", async () => {
    const boom = new Error("Neon down")
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          payment_status: "paid",
          payment_intent: "pi_1",
          amount_total: 100,
          currency: "cad",
        },
      },
    })
    mocks.completeStripeTransaction.mockRejectedValueOnce(boom)

    const res = await POST(request())
    expect(res.status).toBe(500)
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[stripe:webhook]",
      boom,
      { detail: "checkout.session.completed" },
    )
  })

  it("signature absente → 400 (jamais rejoué)", async () => {
    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("signature invalide → 400", async () => {
    mocks.constructEventAsync.mockRejectedValueOnce(new Error("bad sig"))
    const res = await POST(request())
    expect(res.status).toBe(400)
  })

  it("payment_status non fulfillable → pas de fulfillment, 200", async () => {
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_unpaid",
      type: "checkout.session.completed",
      data: { object: { id: "cs_unpaid", payment_status: "unpaid" } },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.completeStripeTransaction).not.toHaveBeenCalled()
  })

  it("transaction fantôme (not_found) → capture + 200", async () => {
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_ghost",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_ghost",
          payment_status: "paid",
          payment_intent: "pi_1",
          amount_total: 5000,
          currency: "cad",
        },
      },
    })
    mocks.completeStripeTransaction.mockResolvedValueOnce({
      status: "not_found",
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.captureServerError).toHaveBeenCalled()
  })

  it("checkout.session.expired → failStripeTransaction, 200", async () => {
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_exp",
      type: "checkout.session.expired",
      data: { object: { id: "cs_exp" } },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.fail).toHaveBeenCalledWith({
      stripeSessionId: "cs_exp",
      stripeEventId: "evt_exp",
    })
  })
})
