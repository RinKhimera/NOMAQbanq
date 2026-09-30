import { inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
import {
  type TransactionClientsPage,
  getTransactionClientFile,
  getTransactionClients,
} from "@/features/payments/dal"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))

// La branche éphémère hérite des clients de `develop` : chaque requête filtre
// sur le suffixe unique des comptes semés, et les compteurs des filtres (qui
// portent sur l'ensemble) se lisent en écart à la ligne de base.

const DAY = 24 * 60 * 60 * 1000
const MINUTE = 60 * 1000
const suffix = createId().slice(0, 8)
const pid = createId()
const NOW = Date.now()
// Activité la plus récente d'abord : le client n°0 a agi il y a 1 min, le
// n°k il y a k+1 min.
const at = (rank: number, offsetMs = 0) =>
  new Date(NOW - (rank + 1) * MINUTE + offsetMs)

type Seeded = { id: string; name: string; email: string }
const clients: Seeded[] = Array.from({ length: 23 }, (_, k) => ({
  id: createId(),
  name: `Client ${String(k).padStart(2, "0")} ${suffix}`,
  email: `client-${k}-${suffix}@test.invalid`,
}))
// Rôles des premiers clients (par rang d'activité).
const failOnly = clients[0] // deux échecs, n'a jamais payé
const disputeOpen = clients[1] // litige en cours
const disputeWon = clients[2] // litige gagné
const manualBuyer = clients[3] // paiement manuel
const failedAfterPaid = clients[4] // payé, puis dernière tentative échouée

let baseline: TransactionClientsPage["counts"]

const tx = (
  userId: string,
  createdAt: Date,
  o: Partial<typeof transactions.$inferInsert> = {},
): typeof transactions.$inferInsert => ({
  id: createId(),
  userId,
  productId: pid,
  type: "stripe",
  status: "completed",
  amountPaid: 5000,
  currency: "CAD",
  accessType: "exam",
  durationDays: 30,
  accessExpiresAt: new Date(createdAt.getTime() + 30 * DAY),
  createdAt,
  completedAt: o.status && o.status !== "completed" ? null : createdAt,
  ...o,
})

beforeAll(async () => {
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: "admin", role: "admin" },
  } as never)
  baseline = (await getTransactionClients({})).counts

  await db.insert(user).values(clients)
  await db.insert(products).values({
    id: pid,
    code: "exam_access",
    name: `Examens ${suffix}`,
    description: "d",
    priceCad: 5000,
    durationDays: 30,
    accessType: "exam",
    stripeProductId: `prod_${suffix}`,
    stripePriceId: `price_${suffix}`,
    stripePriceLookupKey: `price_${suffix}`,
  })

  await db.insert(transactions).values([
    tx(failOnly.id, at(0), { status: "failed" }),
    tx(failOnly.id, at(0, -30_000), { status: "failed" }),
    tx(disputeOpen.id, at(1), {
      stripeDisputeId: `dp_open_${suffix}`,
      disputeStatus: "needs_response",
    }),
    tx(disputeWon.id, at(2), {
      stripeDisputeId: `dp_won_${suffix}`,
      disputeStatus: "won",
    }),
    tx(manualBuyer.id, at(3), { type: "manual", paymentMethod: "interac" }),
    tx(failedAfterPaid.id, at(4), { status: "failed" }),
    tx(failedAfterPaid.id, at(4, -DAY)),
    ...clients.slice(5).map((c, k) => tx(c.id, at(k + 5))),
  ])
})

afterAll(async () => {
  const ids = clients.map((c) => c.id)
  await db.delete(userAccess).where(inArray(userAccess.userId, ids))
  await db.delete(transactions).where(inArray(transactions.userId, ids))
  await db.delete(products).where(inArray(products.id, [pid]))
  await db.delete(user).where(inArray(user.id, ids))
})

const ids = (page: TransactionClientsPage) => page.items.map((c) => c.userId)

