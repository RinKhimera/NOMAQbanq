import { and, eq } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { transactions, user, userAccess } from "@/db/schema"
import {
  type TransactionStatsView,
  getRevenueByDay,
  getTransactionStats,
} from "@/features/payments/dal"
import {
  completeStripeTransaction,
  failStripeTransaction,
  markConfirmationEmailSent,
  recordStripeDispute,
} from "@/features/payments/stripe"
import { toAppZoneCalendarDay } from "@/lib/app-zone"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"
import { seedProduct } from "../helpers/seed-payments"

vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))

const DAY = 24 * 60 * 60 * 1000

let PEXAM = "" // produit exam non-combo
let PCOMBO = "" // produit combo (exam + training)

const newUser = async (over: Partial<typeof user.$inferInsert> = {}) => {
  const id = createId()
  await db.insert(user).values({
    id,
    name: `Stripe ${id}`,
    email: `stripe-${id}@test.invalid`,
    ...over,
  })
  return id
}

const accessOf = (userId: string, accessType: "exam" | "training") =>
  db
    .select({
      expiresAt: userAccess.expiresAt,
      lastTransactionId: userAccess.lastTransactionId,
    })
    .from(userAccess)
    .where(
      and(eq(userAccess.userId, userId), eq(userAccess.accessType, accessType)),
    )
    .limit(1)
    .then((r) => r[0])

const txStatus = (id: string) =>
  db
    .select({
      status: transactions.status,
      completedAt: transactions.completedAt,
      eventId: transactions.stripeEventId,
      pi: transactions.stripePaymentIntentId,
      accessExpiresAt: transactions.accessExpiresAt,
      amountPaid: transactions.amountPaid,
      currency: transactions.currency,
      presentmentAmount: transactions.presentmentAmount,
      presentmentCurrency: transactions.presentmentCurrency,
    })
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1)
    .then((r) => r[0])

const seedPending = (o: {
  id: string
  userId: string
  productId: string
  sessionId: string
  accessType: "exam" | "training"
  durationDays: number
}) =>
  db.insert(transactions).values({
    id: o.id,
    userId: o.userId,
    productId: o.productId,
    type: "stripe",
    status: "pending",
    amountPaid: 5000,
    currency: "CAD",
    stripeSessionId: o.sessionId,
    accessType: o.accessType,
    durationDays: o.durationDays,
    accessExpiresAt: new Date(Date.now() + o.durationDays * DAY),
    createdAt: new Date(),
  })

/** Un pending d'accès examen 90 j, sur un utilisateur neuf. */
const seedExamPending = async () => {
  const userId = await newUser()
  const txId = createId()
  const sessionId = `cs_${txId}`
  await seedPending({
    id: txId,
    userId,
    productId: PEXAM,
    sessionId,
    accessType: "exam",
    durationDays: 90,
  })
  return { userId, txId, sessionId }
}

// Instant de fulfillment injecté : les expirations se comparent à l'exact.
const NOW = new Date("2026-09-18T12:00:00.000Z")
const at = (days: number) => new Date(NOW.getTime() + days * DAY)

beforeAll(async () => {
  PEXAM = await seedProduct("exam_access", { name: "Exam", durationDays: 90 })
  PCOMBO = await seedProduct("premium_access", {
    name: "Combo",
    priceCad: 9000,
    durationDays: 30,
  })
})

