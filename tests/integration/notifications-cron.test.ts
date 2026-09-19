import { eq, sql } from "drizzle-orm"
import { readFileSync } from "node:fs"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  examQuestions,
  exams,
  products,
  questions,
  session,
  trainingSessions,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import {
  claimAccessExpiryReminder,
  sendAccessExpiryReminders,
  sendExamResultsNotifications,
  sendInactivityReminders,
} from "@/features/notifications/cron"
import { grantManualAccess } from "@/features/payments/lib"
import { completeStripeTransaction } from "@/features/payments/stripe"
import { createId } from "@/lib/ids"
import { fakeMailer } from "../helpers/fake-mailer"

vi.mock("@/email", () =>
  import("../helpers/fake-mailer").then((m) => m.fakeMailer),
)
const examResults = fakeMailer.sendExamResultsEmail
const accessExpiring = fakeMailer.sendAccessExpiringEmail
const inactivity = fakeMailer.sendInactivityReminderEmail

const creator = createId()
const optIn = createId()
const optOut = createId()
// Score retenu : une réponse de l'examen clos chevauche un examen ouvert où
// l'utilisateur participe → le courriel ne doit pas imprimer le score.
const optInLocked = createId()
const lockedQuestion = createId()
const lockedClosedPart = createId()
const closedExam = createId()
const openExam = createId()
const now = Date.now()
const past = new Date(now - 86400000)
const future = new Date(now + 86400000)

beforeAll(async () => {
  await db.insert(user).values([
    { id: creator, name: "Créateur", email: `c-${creator}@test.invalid` },
    { id: optIn, name: "Opt In", email: `in-${optIn}@test.invalid` },
    {
      id: optInLocked,
      name: "Opt In Retenu",
      email: `lock-${optInLocked}@test.invalid`,
    },
    {
      id: optOut,
      name: "Opt Out",
      email: `out-${optOut}@test.invalid`,
      notifyExamResults: false,
    },
  ])
  await db.insert(exams).values([
    {
      id: closedExam,
      title: "Examen Clos",
      startDate: past,
      endDate: past,
      completionTime: 3600,
      createdBy: creator,
    },
    {
      id: openExam,
      title: "Examen Ouvert",
      startDate: past,
      endDate: future,
      completionTime: 3600,
      createdBy: creator,
    },
  ])
  await db.insert(examParticipations).values([
    {
      id: createId(),
      examId: closedExam,
      userId: optIn,
      score: 80,
      status: "completed",
      completedAt: past,
    },
    {
      id: createId(),
      examId: closedExam,
      userId: optOut,
      score: 50,
      status: "auto_submitted",
      completedAt: past,
    },
    {
      id: createId(),
      examId: openExam,
      userId: optIn,
      score: 90,
      status: "completed",
      completedAt: past,
    },
    {
      id: lockedClosedPart,
      examId: closedExam,
      userId: optInLocked,
      score: 60,
      status: "completed",
      completedAt: past,
    },
    {
      id: createId(),
      examId: openExam,
      userId: optInLocked,
      score: 0,
      status: "in_progress",
      startedAt: past,
    },
  ])
  await db.insert(questions).values({
    id: lockedQuestion,
    question: `Q retenue ${lockedQuestion} ?`,
    correctAnswer: "A",
    options: ["A", "B", "C", "D"],
    objectifCmc: "Obj notif",
    domain: "NOTIF",
  })
  await db.insert(examQuestions).values([
    { examId: closedExam, questionId: lockedQuestion, position: 0 },
    { examId: openExam, questionId: lockedQuestion, position: 0 },
  ])
  await db.insert(examAnswers).values({
    id: createId(),
    participationId: lockedClosedPart,
    questionId: lockedQuestion,
    selectedAnswer: "A",
    isCorrect: true,
  })
})

