import { describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/stripe/webhook/route"

const { mocks } = vi.hoisted(() => ({
  mocks: {
    captureServerError: vi.fn(),
    completeStripeTransaction: vi.fn<() => Promise<unknown>>(),
    constructEventAsync: vi.fn<() => Promise<unknown>>(),
  },
}))

vi.mock("@/lib/observability", () => ({
  captureServerError: mocks.captureServerError,
}))
vi.mock("@/features/payments/stripe", () => ({
  completeStripeTransaction: mocks.completeStripeTransaction,
  failStripeTransaction: vi.fn(),
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

describe("webhook Stripe — catch de traitement", () => {
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
})