describe("completeStripeTransaction", () => {
  // Adaptive Pricing : le client voit des FCFA, l'événement arrive en CAD. Le
  // montant local ne vit que dans `presentment_details` — sans persistance, un
  // client qui écrit « j'ai payé 228 000 FCFA » n'est recoupable par personne.
  it("persiste le montant présenté sans toucher au montant encaissé", async () => {
    const { txId, sessionId } = await seedExamPending()

    await completeStripeTransaction({
      stripeSessionId: sessionId,
      stripePaymentIntentId: "pi_present",
      stripeEventId: "evt_present",
      amountTotal: 5000,
      currency: "cad",
      presentmentAmount: 2280000,
      presentmentCurrency: "xaf",
    })

    const tx = await txStatus(txId)
    expect(tx?.presentmentAmount).toBe(2280000)
    expect(tx?.presentmentCurrency).toBe("XAF")
    // Invariant comptable : l'encaissement reste le CAD.
    expect(tx?.amountPaid).toBe(5000)
    expect(tx?.currency).toBe("CAD")
  })

  it("client sans conversion (pas de presentment_details) → colonnes nulles", async () => {
    const { txId, sessionId } = await seedExamPending()

    await completeStripeTransaction({
      stripeSessionId: sessionId,
      stripePaymentIntentId: "pi_nopresent",
      stripeEventId: "evt_nopresent",
      amountTotal: 5000,
      currency: "cad",
    })

    const tx = await txStatus(txId)
    expect(tx?.presentmentAmount).toBeNull()
    expect(tx?.presentmentCurrency).toBeNull()
    expect(tx?.amountPaid).toBe(5000)
  })

  it("non-combo : complète la transaction et crédite l'accès (now + durée du SNAPSHOT)", async () => {
    const userId = await newUser()
    const txId = createId()
    const sid = "sess_happy"
    // Durée du pending ≠ durée courante du produit (90) : c'est le snapshot de
    // la transaction qui doit être octroyé, pas le catalogue du jour.
    await seedPending({
      id: txId,
      userId,
      productId: PEXAM,
      sessionId: sid,
      accessType: "exam",
      durationDays: 45,
    })

    const res = await completeStripeTransaction({
      stripeSessionId: sid,
      stripePaymentIntentId: "pi_happy",
      stripeEventId: "evt_happy",
      now: NOW,
    })
    expect(res).toMatchObject({ status: "completed", transactionId: txId })

    const tx = await txStatus(txId)
    expect(tx?.status).toBe("completed")
    expect(tx?.completedAt).toEqual(NOW)
    expect(tx?.pi).toBe("pi_happy")
    // Le précalcul du pending est écrasé par le snapshot du fulfillment.
    expect(tx?.accessExpiresAt).toEqual(at(45))

    const acc = await accessOf(userId, "exam")
    expect(acc?.lastTransactionId).toBe(txId)
    expect(acc?.expiresAt).toEqual(at(45))
  })

  it.each([
    { name: "même event rejoué", replayEventId: "evt_first" },
    {
      name: "transaction déjà complétée (autre event)",
      replayEventId: "evt_other",
    },
  ])(
    "idempotent : $name → already_processed, pas de double crédit",
    async ({ replayEventId }) => {
      const { userId, sessionId } = await seedExamPending()
      const deliver = (stripeEventId: string) =>
        completeStripeTransaction({
          stripeSessionId: sessionId,
          stripePaymentIntentId: "pi_idem",
          stripeEventId: `${stripeEventId}_${sessionId}`,
          now: NOW,
        })
      expect((await deliver("evt_first")).status).toBe("completed")

      expect(await deliver(replayEventId)).toEqual({
        status: "already_processed",
      })
      expect((await accessOf(userId, "exam"))?.expiresAt).toEqual(at(90))
    },
  )

  it("combo : crédite exam ET training (now + durée du snapshot)", async () => {
    const userId = await newUser()
    const txId = createId()
    const sid = "sess_combo"
    await seedPending({
      id: txId,
      userId,
      productId: PCOMBO,
      sessionId: sid,
      accessType: "exam",
      durationDays: 15, // produit courant : 30
    })

    const res = await completeStripeTransaction({
      stripeSessionId: sid,
      stripePaymentIntentId: "pi_combo",
      stripeEventId: "evt_combo",
      now: NOW,
    })
    expect(res.status).toBe("completed")

    const exam = await accessOf(userId, "exam")
    const training = await accessOf(userId, "training")
    expect(exam?.expiresAt).toEqual(at(15))
    expect(training?.expiresAt).toEqual(at(15))
    expect(exam?.lastTransactionId).toBe(txId)
    expect(training?.lastTransactionId).toBe(txId)
  })

  it("session inconnue → not_found", async () => {
    const res = await completeStripeTransaction({
      stripeSessionId: "sess_ghost",
      stripePaymentIntentId: "pi_ghost",
      stripeEventId: "evt_ghost",
    })
    expect(res).toEqual({ status: "not_found" })
  })

  it("même événement livré deux fois en même temps → un seul octroi (idempotence sous verrou)", async () => {
    const userId = await newUser()
    const sid = "sess_race"
    await seedPending({
      id: createId(),
      userId,
      productId: PEXAM,
      sessionId: sid,
      accessType: "exam",
      durationDays: 90,
    })
    const delivery = () =>
      completeStripeTransaction({
        stripeSessionId: sid,
        stripePaymentIntentId: "pi_race",
        stripeEventId: "evt_race",
        amountTotal: 5000,
        currency: "cad",
        now: NOW,
      })

    const results = await Promise.all([delivery(), delivery()])

    expect(results.map((r) => r.status).sort()).toEqual([
      "already_processed",
      "completed",
    ])
    const rows = await db
      .select({ expiresAt: userAccess.expiresAt })
      .from(userAccess)
      .where(eq(userAccess.userId, userId))
    expect(rows).toEqual([{ expiresAt: at(90) }])
  })

  it("completed → retourne les données du courriel de confirmation", async () => {
    const userId = await newUser()
    const tx = createId()
    await seedPending({
      id: tx,
      userId,
      productId: PEXAM,
      sessionId: `cs_confirm_${tx}`,
      accessType: "exam",
      durationDays: 90,
    })

    const result = await completeStripeTransaction({
      stripeSessionId: `cs_confirm_${tx}`,
      stripePaymentIntentId: `pi_${tx}`,
      stripeEventId: `evt_confirm_${tx}`,
      amountTotal: 5000,
      currency: "cad",
      presentmentAmount: 2280000,
      presentmentCurrency: "xaf",
      now: NOW,
    })

    expect(result.status).toBe("completed")
    if (result.status !== "completed") return
    expect(result.confirmation).toMatchObject({
      userEmail: `stripe-${userId}@test.invalid`,
      userName: `Stripe ${userId}`,
      productName: "Exam",
      amountPaid: 5000,
      currency: "CAD",
      presentmentAmount: 2280000,
      presentmentCurrency: "XAF",
      completedAt: NOW,
      grantedAccess: [{ accessType: "exam", expiresAt: at(90) }],
    })
  })

  // Un combo pose `now + durée` sur la transaction, mais l'accès exam existant
  // (90 j) est plus long : le courriel doit annoncer la date réelle.
  it("combo par-dessus un accès plus long → grantedAccess porte les expirations effectives", async () => {
    const { userId, sessionId: examSession } = await seedExamPending()
    await completeStripeTransaction({
      stripeSessionId: examSession,
      stripePaymentIntentId: `pi_${examSession}`,
      stripeEventId: `evt_${examSession}`,
      now: NOW,
    })
    const tx = createId()
    await seedPending({
      id: tx,
      userId,
      productId: PCOMBO,
      sessionId: `cs_confirm_combo_${tx}`,
      accessType: "exam",
      durationDays: 30,
    })

    const result = await completeStripeTransaction({
      stripeSessionId: `cs_confirm_combo_${tx}`,
      stripePaymentIntentId: `pi_${tx}`,
      stripeEventId: `evt_confirm_combo_${tx}`,
      now: NOW,
    })

    expect(result.status).toBe("completed")
    if (result.status !== "completed") return
    const byType = Object.fromEntries(
      result.confirmation.grantedAccess.map((a) => [a.accessType, a.expiresAt]),
    )
    expect(byType).toEqual({ exam: at(90), training: at(30) })
  })

  it("compte anonymisé → userEmail null (aucun courriel à envoyer)", async () => {
    const userId = await newUser({ anonymizedAt: new Date() })
    const tx = createId()
    await seedPending({
      id: tx,
      userId,
      productId: PEXAM,
      sessionId: `cs_anon_${tx}`,
      accessType: "exam",
      durationDays: 90,
    })

    const result = await completeStripeTransaction({
      stripeSessionId: `cs_anon_${tx}`,
      stripePaymentIntentId: `pi_${tx}`,
      stripeEventId: `evt_anon_${tx}`,
    })

    expect(result.status).toBe("completed")
    if (result.status !== "completed") return
    expect(result.confirmation.userEmail).toBeNull()
  })
})

