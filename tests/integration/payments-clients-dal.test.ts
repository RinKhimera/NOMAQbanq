import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { transactions, user, userAccess } from "@/db/schema"
import {
  type TransactionClientsPage,
  getFailedClientsCount,
  getTransactionClientFile,
  getTransactionClients,
} from "@/features/payments/dal"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"
import { seedProduct } from "../helpers/seed-payments"

vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))

const DAY = 24 * 60 * 60 * 1000
const MINUTE = 60 * 1000
let pid = ""
const NOW = Date.now()
// Activité la plus récente d'abord : le client n°0 a agi il y a 1 min, le
// n°k il y a k+1 min.
const at = (rank: number, offsetMs = 0) =>
  new Date(NOW - (rank + 1) * MINUTE + offsetMs)

type Seeded = { id: string; name: string; email: string }
const clients: Seeded[] = Array.from({ length: 23 }, (_, k) => ({
  id: createId(),
  name: `Client ${String(k).padStart(2, "0")}`,
  email: `client-${k}@test.invalid`,
}))
// Rôles des premiers clients (par rang d'activité).
const failOnly = clients[0] // deux échecs, n'a jamais payé
const disputeOpen = clients[1] // litige en cours
const disputeWon = clients[2] // litige gagné
const manualBuyer = clients[3] // paiement manuel
const failedAfterPaid = clients[4] // payé, puis dernière tentative échouée

// Clients d'il y a dix jours, donc classés après les 23 ci-dessus : ils
// complètent la 2ᵉ tranche sans entrer dans aucun filtre.
const HOUR = 60 * MINUTE
const base = NOW - 10 * DAY
const lateSuccess = { id: createId(), name: "Tard" }
const pendingMany = { id: createId(), name: "Attente" }
const refundedOnly = { id: createId(), name: "Rembourse" }
const manyIds = Array.from({ length: 12 }, () => createId())
// Dernière activité = dernière création : Attente (base + 12 h), Tard
// (base + 5 min), Rembourse (base).
const byActivity = [...clients, pendingMany, lateSuccess, refundedOnly]

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

  await db.insert(user).values([
    ...clients,
    ...[lateSuccess, pendingMany, refundedOnly].map((u) => ({
      ...u,
      email: `${u.name.toLowerCase()}@test.invalid`,
    })),
  ])
  pid = await seedProduct("exam_access")

  await db.insert(transactions).values([
    tx(failOnly.id, at(0), { status: "failed" }),
    tx(failOnly.id, at(0, -30_000), { status: "failed" }),
    tx(disputeOpen.id, at(1), {
      stripeDisputeId: "dp_open",
      disputeStatus: "needs_response",
    }),
    tx(disputeWon.id, at(2), {
      stripeDisputeId: "dp_won",
      disputeStatus: "won",
    }),
    tx(manualBuyer.id, at(3), { type: "manual", paymentMethod: "interac" }),
    tx(failedAfterPaid.id, at(4), { status: "failed" }),
    tx(failedAfterPaid.id, at(4, -DAY)),
    ...clients.slice(5).map((c, k) => tx(c.id, at(k + 5))),
    // S1 créé à 10 h, payé à 10 h 10 ; S2 créé à 10 h 05, abandonné.
    tx(lateSuccess.id, new Date(base), {
      completedAt: new Date(base + 10 * MINUTE),
    }),
    tx(lateSuccess.id, new Date(base + 5 * MINUTE), { status: "failed" }),
    // 11 paiements aboutis puis un checkout en cours, le plus récent.
    ...manyIds.map((id, k) =>
      tx(pendingMany.id, new Date(base + (k + 1) * HOUR), {
        id,
        ...(k === 11 ? { status: "pending" as const } : {}),
      }),
    ),
    tx(refundedOnly.id, new Date(base), {
      status: "refunded",
      completedAt: new Date(base),
      refundedAt: new Date(base + DAY),
    }),
  ])
})

const ids = (page: TransactionClientsPage) => page.items.map((c) => c.userId)

