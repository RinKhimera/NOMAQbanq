import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  getCurrentUser,
  getLoginMethods,
  getUserSessions,
} from "@/features/users/dal"
import { resetFakeDrizzle, setRows } from "../helpers/fake-drizzle"

// Couvre les DECISIONS de la DAL utilisateurs : gardes self-scoped et mappages
// du profil. La lecture admin (liste, fiche) et sa semantique SQL (recherche,
// filtres, tri) est verifiee sur une vraie base dans
// tests/integration/users-admin-dal.test.ts et exam-audience.test.ts.
const { mocks } = vi.hoisted(() => ({
  mocks: {
    session: {
      current: {
        user: { id: "u1", role: "user" },
        session: { id: "sess1" },
      } as {
        user: { id: string; role: string }
        session: { id: string }
      } | null,
    },
    requireRole: vi.fn(async () => undefined),
  },
}))

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/db", async () => ({
  db: (await import("../helpers/fake-drizzle")).fakeDb,
}))
vi.mock("@/db/schema", async () => {
  const { table } = await import("../helpers/fake-drizzle")
  return {
    account: table("account"),
    products: table("products"),
    session: table("session"),
    transactions: table("transactions"),
    user: table("user"),
    userAccess: table("user_access"),
  }
})
vi.mock("@/lib/dal", () => ({
  getCurrentSession: vi.fn(async () => mocks.session.current),
}))
vi.mock("@/lib/auth-guards", () => ({
  requireRole: mocks.requireRole,
  requireSession: vi.fn(async () => mocks.session.current),
}))

const anonymous = () => {
  mocks.session.current = null
}
const asUser = (id = "u1") => {
  mocks.session.current = { user: { id, role: "user" }, session: { id: "s1" } }
}

beforeEach(() => {
  resetFakeDrizzle()
  asUser()
})

describe("gardes self-scoped", () => {
  it("chaque lecture rend sa valeur vide sans session", async () => {
    anonymous()
    expect(await getCurrentUser()).toBeNull()
    expect(await getLoginMethods()).toBeNull()
    expect(await getUserSessions()).toEqual([])
  })

  it("getCurrentUser renvoie null pour un compte supprime (ligne absente)", async () => {
    setRows({ user: [] })
    expect(await getCurrentUser()).toBeNull()
  })
})

describe("getLoginMethods", () => {
  it("signale Google non lie et l'absence de mot de passe", async () => {
    setRows({ account: [], user: [] })
    expect(await getLoginMethods()).toEqual({
      hasPassword: false,
      google: { linked: false },
      emailVerified: false,
    })
  })
})