describe("failStripeTransaction", () => {
  it("expired : marque la transaction failed", async () => {
    const { userId, txId, sessionId } = await seedExamPending()

    const res = await failStripeTransaction({
      stripeSessionId: sessionId,
      stripeEventId: "evt_fail",
    })
    expect(res).toEqual({ status: "failed", transactionId: txId })
    expect((await txStatus(txId))?.status).toBe("failed")
    // Aucun accès crédité.
    expect(await accessOf(userId, "exam")).toBeUndefined()
  })

  it("ne touche pas une transaction déjà complétée", async () => {
    const { txId, sessionId } = await seedExamPending()
    await completeStripeTransaction({
      stripeSessionId: sessionId,
      stripePaymentIntentId: "pi_fd",
      stripeEventId: "evt_fd_complete",
    })

    const res = await failStripeTransaction({
      stripeSessionId: sessionId,
      stripeEventId: "evt_fd_expire",
    })
    expect(res).toEqual({ status: "already_processed" })
    expect((await txStatus(txId))?.status).toBe("completed")
  })
})

describe("réconciliation montant/devise au fulfillment", () => {
  type Case = {
    name: string
    amountTotal: number | null
    currency: string
    paymentIntent: string
    expected: { amountPaid: number; currency: "CAD" | "XAF"; pi: string | null }
  }
  const cases: Case[] = [
    {
      name: "code promo : amountPaid = montant réellement débité, pas le prix catalogue",
      amountTotal: 4000,
      currency: "cad",
      paymentIntent: "pi_promo",
      expected: { amountPaid: 4000, currency: "CAD", pi: "pi_promo" },
    },
    {
      // Stripe envoie le XAF en zéro-décimal (francs entiers) ; l'app stocke
      // tous les montants en centièmes → 32 500 FCFA doit devenir 3 250 000.
      name: "Adaptive Pricing : devise et montant XAF enregistrés",
      amountTotal: 32500,
      currency: "xaf",
      paymentIntent: "pi_xaf",
      expected: { amountPaid: 3250000, currency: "XAF", pi: "pi_xaf" },
    },
    {
      name: "amount_total null : valeurs provisoires conservées, fulfillment réussi",
      amountTotal: null,
      currency: "cad",
      paymentIntent: "pi_degnull",
      expected: { amountPaid: 5000, currency: "CAD", pi: "pi_degnull" },
    },
    {
      name: "devise hors enum (usd) : valeurs provisoires conservées, fulfillment réussi",
      amountTotal: 4200,
      currency: "usd",
      paymentIntent: "pi_degusd",
      expected: { amountPaid: 5000, currency: "CAD", pi: "pi_degusd" },
    },
    {
      // Une session no_payment_required n'a pas de PaymentIntent → "" côté
      // webhook. 0 ne doit PAS être avalé par la garde de réconciliation
      // (!= null) : le provisoire (5000) serait un sur-rapport de revenus.
      name: "promo 100 % : session à montant nul → completed, amountPaid = 0, accès accordé",
      amountTotal: 0,
      currency: "cad",
      paymentIntent: "",
      expected: { amountPaid: 0, currency: "CAD", pi: null },
    },
  ]
  const fulfilled = new Map<
    string,
    { userId: string; txId: string; sessionId: string; status: string }
  >()

  // Les autres suites du fichier encaissent aussi, dans un ordre tiré au
  // hasard : la ligne de base, prise avant les fulfillments de cette suite,
  // isole sa part.
  let statsBefore: TransactionStatsView
  let revenueTodayBefore: { CAD: number; XAF: number }
  // Jour de l'Est, comme les buckets de getRevenueByDay : en UTC, la soirée
  // québécoise est déjà le lendemain et le bucket cherché n'existerait pas.
  const today = () => toAppZoneCalendarDay(Date.now())

  const revenueOfToday = async () => {
    const rev = await getRevenueByDay(1)
    return {
      CAD: rev.CAD.find((d) => d.date === today())?.revenue ?? 0,
      XAF: rev.XAF.find((d) => d.date === today())?.revenue ?? 0,
    }
  }

  beforeAll(async () => {
    vi.mocked(requireRole).mockResolvedValue({
      user: { id: "admin", role: "admin" },
    } as never)
    statsBefore = await getTransactionStats()
    revenueTodayBefore = await revenueOfToday()

    for (const c of cases) {
      const seeded = await seedExamPending()
      const res = await completeStripeTransaction({
        stripeSessionId: seeded.sessionId,
        stripePaymentIntentId: c.paymentIntent,
        stripeEventId: `evt_${seeded.sessionId}`,
        amountTotal: c.amountTotal,
        currency: c.currency,
      })
      fulfilled.set(c.name, { ...seeded, status: res.status })
    }
  })

  it.each(cases)("$name", async ({ name, expected }) => {
    const { userId, txId, status } = fulfilled.get(name)!
    expect(status).toBe("completed")

    const tx = await txStatus(txId)
    expect({
      status: tx?.status,
      amountPaid: tx?.amountPaid,
      currency: tx?.currency,
      pi: tx?.pi,
    }).toEqual({ status: "completed", ...expected })
    expect((await accessOf(userId, "exam"))?.lastTransactionId).toBe(txId)
  })

  it("agrégats : promo et XAF ventilés sur le montant réel", async () => {
    // CAD = 4000 (promo) + 5000 + 5000 (cas dégradés conservés) + 0 ; XAF =
    // 32 500 FCFA en centièmes.
    const after = await getTransactionStats()
    expect(
      after.revenueByCurrency.CAD.total -
        statsBefore.revenueByCurrency.CAD.total,
    ).toBe(14000)
    expect(
      after.revenueByCurrency.XAF.total -
        statsBefore.revenueByCurrency.XAF.total,
    ).toBe(3250000)

    const revenueToday = await revenueOfToday()
    expect(revenueToday.CAD - revenueTodayBefore.CAD).toBe(14000)
    expect(revenueToday.XAF - revenueTodayBefore.XAF).toBe(3250000)
  })

  it("idempotence : rejouer l'event ne réapplique pas la réconciliation", async () => {
    const { txId, sessionId } = fulfilled.get(cases[0].name)!
    const res = await completeStripeTransaction({
      stripeSessionId: sessionId,
      stripePaymentIntentId: "pi_promo",
      stripeEventId: `evt_${sessionId}`,
      amountTotal: 999,
      currency: "cad",
    })
    expect(res).toEqual({ status: "already_processed" })
    expect((await txStatus(txId))?.amountPaid).toBe(4000)
  })
})

