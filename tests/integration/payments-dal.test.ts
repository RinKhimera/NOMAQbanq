import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
import { createId } from "@/lib/ids"

// `cache()` de React → identité (pas de contexte RSC en test node).
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
// Session mockée : on isole la logique DB.
vi.mock("@/lib/auth-guards", () => ({ requireSession: vi.fn() }))

import { getAccessStatus, getMyTransactions } from "@/features/payments/dal"
import { requireSession } from "@/lib/auth-guards"

const DAY = 24 * 60 * 60 * 1000
const uid = createId()
const pid = createId()
const sameTsIds = [createId(), createId(), createId()]
const pendingTxId = createId()
const accessTxId = createId()

beforeAll(async () => {
  await db
    .insert(user)
    .values({ id: uid, name: "IT User", email: `it-${uid}@test.invalid` })
  await db.insert(products).values({
    id: pid,
    code: "exam_access",
    name: "Exam",
    description: "desc",
    priceCad: 5000,
    durationDays: 90,
    accessType: "exam",
    stripeProductId: "prod_it",
    stripePriceId: "price_it",
  })

  // 3 transactions complétées au MÊME createdAt → force le tie-break (createdAt, id)
  // du curseur keyset (c'est exactement le scénario du correctif H2).
  const sameTs = new Date("2026-01-01T00:00:00.000Z")
  for (const id of sameTsIds) {
    await db.insert(transactions).values({
      id,
      userId: uid,
      productId: pid,
      type: "manual",
      status: "completed",
      amountPaid: 5000,
      currency: "CAD",
      accessType: "exam",
      durationDays: 90,
      accessExpiresAt: new Date(Date.now() + 90 * DAY),
      createdAt: sameTs,
    })
  }
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
  // Accès exam actif, training expiré.
  await db.insert(userAccess).values([
    {
      userId: uid,
      accessType: "exam",
      expiresAt: new Date(Date.now() + 10 * DAY),
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

afterAll(async () => {
  await db.delete(userAccess).where(eq(userAccess.userId, uid))
  await db.delete(transactions).where(eq(transactions.userId, uid))
  await db.delete(products).where(eq(products.id, pid))
  await db.delete(user).where(eq(user.id, uid))
})

describe("getAccessStatus", () => {
  it("retourne l'accès exam actif et ignore le training expiré", async () => {
    const status = await getAccessStatus(uid)
    expect(status).not.toBeNull()
    expect(status?.examAccess).not.toBeNull()
    expect(status?.examAccess?.daysRemaining).toBeGreaterThan(0)
    expect(status?.trainingAccess).toBeNull()
  })
})

describe("getMyTransactions (pagination keyset)", () => {
  beforeAll(() => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: uid, role: "user" },
    } as never)
  })

  it("masque les pending et pagine sans doublon ni saut (tie-break même timestamp)", async () => {
    const page1 = await getMyTransactions({ limit: 2 })
    expect(page1.items).toHaveLength(2)
    expect(page1.nextCursor).not.toBeNull()

    const page2 = await getMyTransactions({ cursor: page1.nextCursor, limit: 2 })

    const all = [...page1.items, ...page2.items]
    const ids = all.map((t) => t.id)
    // 4 transactions non-pending → 2 + 2, aucun doublon, pending exclue.
    expect(new Set(ids).size).toBe(4)
    expect(ids).not.toContain(pendingTxId)
    expect(all.every((t) => t.status !== "pending")).toBe(true)
    // Ordre décroissant strict par createdAt (la plus récente d'abord).
    expect(all[0]?.id).toBe(accessTxId)
  })
})