afterAll(async () => {
  await db.delete(examAnswers).where(eq(examAnswers.questionId, lockedQuestion))
  await db
    .delete(examQuestions)
    .where(eq(examQuestions.questionId, lockedQuestion))
  await db
    .delete(examParticipations)
    .where(eq(examParticipations.examId, closedExam))
  await db
    .delete(examParticipations)
    .where(eq(examParticipations.examId, openExam))
  await db.delete(exams).where(eq(exams.id, closedExam))
  await db.delete(exams).where(eq(exams.id, openExam))
  await db.delete(questions).where(eq(questions.id, lockedQuestion))
  await db.delete(user).where(eq(user.id, optInLocked))
  await db.delete(user).where(eq(user.id, creator))
  await db.delete(user).where(eq(user.id, optIn))
  await db.delete(user).where(eq(user.id, optOut))
})

describe("sendExamResultsNotifications", () => {
  it("envoie aux opt-in d'examens clos, marque tout, ignore les examens ouverts", async () => {
    // Le balayage est GLOBAL (toute la branche Neon) → on n'assert PAS de compteur
    // absolu (d'autres fichiers de test créent des participations éligibles), mais
    // l'effet précis sur NOS fixtures.
    await sendExamResultsNotifications()

    // Opt-in de l'examen clos : email envoyé ; opt-out : jamais.
    expect(examResults).toHaveBeenCalledWith(
      expect.objectContaining({
        to: `in-${optIn}@test.invalid`,
        name: "Opt In",
        score: 80,
      }),
    )
    expect(examResults).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: `out-${optOut}@test.invalid` }),
    )
    // Score retenu pour son propriétaire : courriel envoyé, sans chiffre.
    expect(examResults).toHaveBeenCalledWith(
      expect.objectContaining({
        to: `lock-${optInLocked}@test.invalid`,
        score: null,
      }),
    )

    // Marqueur posé sur les 2 participations de l'examen CLOS (opt-in + opt-out) ;
    // PAS sur l'examen OUVERT (résultats encore bloqués → non éligible).
    const closed = await db
      .select({ notifiedAt: examParticipations.resultsNotifiedAt })
      .from(examParticipations)
      .where(eq(examParticipations.examId, closedExam))
    expect(closed).toHaveLength(3)
    expect(closed.every((r) => r.notifiedAt !== null)).toBe(true)

    const openRow = await db
      .select({ notifiedAt: examParticipations.resultsNotifiedAt })
      .from(examParticipations)
      .where(eq(examParticipations.examId, openExam))
      .limit(1)
    expect(openRow[0]?.notifiedAt).toBeNull()
  })
})

describe("sendAccessExpiryReminders", () => {
  it("envoie pour un accès ≤ 7 j, marque, 2e run no-op", async () => {
    const uid = createId()
    const pid = createId()
    const tid = createId()
    await db.insert(user).values({
      id: uid,
      name: "Accès",
      email: `acc-${uid}@test.invalid`,
    })
    await db.insert(products).values({
      id: pid,
      code: "exam_access",
      name: "Examens",
      description: "Accès examens",
      priceCad: 1000,
      durationDays: 180,
      accessType: "exam",
      stripeProductId: `prod_${pid}`,
      stripePriceId: `price_${pid}`,
      stripePriceLookupKey: `price_${pid}`,
    })
    await db.insert(transactions).values({
      id: tid,
      userId: uid,
      productId: pid,
      type: "manual",
      status: "completed",
      amountPaid: 1000,
      currency: "CAD",
      accessType: "exam",
      durationDays: 180,
      accessExpiresAt: new Date(now + 5 * 86400000),
    })
    await db.insert(userAccess).values({
      userId: uid,
      accessType: "exam",
      expiresAt: new Date(now + 5 * 86400000), // dans 5 j → ≤ 7 j
      lastTransactionId: tid,
    })

    accessExpiring.mockClear()
    const sent = await sendAccessExpiryReminders()
    expect(sent).toBeGreaterThanOrEqual(1)
    expect(accessExpiring).toHaveBeenCalledWith(
      expect.objectContaining({
        to: `acc-${uid}@test.invalid`,
        name: "Accès",
        accessType: "exam",
      }),
    )

    accessExpiring.mockClear()
    await sendAccessExpiryReminders()
    // Le nôtre est déjà marqué → il ne renvoie pas (d'autres lignes du run global
    // peuvent exister, mais pas la nôtre).
    expect(accessExpiring).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: `acc-${uid}@test.invalid` }),
    )

    await db.delete(userAccess).where(eq(userAccess.userId, uid))
    await db.delete(transactions).where(eq(transactions.id, tid))
    await db.delete(products).where(eq(products.id, pid))
    await db.delete(user).where(eq(user.id, uid))
  })
})