describe("getTransactionClients — tranches de 20 en keyset", () => {
  it("première tranche : 20 clients par dernière activité décroissante, total « sur N »", async () => {
    const page = await getTransactionClients({ q: suffix })
    expect(ids(page)).toEqual(clients.slice(0, 20).map((c) => c.id))
    expect(page.total).toBe(23)
    expect(page.firstIndex).toBe(0)
    expect(page.prevCursor).toBeNull()
    expect(page.nextCursor).not.toBeNull()
  })

  it("tranche suivante puis précédente, sans doublon ni saut ; fin de liste", async () => {
    const first = await getTransactionClients({ q: suffix })
    const second = await getTransactionClients({
      q: suffix,
      after: first.nextCursor,
    })
    expect(ids(second)).toEqual(clients.slice(20).map((c) => c.id))
    expect(second.firstIndex).toBe(20)
    expect(second.nextCursor).toBeNull()
    expect(second.prevCursor).not.toBeNull()

    const back = await getTransactionClients({
      q: suffix,
      before: second.prevCursor,
    })
    expect(ids(back)).toEqual(ids(first))
    expect(back.firstIndex).toBe(0)
    expect(back.prevCursor).toBeNull()
  })

  it("« around » place la liste sur la tranche du client demandé", async () => {
    const page = await getTransactionClients({
      q: suffix,
      around: clients[21].id,
    })
    expect(page.firstIndex).toBe(20)
    expect(ids(page)).toContain(clients[21].id)
  })

  it("recherche côté serveur sur le nom et le courriel", async () => {
    const byName = await getTransactionClients({ q: `Client 07 ${suffix}` })
    expect(ids(byName)).toEqual([clients[7].id])

    const byEmail = await getTransactionClients({
      q: `client-12-${suffix}@`,
    })
    expect(ids(byEmail)).toEqual([clients[12].id])
    expect(byEmail.total).toBe(1)
  })

  it("filtre Échec : dernière transaction échouée, client qui n'a jamais payé compris", async () => {
    const page = await getTransactionClients({ q: suffix, filter: "failed" })
    expect(ids(page)).toEqual([failOnly.id, failedAfterPaid.id])
    const only = page.items[0]
    expect(only.lastStatus).toBe("failed")
    expect(only.transactionCount).toBe(2)
    expect(only.hasCompleted).toBe(false)
  })

  it("filtre Litige : au moins un litige, quel qu'en soit l'état", async () => {
    const page = await getTransactionClients({ q: suffix, filter: "dispute" })
    expect(ids(page)).toEqual([disputeOpen.id, disputeWon.id])
    expect(page.items.map((c) => c.openDispute)).toEqual([true, false])
  })

  it("filtre Manuel : au moins un paiement manuel", async () => {
    const page = await getTransactionClients({ q: suffix, filter: "manual" })
    expect(ids(page)).toEqual([manualBuyer.id])
  })

  it("compteurs des filtres sur l'ensemble, indépendants de la recherche", async () => {
    const page = await getTransactionClients({ q: "aucun-client-ne-matche" })
    expect(page.items).toEqual([])
    expect(page.total).toBe(0)
    expect(page.counts.failed - baseline.failed).toBe(2)
    expect(page.counts.dispute - baseline.dispute).toBe(2)
    expect(page.counts.manual - baseline.manual).toBe(1)
  })
})

describe("getTransactionClientFile — dossier d'un client", () => {
  it("constat d'échec : série d'échecs et jamais payé", async () => {
    const file = await getTransactionClientFile(failOnly.id)
    expect(file?.verdict).toMatchObject({
      kind: "failed",
      failedStreak: 2,
      everPaid: false,
    })
    expect(file?.transactionCount).toBe(2)
    expect(file?.timeline.items).toHaveLength(2)
  })

  it("le litige en cours prime sur le reste", async () => {
    const file = await getTransactionClientFile(disputeOpen.id)
    expect(file?.verdict.kind).toBe("dispute")
  })

  it("accès lus dans user_access, expiration passée comprise", async () => {
    const past = new Date(NOW - 5 * DAY)
    const [first] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(inArray(transactions.userId, [manualBuyer.id]))
    await db.insert(userAccess).values({
      userId: manualBuyer.id,
      accessType: "exam",
      expiresAt: past,
      lastTransactionId: first.id,
    })

    const file = await getTransactionClientFile(manualBuyer.id)
    expect(file?.access).toEqual({ exam: past.getTime(), training: null })
    expect(file?.verdict).toMatchObject({ kind: "completed", manual: true })
  })

  it("client inconnu → null", async () => {
    expect(await getTransactionClientFile(createId())).toBeNull()
  })
})