describe("recordStripeDispute", () => {
  const disputeOf = (id: string) =>
    db
      .select({
        disputeId: transactions.stripeDisputeId,
        disputeStatus: transactions.disputeStatus,
      })
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1)
      .then((r) => r[0])

  const seedCompleted = async () => {
    const { txId } = await seedExamPending()
    await db
      .update(transactions)
      .set({ status: "completed", stripePaymentIntentId: `pi_${txId}` })
      .where(eq(transactions.id, txId))
    return txId
  }

  it("pose l'id et le statut du litige sur la transaction du payment_intent", async () => {
    const tx = await seedCompleted()

    const result = await recordStripeDispute({
      stripePaymentIntentId: `pi_${tx}`,
      stripeDisputeId: "dp_1",
      disputeStatus: "needs_response",
    })

    expect(result).toEqual({ status: "recorded" })
    expect(await disputeOf(tx)).toEqual({
      disputeId: "dp_1",
      disputeStatus: "needs_response",
    })
  })

  // L'ordre de livraison des événements n'est pas garanti, et Stripe documente
  // « plusieurs litiges par paiement ».
  it.each([
    {
      name: "même litige : un statut non terminal n'écrase jamais un terminal",
      first: { id: "dp_2", status: "won" },
      second: { id: "dp_2", status: "under_review" },
      result: "kept",
      final: { disputeId: "dp_2", disputeStatus: "won" },
    },
    {
      // Un litige clos ne doit jamais masquer un nouveau chargeback vivant.
      name: "second litige sur le même paiement : remplace le précédent, même clos",
      first: { id: "dp_first", status: "won" },
      second: { id: "dp_second", status: "needs_response" },
      result: "recorded",
      final: { disputeId: "dp_second", disputeStatus: "needs_response" },
    },
    {
      // Miroir du cas précédent : un `closed` d'un ANCIEN litige, rejoué en
      // retard (retry Stripe après un 500), ne masque pas le chargeback en cours.
      name: "clôture tardive d'un ancien litige : n'écrase pas un litige vivant",
      first: { id: "dp_live", status: "needs_response" },
      second: { id: "dp_old", status: "won" },
      result: "kept",
      final: { disputeId: "dp_live", disputeStatus: "needs_response" },
    },
    {
      name: "nouveau litige déjà clos (prevented) par-dessus un ancien clos : remplace",
      first: { id: "dp_first", status: "lost" },
      second: { id: "dp_next", status: "prevented" },
      result: "recorded",
      final: { disputeId: "dp_next", disputeStatus: "prevented" },
    },
    {
      name: "un statut terminal remplace un non terminal",
      first: { id: "dp_3", status: "under_review" },
      second: { id: "dp_3", status: "lost" },
      result: "recorded",
      final: { disputeId: "dp_3", disputeStatus: "lost" },
    },
  ])("$name", async ({ first, second, result, final }) => {
    const tx = await seedCompleted()
    await recordStripeDispute({
      stripePaymentIntentId: `pi_${tx}`,
      stripeDisputeId: first.id,
      disputeStatus: first.status,
    })

    const res = await recordStripeDispute({
      stripePaymentIntentId: `pi_${tx}`,
      stripeDisputeId: second.id,
      disputeStatus: second.status,
    })

    expect(res).toEqual({ status: result })
    expect(await disputeOf(tx)).toEqual(final)
  })

  it("payment_intent inconnu → not_found, rien d'écrit", async () => {
    const result = await recordStripeDispute({
      stripePaymentIntentId: "pi_inconnu",
      stripeDisputeId: "dp_4",
      disputeStatus: "needs_response",
    })
    expect(result).toEqual({ status: "not_found" })
  })

  // Un litige peut précéder le fulfillment (carte de test 0259, paiement
  // différé) : la transaction est encore `pending`, sans payment_intent. La
  // session Checkout, elle, est connue dès la création du pending.
  it("transaction encore pending (sans payment_intent) → rattachée par la session Checkout", async () => {
    const { txId: tx, sessionId } = await seedExamPending()

    const byIntent = await recordStripeDispute({
      stripePaymentIntentId: `pi_${tx}`,
      stripeDisputeId: "dp_early",
      disputeStatus: "needs_response",
    })
    expect(byIntent).toEqual({ status: "not_found" })

    const bySession = await recordStripeDispute({
      stripePaymentIntentId: `pi_${tx}`,
      stripeSessionId: sessionId,
      stripeDisputeId: "dp_early",
      disputeStatus: "needs_response",
    })
    expect(bySession).toEqual({ status: "recorded" })
    expect(await disputeOf(tx)).toEqual({
      disputeId: "dp_early",
      disputeStatus: "needs_response",
    })
    // Le payment_intent est posé au passage : le fulfillment le réécrira à
    // l'identique, et les événements suivants du litige le retrouveront.
    expect((await txStatus(tx))?.pi).toBe(`pi_${tx}`)
  })
})

describe("markConfirmationEmailSent", () => {
  it("pose le MessageId et l'horodatage d'envoi", async () => {
    const { txId: tx } = await seedExamPending()

    await markConfirmationEmailSent({ transactionId: tx, messageId: "ses-123" })

    const [row] = await db
      .select({
        messageId: transactions.confirmationEmailMessageId,
        sentAt: transactions.confirmationEmailSentAt,
      })
      .from(transactions)
      .where(eq(transactions.id, tx))
      .limit(1)
    expect(row.messageId).toBe("ses-123")
    expect(row.sentAt).toBeInstanceOf(Date)
  })
})