describe("claimAccessExpiryReminder", () => {
  const seedAccess = async (expiresAt: Date) => {
    const uid = createId()
    const pid = createId()
    const tid = createId()
    await db.insert(user).values({
      id: uid,
      name: "Claim",
      email: `claim-${uid}@test.invalid`,
    })
    await db.insert(products).values({
      id: pid,
      code: "exam_access",
      name: "Examens",
      description: "Accès examens",
      priceCad: 1000,
      durationDays: 180,
      accessType: "exam",
      stripeProductId: `prod_${pid}`,
      stripePriceId: `price_${pid}`,
      stripePriceLookupKey: `price_${pid}`,
    })
    await db.insert(transactions).values({
      id: tid,
      userId: uid,
      productId: pid,
      type: "manual",
      status: "completed",
      amountPaid: 1000,
      currency: "CAD",
      accessType: "exam",
      durationDays: 180,
      accessExpiresAt: expiresAt,
    })
    const [access] = await db
      .insert(userAccess)
      .values({
        userId: uid,
        accessType: "exam",
        expiresAt,
        lastTransactionId: tid,
      })
      .returning({ id: userAccess.id })
    const cleanup = async () => {
      await db.delete(userAccess).where(eq(userAccess.userId, uid))
      await db.delete(transactions).where(eq(transactions.id, tid))
      await db.delete(products).where(eq(products.id, pid))
      await db.delete(user).where(eq(user.id, uid))
    }
    const marker = async () => {
      const [row] = await db
        .select({ marker: userAccess.expiryReminderSentAt })
        .from(userAccess)
        .where(eq(userAccess.id, access.id))
        .limit(1)
      return row?.marker ?? null
    }
    return { accessId: access.id, cleanup, marker }
  }

  it("échéance inchangée depuis la lecture : claim posé, une seule fois", async () => {
    const expiresAt = new Date(now + 5 * 86400000)
    const a = await seedAccess(expiresAt)
    const claimAt = new Date(now)

    expect(
      await claimAccessExpiryReminder({
        accessId: a.accessId,
        expiresAt,
        now: claimAt,
      }),
    ).toBe(true)
    expect(await a.marker()).toEqual(claimAt)
    expect(
      await claimAccessExpiryReminder({
        accessId: a.accessId,
        expiresAt,
        now: claimAt,
      }),
    ).toBe(false)

    await a.cleanup()
  })

  it("échéance prolongée entre la lecture et le claim : refusé, marqueur intact (le prochain run rappellera la nouvelle échéance)", async () => {
    const readExpiresAt = new Date(now + 5 * 86400000)
    const a = await seedAccess(readExpiresAt)
    // Un renouvellement concurrent (applyGrant) a fait avancer l'expiration et
    // ré-armé le marqueur après le SELECT du cron.
    await db
      .update(userAccess)
      .set({
        expiresAt: new Date(now + 35 * 86400000),
        expiryReminderSentAt: null,
      })
      .where(eq(userAccess.id, a.accessId))

    expect(
      await claimAccessExpiryReminder({
        accessId: a.accessId,
        expiresAt: readExpiresAt,
        now: new Date(now),
      }),
    ).toBe(false)
    expect(await a.marker()).toBeNull()

    await a.cleanup()
  })
})

