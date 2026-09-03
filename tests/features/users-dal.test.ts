import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  getCurrentUser,
  getLoginMethods,
  getUserPanelData,
  getUserSessions,
} from "@/features/users/dal"

// Couvre les DECISIONS de la DAL utilisateurs : gardes self-scoped, et les deux
// mappages d'acces (`toAccessInfo` cote profil, `toPanelAccess` cote admin) qui
// divergent VOLONTAIREMENT sur un acces expire. La semantique SQL (recherche,
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

const DAY = 24 * 60 * 60 * 1000

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

describe("getUserPanelData — mappage des acces (admin)", () => {
  const detailRow = {
    id: "u9",
    name: "Etu",
    username: null,
    email: "e@x.test",
    image: null,
    bio: null,
    role: "user",
    createdAt: new Date(),
  }

  it("renvoie null quand le detail est introuvable", async () => {
    mocks.rows.current = { user: [] }
    expect(await getUserPanelData("u9")).toBeNull()
  })

  it("marque un acces expire comme inactif au lieu de l'effacer", async () => {
    const expired = new Date(Date.now() - DAY)
    mocks.rows.current = {
      user: [detailRow],
      user_access: [{ accessType: "exam", expiresAt: expired }],
      transactions: [],
    }
    const panel = await getUserPanelData("u9")
    // Divergence volontaire avec `toAccessInfo` (profil), qui rend `null` sur un
    // acces expire : le panneau admin doit continuer a montrer l'echeance passee.
    expect(panel?.examAccess).toEqual({
      expiresAt: expired.getTime(),
      daysRemaining: 0,
      isActive: false,
    })
    expect(panel?.trainingAccess).toBeNull()
  })

  it("compte les jours restants d'un acces actif", async () => {
    const future = new Date(Date.now() + 3 * DAY)
    mocks.rows.current = {
      user: [detailRow],
      user_access: [{ accessType: "training", expiresAt: future }],
      transactions: [],
    }
    const panel = await getUserPanelData("u9")
    expect(panel?.trainingAccess).toMatchObject({
      isActive: true,
      daysRemaining: 3,
    })
  })

  it("rend un produit nul quand la transaction n'en porte pas", async () => {
    mocks.rows.current = {
      user: [detailRow],
      user_access: [],
      transactions: [
        {
          id: "t1",
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          createdAt: new Date(),
          productName: null,
        },
      ],
    }
    const panel = await getUserPanelData("u9")
    expect(panel?.recentTransactions[0]?.product).toBeNull()
  })
})
