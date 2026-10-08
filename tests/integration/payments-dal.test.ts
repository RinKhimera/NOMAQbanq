import { and, eq } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { transactions, user, userAccess } from "@/db/schema"
import {
  getAccessStatus,
  getMyTransactions,
  hasActiveAccess,
} from "@/features/payments/dal"
import { requireRole, requireSession } from "@/lib/auth-guards"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"
import { seedProduct } from "../helpers/seed-payments"

// Session mockée : on isole la logique DB.
vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(),
  requireRole: vi.fn(),
}))
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const DAY = 24 * 60 * 60 * 1000
const EXAM_EXPIRES = new Date(Date.now() + 10 * DAY)
const uid = createId()
let pid = ""
const sameTsIds = [createId(), createId(), createId()]
const pendingTxId = createId()
const accessTxId = createId()
const otherUid = createId()
const otherTxId = createId()

const completedTx = (id: string, createdAt: Date, userId = uid) => ({
  id,
  userId,
  productId: pid,
  type: "manual" as const,
  status: "completed" as const,
  amountPaid: 5000,
  currency: "CAD" as const,
  accessType: "exam" as const,
  durationDays: 90,
  accessExpiresAt: new Date(Date.now() + 90 * DAY),
  createdAt,
})

beforeAll(async () => {
  await db.insert(user).values([
    { id: uid, name: "IT User", email: `it-${uid}@test.invalid` },
    { id: otherUid, name: "Autre", email: `it-${otherUid}@test.invalid` },
  ])
  pid = await seedProduct("exam_access", { durationDays: 90 })

  // 3 transactions complétées au MÊME createdAt → force le tie-break
  // (createdAt, id) du curseur keyset.
  const sameTs = new Date("2026-01-01T00:00:00.000Z")
  await db
    .insert(transactions)
    .values(sameTsIds.map((id) => completedTx(id, sameTs)))
  // 1 pending (doit être masquée).
  await db.insert(transactions).values({
    id: pendingTxId,
    userId: uid,
    productId: pid,
    type: "stripe",
    status: "pending",
    amountPaid: 5000,
    currency: "CAD",
    accessType: "exam",
    durationDays: 90,
    accessExpiresAt: new Date(Date.now() + 90 * DAY),
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
  })
  // 1 transaction complétée plus récente (sert aussi de FK à userAccess).
  await db.insert(transactions).values({
    id: accessTxId,
    userId: uid,
    productId: pid,
    type: "manual",
    status: "completed",
    amountPaid: 5000,
    currency: "CAD",
    accessType: "exam",
    durationDays: 90,
    accessExpiresAt: new Date(Date.now() + 90 * DAY),
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
  })
  // Transaction d'un autre utilisateur, la plus récente de la base : sans le
  // filtre par propriétaire, elle passerait en tête de liste.
  await db.insert(transactions).values({
    id: otherTxId,
    userId: otherUid,
    productId: pid,
    type: "manual",
    status: "completed",
    amountPaid: 5000,
    currency: "CAD",
    accessType: "exam",
    durationDays: 90,
    accessExpiresAt: new Date(Date.now() + 90 * DAY),
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
  })
  // Accès exam actif, training expiré.
  await db.insert(userAccess).values([
    {
      userId: uid,
      accessType: "exam",
      expiresAt: EXAM_EXPIRES,
      lastTransactionId: accessTxId,
    },
    {
      userId: uid,
      accessType: "training",
      expiresAt: new Date(Date.now() - DAY),
      lastTransactionId: accessTxId,
    },
  ])
})

describe("getAccessStatus", () => {
  const signedInAs = (id: string) =>
    vi.mocked(getCurrentSession).mockResolvedValue({ user: { id } } as never)

  it("retourne l'accès exam actif et ignore le training expiré", async () => {
    signedInAs(uid)
    const status = await getAccessStatus(uid)
    expect(status).toEqual({
      examAccess: { expiresAt: EXAM_EXPIRES.getTime(), daysRemaining: 10 },
      trainingAccess: null,
    })
    expect(requireRole).not.toHaveBeenCalled()
  })

  it("lit l'utilisateur courant sans userId", async () => {
    signedInAs(uid)
    const status = await getAccessStatus()
    expect(status?.examAccess).not.toBeNull()
    expect(requireRole).not.toHaveBeenCalled()
  })

  it("refuse la lecture d'un autre utilisateur à un non-admin", async () => {
    signedInAs(createId())
    vi.mocked(requireRole).mockRejectedValueOnce(new Error("NEXT_REDIRECT"))
    await expect(getAccessStatus(uid)).rejects.toThrow("NEXT_REDIRECT")
    expect(requireRole).toHaveBeenCalledWith(["admin"])
  })

  it("laisse un admin lire un autre utilisateur", async () => {
    signedInAs(createId())
    vi.mocked(requireRole).mockResolvedValueOnce({} as never)
    const status = await getAccessStatus(uid)
    expect(status?.examAccess).not.toBeNull()
  })
})