describe("reset du marqueur de rappel au renouvellement", () => {
  it("completeStripeTransaction (Stripe) remet expiryReminderSentAt à null", async () => {
    const uid = createId()
    const pid = createId()
    const oldTid = createId()
    const newTid = createId()
    const sessionId = `cs_test_${uid}`
    await db.insert(user).values({
      id: uid,
      name: "Renew Stripe",
      email: `renew-stripe-${uid}@test.invalid`,
    })
    await db.insert(products).values({
      id: pid,
      code: "exam_access",
      name: "Examens",
      description: "Accès examens",
      priceCad: 1000,
      durationDays: 180,
      accessType: "exam",
      stripeProductId: `prod_${pid}`,
      stripePriceId: `price_${pid}`,
      stripePriceLookupKey: `price_${pid}`,
    })
    // Transaction initiale + accès existant DÉJÀ notifié (marqueur posé).
    await db.insert(transactions).values({
      id: oldTid,
      userId: uid,
      productId: pid,
      type: "manual",
      status: "completed",
      amountPaid: 1000,
      currency: "CAD",
      accessType: "exam",
      durationDays: 180,
      accessExpiresAt: new Date(now + 2 * 86400000),
    })
    await db.insert(userAccess).values({
      userId: uid,
      accessType: "exam",
      expiresAt: new Date(now + 2 * 86400000),
      lastTransactionId: oldTid,
      expiryReminderSentAt: new Date(now - 86400000),
    })
    // Nouvelle transaction Stripe PENDING (le webhook la complète = renouvellement).
    await db.insert(transactions).values({
      id: newTid,
      userId: uid,
      productId: pid,
      type: "stripe",
      status: "pending",
      amountPaid: 1000,
      currency: "CAD",
      accessType: "exam",
      durationDays: 180,
      accessExpiresAt: new Date(now + 180 * 86400000),
      stripeSessionId: sessionId,
    })

    const res = await completeStripeTransaction({
      stripeSessionId: sessionId,
      stripePaymentIntentId: `pi_${uid}`,
      stripeEventId: `evt_${uid}`,
    })
    expect(res.status).toBe("completed")

    const [row] = await db
      .select({ marker: userAccess.expiryReminderSentAt })
      .from(userAccess)
      .where(eq(userAccess.userId, uid))
      .limit(1)
    expect(row?.marker).toBeNull()

    // FK restrict : userAccess avant transactions.
    await db.delete(userAccess).where(eq(userAccess.userId, uid))
    await db.delete(transactions).where(eq(transactions.userId, uid))
    await db.delete(products).where(eq(products.id, pid))
    await db.delete(user).where(eq(user.id, uid))
  })

  it("grantManualAccess (manuel) remet expiryReminderSentAt à null", async () => {
    const uid = createId()
    const pid = createId()
    const oldTid = createId()
    await db.insert(user).values({
      id: uid,
      name: "Renew Manual",
      email: `renew-manual-${uid}@test.invalid`,
    })
    await db.insert(products).values({
      id: pid,
      code: "exam_access",
      name: "Examens",
      description: "Accès examens",
      priceCad: 1000,
      durationDays: 180,
      accessType: "exam",
      stripeProductId: `prod_${pid}`,
      stripePriceId: `price_${pid}`,
      stripePriceLookupKey: `price_${pid}`,
    })
    // Transaction initiale (FK de l'accès existant) + accès DÉJÀ notifié.
    await db.insert(transactions).values({
      id: oldTid,
      userId: uid,
      productId: pid,
      type: "manual",
      status: "completed",
      amountPaid: 1000,
      currency: "CAD",
      accessType: "exam",
      durationDays: 180,
      accessExpiresAt: new Date(now + 2 * 86400000),
    })
    await db.insert(userAccess).values({
      userId: uid,
      accessType: "exam",
      expiresAt: new Date(now + 2 * 86400000),
      lastTransactionId: oldTid,
      expiryReminderSentAt: new Date(now - 86400000),
    })

    // grantManualAccess insère sa PROPRE transaction et upsert userAccess.
    await db.transaction(async (tx) => {
      await grantManualAccess(tx, {
        userId: uid,
        product: {
          id: pid,
          accessType: "exam",
          durationDays: 180,
          isCombo: false,
        },
        amountPaid: 1000,
        currency: "CAD",
        paymentMethod: "interac",
        recordedBy: uid,
      })
    })

    const [row] = await db
      .select({ marker: userAccess.expiryReminderSentAt })
      .from(userAccess)
      .where(eq(userAccess.userId, uid))
      .limit(1)
    expect(row?.marker).toBeNull()

    await db.delete(userAccess).where(eq(userAccess.userId, uid))
    await db.delete(transactions).where(eq(transactions.userId, uid))
    await db.delete(products).where(eq(products.id, pid))
    await db.delete(user).where(eq(user.id, uid))
  })

  it("combo : ne ré-arme PAS le rappel d'un type dont l'expiration n'avance pas", async () => {
    const uid = createId()
    const pid = createId()
    const examTid = createId()
    const trainingTid = createId()
    const reminded = new Date(now - 86400000) // marqueur déjà posé
    await db.insert(user).values({
      id: uid,
      name: "Combo Asym",
      email: `combo-${uid}@test.invalid`,
    })
    await db.insert(products).values({
      id: pid,
      code: "premium_access",
      name: "Combo",
      description: "Accès combo",
      priceCad: 1500,
      durationDays: 90,
      accessType: "exam",
      isCombo: true,
      stripeProductId: `prod_${pid}`,
      stripePriceId: `price_${pid}`,
      stripePriceLookupKey: `price_${pid}`,
    })
    await db.insert(transactions).values([
      {
        id: examTid,
        userId: uid,
        productId: pid,
        type: "manual",
        status: "completed",
        amountPaid: 1500,
        currency: "CAD",
        accessType: "exam",
        durationDays: 90,
        accessExpiresAt: new Date(now + 2 * 86400000),
      },
      {
        id: trainingTid,
        userId: uid,
        productId: pid,
        type: "manual",
        status: "completed",
        amountPaid: 1500,
        currency: "CAD",
        accessType: "training",
        durationDays: 400,
        accessExpiresAt: new Date(now + 400 * 86400000),
      },
    ])
    // exam expire bientôt (marqueur posé) ; training expire très loin (marqueur posé).
    await db.insert(userAccess).values([
      {
        userId: uid,
        accessType: "exam",
        expiresAt: new Date(now + 2 * 86400000),
        lastTransactionId: examTid,
        expiryReminderSentAt: reminded,
      },
      {
        userId: uid,
        accessType: "training",
        expiresAt: new Date(now + 400 * 86400000),
        lastTransactionId: trainingTid,
        expiryReminderSentAt: reminded,
      },
    ])

    // Achat combo 90 j : exam est prolongé (2 j → 90 j) ; training NON (400 j > 90 j).
    await db.transaction(async (tx) => {
      await grantManualAccess(tx, {
        userId: uid,
        product: {
          id: pid,
          accessType: "exam",
          durationDays: 90,
          isCombo: true,
        },
        amountPaid: 1500,
        currency: "CAD",
        paymentMethod: "interac",
        recordedBy: uid,
      })
    })

    const rows = await db
      .select({
        accessType: userAccess.accessType,
        marker: userAccess.expiryReminderSentAt,
      })
      .from(userAccess)
      .where(eq(userAccess.userId, uid))
    const exam = rows.find((r) => r.accessType === "exam")
    const training = rows.find((r) => r.accessType === "training")
    expect(exam?.marker).toBeNull() // prolongé → ré-armé
    expect(training?.marker).not.toBeNull() // inchangé → PAS ré-armé

    await db.delete(userAccess).where(eq(userAccess.userId, uid))
    await db.delete(transactions).where(eq(transactions.userId, uid))
    await db.delete(products).where(eq(products.id, pid))
    await db.delete(user).where(eq(user.id, uid))
  })
})

