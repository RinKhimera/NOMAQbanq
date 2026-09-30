import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  getCurrentUser,
  getLoginMethods,
  getUserSessions,
} from "@/features/users/dal"

// Couvre les DECISIONS de la DAL utilisateurs : gardes self-scoped et mappages
// du profil. La lecture admin (liste, fiche) et sa semantique SQL (recherche,
// filtres, tri) est verifiee sur une vraie base dans
// tests/integration/users-admin-dal.test.ts et exam-audience.test.ts.
const { mocks, fakeDb, table } = vi.hoisted(() => {
  const mocks = {
    rows: { current: {} as Record<string, unknown[]> },
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
  }

  const table = (name: string) => ({ __table: name })

  const queryChain = (initialTable?: string) => {
    let target = initialTable
    const chain: Record<string, unknown> = {
      from: (t: { __table?: string }) => {
        target = t?.__table
        return chain
      },
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      groupBy: () => chain,
      orderBy: () => chain,
      offset: () => chain,
      limit: () => chain,
      then: (onOk: (v: unknown) => unknown, onErr: (e: unknown) => unknown) =>
        Promise.resolve(
          (target ? mocks.rows.current[target] : undefined) ?? [],
        ).then(onOk, onErr),
    }
    return chain
  }

  const fakeDb = {
    select: () => queryChain(),
    selectDistinct: () => queryChain(),
  }

  return { mocks, fakeDb, table }
})

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/db", () => ({ db: fakeDb }))
vi.mock("@/db/schema", () => ({
  account: table("account"),
  products: table("products"),
  session: table("session"),
  transactions: table("transactions"),
  user: table("user"),
  userAccess: table("user_access"),
}))
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
  mocks.rows.current = {}
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
    mocks.rows.current = { user: [] }
    expect(await getCurrentUser()).toBeNull()
  })
})

describe("getLoginMethods", () => {
  it("signale Google non lie et l'absence de mot de passe", async () => {
    mocks.rows.current = { account: [], user: [] }
    expect(await getLoginMethods()).toEqual({
      hasPassword: false,
      google: { linked: false },
      emailVerified: false,
    })
  })

  it("signale les deux methodes, la date de liaison et l'id de la ligne Google", async () => {
    const linkedAt = new Date("2026-01-01T00:00:00.000Z")
    mocks.rows.current = {
      account: [
        { id: "acc-cred", providerId: "credential", createdAt: new Date() },
        { id: "acc-google", providerId: "google", createdAt: linkedAt },
      ],
      user: [{ emailVerified: true }],
    }
    expect(await getLoginMethods()).toEqual({
      hasPassword: true,
      google: { linked: true, linkedAt, accountId: "acc-google" },
      emailVerified: true,
    })
  })
})