describe("getMyTransactions (pagination keyset)", () => {
  beforeAll(() => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: uid, role: "user" },
    } as never)
  })

  it("masque les pending ; page suivante, fin de liste, page précédente (tie-break même timestamp)", async () => {
    const page1 = await getMyTransactions({ limit: 2 })
    expect(page1.items).toHaveLength(2)
    expect(page1.firstIndex).toBe(0)
    expect(page1.prevCursor).toBeNull()
    expect(page1.nextCursor).not.toBeNull()

    const page2 = await getMyTransactions({
      after: page1.nextCursor,
      limit: 2,
    })
    expect(page2.firstIndex).toBe(2)
    // Fin de liste : 4 transactions non pending.
    expect(page2.nextCursor).toBeNull()
    expect(page2.prevCursor).not.toBeNull()

    const all = [...page1.items, ...page2.items]
    const ids = all.map((t) => t.id)
    expect(new Set(ids).size).toBe(4)
    expect(ids).not.toContain(pendingTxId)
    expect(ids).not.toContain(otherTxId)
    expect(all.every((t) => t.status !== "pending")).toBe(true)
    // Ordre décroissant strict par createdAt (la plus récente d'abord).
    expect(all[0]?.id).toBe(accessTxId)

    const back = await getMyTransactions({
      before: page2.prevCursor,
      limit: 2,
    })
    expect(back.items.map((t) => t.id)).toEqual(page1.items.map((t) => t.id))
    expect(back.firstIndex).toBe(0)
    expect(back.prevCursor).toBeNull()
    expect(back.nextCursor).toBe(page1.nextCursor)
  })

  it("10 lignes par page par défaut", async () => {
    // Acheteur dédié : 11 transactions, une de plus que la page.
    const buyer = createId()
    await db.insert(user).values({
      id: buyer,
      name: "Acheteur",
      email: `it-${buyer}@test.invalid`,
    })
    await db
      .insert(transactions)
      .values(
        Array.from({ length: 11 }, () =>
          completedTx(createId(), new Date("2025-06-01T00:00:00.000Z"), buyer),
        ),
      )
    vi.mocked(requireSession).mockResolvedValueOnce({
      user: { id: buyer, role: "user" },
    } as never)

    const page = await getMyTransactions()
    expect(page.items).toHaveLength(10)
    expect(page.nextCursor).not.toBeNull()
  })
})

describe("hasActiveAccess (exécuteur en paramètre)", () => {
  it("lit l'échéance réelle de la cible, sans bypass de rôle", async () => {
    const now = Date.now()
    expect(await hasActiveAccess(db, { userId: uid, type: "exam", now })).toBe(
      true,
    )
    expect(
      await hasActiveAccess(db, { userId: uid, type: "training", now }),
    ).toBe(false)
    expect(
      await hasActiveAccess(db, { userId: createId(), type: "exam", now }),
    ).toBe(false)
  })

  it("expire à l'instant exact de l'échéance (borne exclusive)", async () => {
    const [row] = await db
      .select({ expiresAt: userAccess.expiresAt })
      .from(userAccess)
      .where(and(eq(userAccess.userId, uid), eq(userAccess.accessType, "exam")))
    const deadline = row!.expiresAt.getTime()
    expect(
      await hasActiveAccess(db, {
        userId: uid,
        type: "exam",
        now: deadline - 1,
      }),
    ).toBe(true)
    expect(
      await hasActiveAccess(db, { userId: uid, type: "exam", now: deadline }),
    ).toBe(false)
  })

  it("fonctionne depuis une transaction (aucune 2ᵉ connexion du pool)", async () => {
    const inTx = await db.transaction((tx) =>
      hasActiveAccess(tx, { userId: uid, type: "exam", now: Date.now() }),
    )
    expect(inTx).toBe(true)
  })
})