describe("backfill 0010 (anti-blast historique)", () => {
  it("marque les participations d'examens clos, épargne les examens ouverts", async () => {
    const creatorBf = createId()
    const closedBf = createId()
    const openBf = createId()
    const pClosed = createId()
    const pOpen = createId()
    await db.insert(user).values({
      id: creatorBf,
      name: "Créa BF",
      email: `bf-${creatorBf}@test.invalid`,
    })
    await db.insert(exams).values([
      {
        id: closedBf,
        title: "Clos BF",
        startDate: past,
        endDate: past, // déjà clos
        completionTime: 3600,
        createdBy: creatorBf,
      },
      {
        id: openBf,
        title: "Ouvert BF",
        startDate: past,
        endDate: future, // encore ouvert
        completionTime: 3600,
        createdBy: creatorBf,
      },
    ])
    await db.insert(examParticipations).values([
      {
        id: pClosed,
        examId: closedBf,
        userId: creatorBf,
        score: 70,
        status: "completed",
        completedAt: past,
      },
      {
        id: pOpen,
        examId: openBf,
        userId: creatorBf,
        score: 60,
        status: "completed",
        completedAt: past,
      },
    ])

    // Exécute le VRAI SQL de la migration 0010 (source de vérité) — pas une reprise.
    const backfillSql = readFileSync(
      "drizzle/0010_backfill_results_notified.sql",
      "utf8",
    )
    await db.execute(sql.raw(backfillSql))

    const [closedRow] = await db
      .select({ m: examParticipations.resultsNotifiedAt })
      .from(examParticipations)
      .where(eq(examParticipations.id, pClosed))
      .limit(1)
    const [openRow] = await db
      .select({ m: examParticipations.resultsNotifiedAt })
      .from(examParticipations)
      .where(eq(examParticipations.id, pOpen))
      .limit(1)
    expect(closedRow?.m).not.toBeNull() // examen clos → marqué (pas de blast)
    expect(openRow?.m).toBeNull() // examen ouvert → épargné (notifié à sa clôture)

    await db
      .delete(examParticipations)
      .where(eq(examParticipations.examId, closedBf))
    await db
      .delete(examParticipations)
      .where(eq(examParticipations.examId, openBf))
    await db.delete(exams).where(eq(exams.id, closedBf))
    await db.delete(exams).where(eq(exams.id, openBf))
    await db.delete(user).where(eq(user.id, creatorBf))
  })
})