describe("getTransactionClients — tranches de 20 en keyset", () => {
  it("première tranche : 20 clients par dernière activité décroissante, total « sur N »", async () => {
    const page = await getTransactionClients({})
    expect(ids(page)).toEqual(byActivity.slice(0, 20).map((c) => c.id))
    expect(page.total).toBe(26)
    expect(page.firstIndex).toBe(0)
    expect(page.prevCursor).toBeNull()
    expect(page.nextCursor).not.toBeNull()
  })

  it("tranche suivante puis précédente, sans doublon ni saut ; fin de liste", async () => {
    const first = await getTransactionClients({})
    const second = await getTransactionClients({
      after: first.nextCursor,
    })
    expect(ids(second)).toEqual(byActivity.slice(20).map((c) => c.id))
    expect(second.firstIndex).toBe(20)
    expect(second.nextCursor).toBeNull()
    expect(second.prevCursor).not.toBeNull()

    const back = await getTransactionClients({
      before: second.prevCursor,
    })
    expect(ids(back)).toEqual(ids(first))
    expect(back.firstIndex).toBe(0)
    expect(back.prevCursor).toBeNull()
  })

  it("changer de filtre depuis la 2ᵉ tranche ramène en tête de liste", async () => {
    const first = await getTransactionClients({})
    const second = await getTransactionClients({
      after: first.nextCursor,
    })
    expect(second.firstIndex).toBe(20)

    // Changer de filtre repart sans curseur (l'écran retire `apres`/`avant`) :
    // première tranche du nouveau filtre, pas de tranche précédente.
    const filtered = await getTransactionClients({
      filter: "failed",
    })
    expect(filtered.firstIndex).toBe(0)
    expect(filtered.prevCursor).toBeNull()
    expect(ids(filtered)).toEqual([failOnly.id, failedAfterPaid.id])
  })

  it("« around » place la liste sur la tranche du client demandé", async () => {
    const page = await getTransactionClients({
      around: clients[21].id,
    })
    expect(page.firstIndex).toBe(20)
    expect(ids(page)).toContain(clients[21].id)
  })

  it("recherche côté serveur sur le nom et le courriel", async () => {
    const byName = await getTransactionClients({ q: "Client 07" })
    expect(ids(byName)).toEqual([clients[7].id])

    const byEmail = await getTransactionClients({ q: "client-12@" })
    expect(ids(byEmail)).toEqual([clients[12].id])
    expect(byEmail.total).toBe(1)
  })

  it("filtre Échec : dernière transaction échouée, client qui n'a jamais payé compris", async () => {
    const page = await getTransactionClients({ filter: "failed" })
    expect(ids(page)).toEqual([failOnly.id, failedAfterPaid.id])
    const only = page.items[0]
    expect(only.lastStatus).toBe("failed")
    expect(only.transactionCount).toBe(2)
  })

  it("filtre Litige : au moins un litige, quel qu'en soit l'état", async () => {
    const page = await getTransactionClients({ filter: "dispute" })
    expect(ids(page)).toEqual([disputeOpen.id, disputeWon.id])
    expect(page.items.map((c) => c.openDispute)).toEqual([true, false])
  })

  it("filtre Manuel : au moins un paiement manuel", async () => {
    const page = await getTransactionClients({ filter: "manual" })
    expect(ids(page)).toEqual([manualBuyer.id])
  })

  it("compteurs des filtres sur l'ensemble, indépendants de la recherche", async () => {
    const page = await getTransactionClients({ q: "aucun-client-ne-matche" })
    expect(page.items).toEqual([])
    expect(page.total).toBe(0)
    expect(page.counts).toEqual({ failed: 2, dispute: 2, manual: 1 })
    // L'alerte du tableau de bord compte comme le filtre Échec.
    expect(await getFailedClientsCount()).toBe(page.counts.failed)
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
      .where(eq(transactions.userId, manualBuyer.id))
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

describe("getTransactionClientFile — constats et lien direct", () => {
  it("un paiement abouti après une tentative créée plus tard reste le dernier événement", async () => {
    const file = await getTransactionClientFile(lateSuccess.id)
    expect(file?.verdict).toMatchObject({ kind: "completed", manual: false })
    const page = await getTransactionClients({ q: "Tard", filter: "failed" })
    expect(page.items).toEqual([])
    const all = await getTransactionClients({ q: "Tard" })
    expect(all.items[0]?.lastStatus).toBe("completed")
  })

  it("dernier paiement en attente : constat « en attente »", async () => {
    const file = await getTransactionClientFile(pendingMany.id)
    expect(file?.verdict.kind).toBe("pending")
    expect(file?.timeline.items).toHaveLength(8)
  })

  it("lien direct vers la 10ᵉ transaction : la chronologie s'étend jusqu'à elle", async () => {
    // Rang 10 depuis la plus récente = le 3ᵉ paiement créé.
    const file = await getTransactionClientFile(pendingMany.id, {
      throughTransactionId: manyIds[2],
    })
    expect(file?.timeline.items.map((t) => t.id)).toContain(manyIds[2])
    expect(file?.timeline.items).toHaveLength(12)
  })

  it("seul paiement remboursé : constat daté, accès retiré et non « jamais acheté »", async () => {
    const file = await getTransactionClientFile(refundedOnly.id)
    expect(file?.verdict).toEqual({
      kind: "refunded",
      refundedAt: base + DAY,
    })
    expect(file?.access.exam).toBeNull()
    expect(file?.refunded).toEqual({ exam: true, training: false })
    expect(file?.client.deleted).toBe(false)
  })
})
