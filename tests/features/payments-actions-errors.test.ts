import { beforeEach, describe, expect, it, vi } from "vitest"

const { mocks } = vi.hoisted(() => ({
  mocks: {
    captureServerError: vi.fn(),
    retrieve: vi.fn<() => Promise<unknown>>(),
  },
}))

vi.mock("@/lib/observability", () => ({
  captureServerError: mocks.captureServerError,
}))
vi.mock("@/db", () => ({ db: {} }))
vi.mock("@/db/schema", () => ({
  products: {},
  transactions: {},
  productCode: { enumValues: ["exam_access"] },
  currency: { enumValues: ["CAD", "XAF"] },
}))
vi.mock("@/features/payments/dal", () => ({
  getAccessStatus: vi.fn(),
  getAllTransactions: vi.fn(),
  getMyTransactions: vi.fn(),
  getTransactionAccessImpact: vi.fn(),
  getTransactionStats: vi.fn(),
}))
vi.mock("@/features/payments/lib", () => ({
  grantManualAccess: vi.fn(),
  revokeAccessIfLast: vi.fn(),
}))
vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(async () => ({ user: { id: "u1", role: "user" } })),
  requireRole: vi.fn(),
}))
vi.mock("@/lib/base-url", () => ({ getBaseUrl: () => "http://localhost:3000" }))
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { retrieve: mocks.retrieve } } }),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { verifyStripeCheckout } from "@/features/payments/actions"

beforeEach(() => {
  mocks.captureServerError.mockClear()
})

describe("verifyStripeCheckout — catch filtré resource_missing", () => {
  it("session_id invalide (resource_missing) → message métier, PAS de capture", async () => {
    mocks.retrieve.mockRejectedValueOnce(
      Object.assign(new Error("No such checkout.session"), {
        code: "resource_missing",
      }),
    )
    const res = await verifyStripeCheckout("cs_bidon")
    expect(res).toEqual({
      success: false,
      error: "Session non trouvée ou invalide",
    })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("erreur Stripe inattendue → même message + capture", async () => {
    const boom = new Error("Stripe API down")
    mocks.retrieve.mockRejectedValueOnce(boom)
    const res = await verifyStripeCheckout("cs_x")
    expect(res).toEqual({
      success: false,
      error: "Session non trouvée ou invalide",
    })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[verifyStripeCheckout]",
      boom,
      { userId: "u1" },
    )
  })
})
