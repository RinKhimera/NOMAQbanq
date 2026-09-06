import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET, POST } from "@/app/api/desabonnement/route"

const mocks = vi.hoisted(() => ({ apply: vi.fn() }))
vi.mock("@/features/notifications/unsubscribe", () => ({
  applyMarketingPreferenceByToken: mocks.apply,
}))

beforeEach(() => mocks.apply.mockReset())

describe("POST /api/desabonnement (RFC 8058)", () => {
  it("jeton valide → 200 et préférence désactivée", async () => {
    mocks.apply.mockResolvedValueOnce("updated")
    const res = await POST(
      new Request("https://nomaqbanq.ca/api/desabonnement?token=abc.def", {
        method: "POST",
        body: "List-Unsubscribe=One-Click",
      }),
    )
    expect(res.status).toBe(200)
    expect(mocks.apply).toHaveBeenCalledWith("abc.def", false)
  })

  it("jeton invalide → 400, rien d'autre", async () => {
    mocks.apply.mockResolvedValueOnce("invalid")
    const res = await POST(
      new Request("https://nomaqbanq.ca/api/desabonnement?token=zzz", {
        method: "POST",
      }),
    )
    expect(res.status).toBe(400)
  })
})

describe("GET /api/desabonnement", () => {
  it("redirige vers la page de confirmation avec le jeton", () => {
    const res = GET(
      new Request("https://nomaqbanq.ca/api/desabonnement?token=abc.def"),
    )
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe(
      "https://nomaqbanq.ca/desabonnement?token=abc.def",
    )
    expect(mocks.apply).not.toHaveBeenCalled()
  })
})
