import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/stripe/webhook/route"

const { mocks } = vi.hoisted(() => ({
  mocks: {
    captureServerError: vi.fn(),
    completeStripeTransaction: vi.fn<() => Promise<unknown>>(),
    fail: vi.fn(),
    recordDispute: vi.fn<() => Promise<unknown>>(),
    constructEventAsync: vi.fn<() => Promise<unknown>>(),
  },
}))

vi.mock("@/lib/observability", () => ({
  captureServerError: mocks.captureServerError,
}))
vi.mock("@/features/payments/stripe", () => ({
  completeStripeTransaction: mocks.completeStripeTransaction,
  failStripeTransaction: mocks.fail,
  recordStripeDispute: mocks.recordDispute,
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
  mocks.recordDispute.mockResolvedValue({ status: "recorded" })
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

  it("async_payment_succeeded → même chemin d'octroi que completed", async () => {
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_async_ok",
      type: "checkout.session.async_payment_succeeded",
      data: {
        object: {
          id: "cs_async",
          payment_status: "paid",
          payment_intent: "pi_async",
          amount_total: 9900,
          currency: "cad",
        },
      },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.completeStripeTransaction).toHaveBeenCalledWith({
      stripeSessionId: "cs_async",
      stripePaymentIntentId: "pi_async",
      stripeEventId: "evt_async_ok",
      amountTotal: 9900,
      currency: "cad",
    })
  })

  // Adaptive Pricing : sans ce test, rien ne verifie que la route transmet le
  // hash au fulfillment. L'assertion voisine ne l'attrape pas — `toEqual` ignore
  // les proprietes `undefined`, donc elle passe que le cablage existe ou non.
  it("presentment_details → transmis au fulfillment", async () => {
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_present",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_present",
          payment_status: "paid",
          payment_intent: "pi_present",
          amount_total: 5000,
          currency: "cad",
          presentment_details: {
            presentment_amount: 2280000,
            presentment_currency: "xaf",
          },
        },
      },
    })

    const res = await POST(request())

    expect(res.status).toBe(200)
    expect(mocks.completeStripeTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        presentmentAmount: 2280000,
        presentmentCurrency: "xaf",
      }),
    )
  })

  it("async_payment_failed → failStripeTransaction, 200", async () => {
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_async_ko",
      type: "checkout.session.async_payment_failed",
      data: { object: { id: "cs_async_ko" } },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.fail).toHaveBeenCalledWith({
      stripeSessionId: "cs_async_ko",
      stripeEventId: "evt_async_ko",
    })
  })

  it("charge.dispute.created → alerte, persiste le litige, 200, aucune révocation d'accès", async () => {
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_dispute",
      type: "charge.dispute.created",
      data: {
        object: {
          id: "dp_1",
          amount: 9900,
          currency: "cad",
          reason: "fraudulent",
          status: "needs_response",
          payment_intent: "pi_dispute",
        },
      },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    // Le payment_intent est ce qui relie l'alerte a une transaction, donc a un
    // client : sans lui, personne n'est identifiable depuis Sentry.
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[stripe:webhook]",
      expect.any(Error),
      {
        detail:
          "dispute dp_1 · 9900 cad · motif fraudulent · statut needs_response · payment_intent pi_dispute",
      },
    )
    expect(mocks.recordDispute).toHaveBeenCalledWith({
      stripePaymentIntentId: "pi_dispute",
      stripeDisputeId: "dp_1",
      disputeStatus: "needs_response",
    })
    expect(mocks.fail).not.toHaveBeenCalled()
  })

  // Jumeau du precedent : l'absence de payment_intent ne doit ni faire planter la
  // route ni escamoter l'alerte — un litige non identifiable reste un litige.
  it("litige sans payment_intent → alerte quand meme, 200", async () => {
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_dispute_orphelin",
      type: "charge.dispute.created",
      data: {
        object: {
          id: "dp_2",
          amount: 9900,
          currency: "cad",
          reason: "fraudulent",
          status: "needs_response",
          payment_intent: null,
        },
      },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[stripe:webhook]",
      expect.any(Error),
      { detail: expect.stringContaining("payment_intent absent") },
    )
    expect(mocks.recordDispute).not.toHaveBeenCalled()
  })

  // L'alerte est le seul signal qui ouvre la fenêtre de réponse : elle doit
  // partir même si la base est indisponible, avec tout son détail.
  it("charge.dispute.created + Neon en panne → alerte détaillée émise, puis 500", async () => {
    mocks.recordDispute.mockRejectedValueOnce(new Error("Neon down"))
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_dispute_db",
      type: "charge.dispute.created",
      data: {
        object: {
          id: "dp_1",
          amount: 9900,
          currency: "cad",
          reason: "fraudulent",
          status: "needs_response",
          payment_intent: "pi_dispute",
        },
      },
    })
    const res = await POST(request())
    expect(res.status).toBe(500)
    const [, error, context] = mocks.captureServerError.mock.calls[0]!
    expect((error as Error).message).toBe(
      "litige ouvert sur un paiement Stripe",
    )
    expect(context).toEqual({
      detail:
        "dispute dp_1 · 9900 cad · motif fraudulent · statut needs_response · payment_intent pi_dispute",
    })
  })

  it("charge.dispute.updated → persiste sans alerter", async () => {
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_dispute_upd",
      type: "charge.dispute.updated",
      data: {
        object: {
          id: "dp_1",
          amount: 9900,
          currency: "cad",
          reason: "fraudulent",
          status: "under_review",
          payment_intent: "pi_dispute",
        },
      },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.recordDispute).toHaveBeenCalledWith({
      stripePaymentIntentId: "pi_dispute",
      stripeDisputeId: "dp_1",
      disputeStatus: "under_review",
    })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it.each([
    ["won", "litige gagné"],
    ["lost", "litige perdu"],
    ["warning_closed", "litige clos"],
  ])(
    "charge.dispute.closed (%s) → alerte « %s » et persiste",
    async (status, message) => {
      mocks.constructEventAsync.mockResolvedValueOnce({
        id: `evt_closed_${status}`,
        type: "charge.dispute.closed",
        data: {
          object: {
            id: "dp_1",
            amount: 9900,
            currency: "cad",
            reason: "fraudulent",
            status,
            payment_intent: "pi_dispute",
          },
        },
      })
      const res = await POST(request())
      expect(res.status).toBe(200)
      const [, error, context] = mocks.captureServerError.mock.calls[0]!
      expect((error as Error).message).toBe(message)
      expect(context).toEqual({
        detail: `dispute dp_1 · 9900 cad · motif fraudulent · statut ${status} · payment_intent pi_dispute`,
      })
      expect(mocks.recordDispute).toHaveBeenCalledWith(
        expect.objectContaining({ disputeStatus: status }),
      )
    },
  )

  it("charge.dispute.funds_reinstated → alerte de restitution et persiste", async () => {
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_reinstated",
      type: "charge.dispute.funds_reinstated",
      data: {
        object: {
          id: "dp_1",
          amount: 9900,
          currency: "cad",
          reason: "fraudulent",
          status: "won",
          payment_intent: "pi_dispute",
        },
      },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    const [, error] = mocks.captureServerError.mock.calls[0]!
    expect((error as Error).message).toBe("fonds restitués après litige")
    expect(mocks.recordDispute).toHaveBeenCalled()
  })

  // Deux alertes, pas une : « un litige vient de s'ouvrir » reste dit, et
  // l'anomalie « aucune transaction » s'y ajoute.
  it("litige sur un payment_intent sans transaction → alerte de cycle de vie ET alerte dédiée, 200", async () => {
    mocks.recordDispute.mockResolvedValueOnce({ status: "not_found" })
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_dispute_ghost",
      type: "charge.dispute.created",
      data: {
        object: {
          id: "dp_9",
          amount: 100,
          currency: "cad",
          reason: "general",
          status: "needs_response",
          payment_intent: "pi_ghost",
        },
      },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    const messages = mocks.captureServerError.mock.calls.map(
      ([, error]) => (error as Error).message,
    )
    expect(messages).toEqual([
      "litige ouvert sur un paiement Stripe",
      "litige sans transaction correspondante",
    ])
  })

  it("radar.early_fraud_warning.created → alerte avec charge et payment_intent, 200", async () => {
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_efw",
      type: "radar.early_fraud_warning.created",
      data: {
        object: {
          id: "issfr_1",
          charge: "ch_1",
          fraud_type: "made_with_stolen_card",
          actionable: true,
          payment_intent: "pi_efw",
        },
      },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.recordDispute).not.toHaveBeenCalled()
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[stripe:webhook]",
      expect.any(Error),
      {
        detail:
          "efw issfr_1 · charge ch_1 · type made_with_stolen_card · payment_intent pi_efw · remboursement proactif à envisager",
      },
    )
  })
})