describe("comptes suspendus", () => {
  const banned = createId()
  const bannedProduct = createId()
  let bannedTxId: string

  beforeAll(async () => {
    await db.insert(user).values({
      id: banned,
      name: "Suspendu",
      email: `ban-${banned}@test.invalid`,
      banned: true,
      banReason: "test",
    })
    await db.insert(examParticipations).values({
      id: createId(),
      examId: closedExam,
      userId: banned,
      score: 70,
      status: "completed",
      completedAt: past,
    })
    await db.insert(products).values({
      id: bannedProduct,
      code: "exam_access",
      name: "Exam court",
      description: "d",
      priceCad: 100,
      durationDays: 3,
      accessType: "exam",
      stripeProductId: `prod_ban_${banned}`,
      stripePriceId: `price_ban_${banned}`,
      stripePriceLookupKey: `price_ban_${banned}`,
    })
    bannedTxId = await db.transaction((tx) =>
      grantManualAccess(tx, {
        userId: banned,
        product: {
          id: bannedProduct,
          accessType: "exam",
          durationDays: 3,
          isCombo: false,
        },
        amountPaid: 100,
        currency: "CAD",
        paymentMethod: "interac",
        recordedBy: banned,
      }),
    )
  })

  afterAll(async () => {
    await db.delete(userAccess).where(eq(userAccess.userId, banned))
    await db.delete(transactions).where(eq(transactions.id, bannedTxId))
    await db.delete(products).where(eq(products.id, bannedProduct))
    await db
      .delete(examParticipations)
      .where(eq(examParticipations.userId, banned))
    await db.delete(user).where(eq(user.id, banned))
  })

  it("aucun courriel, aucun marqueur posé : le rappel repart si la suspension est levée", async () => {
    examResults.mockClear()
    accessExpiring.mockClear()

    await sendExamResultsNotifications()
    await sendAccessExpiryReminders()

    expect(examResults).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: `ban-${banned}@test.invalid` }),
    )
    expect(accessExpiring).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: `ban-${banned}@test.invalid` }),
    )
    const [p] = await db
      .select({ notified: examParticipations.resultsNotifiedAt })
      .from(examParticipations)
      .where(eq(examParticipations.userId, banned))
    expect(p?.notified).toBeNull()
    const [a] = await db
      .select({ reminded: userAccess.expiryReminderSentAt })
      .from(userAccess)
      .where(eq(userAccess.userId, banned))
    expect(a?.reminded).toBeNull()
  })
})

