import { beforeEach, describe, expect, it, vi } from "vitest"
import { getCurrentSession } from "@/lib/dal"

const getSession = vi.fn()
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } },
}))
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})

const session = (banned: boolean | null | undefined) => ({
  session: { id: "s1", token: "t" },
  user: { id: "u1", email: "u@test.invalid", role: "user", banned },
})

beforeEach(() => getSession.mockReset())

describe("getCurrentSession", () => {
  it("renvoie la session d'un compte non banni", async () => {
    getSession.mockResolvedValue(session(false))
    expect((await getCurrentSession())?.user.id).toBe("u1")
  })

  it("tolère `banned` absent ou nul (comptes historiques)", async () => {
    getSession.mockResolvedValue(session(null))
    expect(await getCurrentSession()).not.toBeNull()
    getSession.mockResolvedValue(session(undefined))
    expect(await getCurrentSession()).not.toBeNull()
  })

  it("renvoie null pour un compte banni : une session résiduelle vaut déconnexion", async () => {
    getSession.mockResolvedValue(session(true))
    expect(await getCurrentSession()).toBeNull()
  })

  it("renvoie null sans session", async () => {
    getSession.mockResolvedValue(null)
    expect(await getCurrentSession()).toBeNull()
  })
})