describe("sendInactivityReminders", () => {
  const DAY = 86400000
  const old = new Date(now - 30 * DAY)
  const ids = {
    eligible: createId(),
    liveSession: createId(),
    recentLogin: createId(),
    recentTraining: createId(),
    optOut: createId(),
    stale: createId(),
    staleBuyer: createId(),
    admin: createId(),
    unverified: createId(),
  }
  const pid = createId()
  const calledFor = () =>
    inactivity.mock.calls.map((c) => (c[0] as { userId: string }).userId)

  beforeAll(async () => {
    const base = (id: string, name: string) => ({
      id,
      name,
      email: `inact-${id}@test.invalid`,
      emailVerified: true,
      createdAt: old,
    })
    await db.insert(user).values([
      base(ids.eligible, "Éligible"),
      base(ids.liveSession, "Session vivante"),
      {
        ...base(ids.recentLogin, "Connexion récente"),
        lastLoginAt: new Date(now - 2 * DAY),
      },
      base(ids.recentTraining, "Entraînement récent"),
      { ...base(ids.optOut, "Refus"), notifyMarketing: false },
      { ...base(ids.stale, "Ancien"), createdAt: new Date(now - 200 * DAY) },
      {
        ...base(ids.staleBuyer, "Ancien acheteur"),
        createdAt: new Date(now - 200 * DAY),
      },
      { ...base(ids.admin, "Admin"), role: "admin" as const },
      { ...base(ids.unverified, "Non vérifié"), emailVerified: false },
    ])
    await db.insert(session).values({
      id: createId(),
      token: createId(),
      userId: ids.liveSession,
      expiresAt: future,
      updatedAt: new Date(now - 2 * DAY),
    })
    await db.insert(trainingSessions).values({
      id: createId(),
      userId: ids.recentTraining,
      status: "in_progress",
      questionCount: 10,
      startedAt: new Date(now - 3 * DAY),
      expiresAt: future,
    })
    await db.insert(products).values({
      id: pid,
      code: "training_access",
      name: "Entraînement",
      description: "Accès entraînement",
      priceCad: 1000,
      durationDays: 30,
      accessType: "training",
      stripeProductId: `prod_${pid}`,
      stripePriceId: `price_${pid}`,
      stripePriceLookupKey: `price_${pid}`,
    })
    await db.insert(transactions).values({
      id: createId(),
      userId: ids.staleBuyer,
      productId: pid,
      type: "manual",
      status: "completed",
      amountPaid: 1000,
      currency: "CAD",
      accessType: "training",
      durationDays: 30,
      accessExpiresAt: future,
      createdAt: new Date(now - 10 * DAY),
      completedAt: new Date(now - 10 * DAY),
    })
  })

  afterAll(async () => {
    await db.delete(transactions).where(eq(transactions.userId, ids.staleBuyer))
    await db.delete(products).where(eq(products.id, pid))
    await db
      .delete(trainingSessions)
      .where(eq(trainingSessions.userId, ids.recentTraining))
    for (const id of Object.values(ids)) {
      await db.delete(user).where(eq(user.id, id))
    }
  })

  it("relance les inactifs consentants, une seule fois", async () => {
    await sendInactivityReminders()
    expect(calledFor()).toContain(ids.eligible)
    expect(calledFor()).toContain(ids.staleBuyer)
    for (const id of [
      ids.liveSession,
      ids.recentLogin,
      ids.recentTraining,
      ids.optOut,
      ids.stale,
      ids.admin,
      ids.unverified,
    ]) {
      expect(calledFor()).not.toContain(id)
    }
    expect(inactivity).toHaveBeenCalledWith(
      expect.objectContaining({
        to: `inact-${ids.eligible}@test.invalid`,
        name: "Éligible",
        userId: ids.eligible,
      }),
    )

    inactivity.mockClear()
    await sendInactivityReminders()
    expect(calledFor()).not.toContain(ids.eligible)
    expect(calledFor()).not.toContain(ids.staleBuyer)
  })
})
