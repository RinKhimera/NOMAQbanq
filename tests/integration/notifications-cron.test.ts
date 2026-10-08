import { eq, sql } from "drizzle-orm"
import { readFileSync } from "node:fs"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  examQuestions,
  exams,
  questions,
  session,
  trainingSessions,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import {
  accessExpiryReminderSpec,
  examResultsSpec,
  inactivityReminderSpec,
  sendAccessExpiryReminders,
  sendExamResultsNotifications,
  sendInactivityReminders,
} from "@/features/notifications/cron"
import { sendOnce } from "@/features/notifications/one-shot"
import { createId } from "@/lib/ids"
import { fakeMailer } from "../helpers/fake-mailer"
import { TEST_OBJECTIVE_ID } from "../helpers/objective"
import { seedAccess, seedProduct } from "../helpers/seed-payments"

vi.mock("@/email", () =>
  import("../helpers/fake-mailer").then((m) => m.fakeMailer),
)
const examResults = fakeMailer.sendExamResultsEmail
const accessExpiring = fakeMailer.sendAccessExpiringEmail
const inactivity = fakeMailer.sendInactivityReminderEmail

// Une ligne claimée ne doit plus être candidate : sans ça, le select relirait à
// chaque run les lignes déjà marquées et, à la borne, affamerait les nouvelles.
const candidateIds = async (spec: {
  select: (ctx: { now: Date; limit: number }) => Promise<{ id: string }[]>
}) => (await spec.select({ now: new Date(), limit: 1000 })).map((r) => r.id)

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

// Rattaché au describe de l'envoi : le backfill et les comptes suspendus
// balaient eux aussi les examens clos de la base du fichier.
const seedExamResults = async () => {
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
      targetQuestionCount: 10,
      finalizedAt: new Date(),
    },
    {
      id: openExam,
      title: "Examen Ouvert",
      startDate: past,
      endDate: future,
      completionTime: 3600,
      createdBy: creator,
      targetQuestionCount: 10,
      finalizedAt: new Date(),
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
    objectiveId: TEST_OBJECTIVE_ID,
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
}

describe("sendExamResultsNotifications", () => {
  beforeAll(seedExamResults)

  it("envoie aux opt-in d'examens clos, marque tout, ignore les examens ouverts", async () => {
    expect(await sendExamResultsNotifications()).toBe(2)

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

    // Marqueur posé sur les 3 participations de l'examen CLOS, opt-out compris ;
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

    const candidates = await candidateIds(examResultsSpec())
    expect(candidates).not.toContain(lockedClosedPart)
  })
})

describe("sendAccessExpiryReminders", () => {
  it("envoie pour un accès ≤ 7 j avec l'échéance en jours, marque", async () => {
    const uid = createId()
    await db.insert(user).values({
      id: uid,
      name: "Accès",
      email: `acc-${uid}@test.invalid`,
    })
    await seedAccess(uid, "exam", new Date(now + 5 * 86400000))

    expect(await sendAccessExpiryReminders()).toBe(1)
    expect(accessExpiring).toHaveBeenCalledWith({
      to: `acc-${uid}@test.invalid`,
      name: "Accès",
      accessType: "exam",
      daysRemaining: 5,
      renewUrl: expect.stringMatching(/\/tableau-de-bord\/abonnements$/),
    })
    const [access] = await db
      .select({
        id: userAccess.id,
        marker: userAccess.expiryReminderSentAt,
      })
      .from(userAccess)
      .where(eq(userAccess.userId, uid))
    expect(access?.marker).toBeInstanceOf(Date)
    expect(await candidateIds(accessExpiryReminderSpec())).not.toContain(
      access?.id,
    )
  })
})

describe("garde du rappel de fin d'accès : échéance = valeur lue", () => {
  const seedClaimable = async (expiresAt: Date) => {
    const uid = createId()
    await db.insert(user).values({
      id: uid,
      name: "Claim",
      email: `claim-${uid}@test.invalid`,
    })
    await seedAccess(uid, "exam", expiresAt)
    const [access] = await db
      .select({ id: userAccess.id })
      .from(userAccess)
      .where(eq(userAccess.userId, uid))
    const marker = async () => {
      const [row] = await db
        .select({ marker: userAccess.expiryReminderSentAt })
        .from(userAccess)
        .where(eq(userAccess.id, access.id))
        .limit(1)
      return row?.marker ?? null
    }
    return { accessId: access.id, marker }
  }

  // La course lecture → renouvellement → claim n'est pas injectable dans
  // l'expéditeur : on rejoue sa spec avec la ligne LUE figée.
  const readRow = async (accessId: string) => {
    const spec = accessExpiryReminderSpec()
    const rows = await spec.select({ now: new Date(now), limit: 1000 })
    const row = rows.find((r) => r.id === accessId)
    if (!row) throw new Error("ligne candidate introuvable")
    return row
  }

  it("échéance inchangée depuis la lecture : claim posé, courriel envoyé", async () => {
    const a = await seedClaimable(new Date(now + 5 * 86400000))
    const row = await readRow(a.accessId)
    const claimAt = new Date(now)

    const sent = await sendOnce({
      ...accessExpiryReminderSpec(),
      now: claimAt,
      select: async () => [row],
    })

    expect(sent).toBe(1)
    expect(await a.marker()).toEqual(claimAt)
  })

  it("échéance prolongée entre la lecture et le claim : refusé, marqueur intact (le prochain run rappellera la nouvelle échéance)", async () => {
    const a = await seedClaimable(new Date(now + 5 * 86400000))
    const row = await readRow(a.accessId)
    // Un renouvellement concurrent (applyGrant) a fait avancer l'expiration et
    // ré-armé le marqueur après le SELECT du cron.
    await db
      .update(userAccess)
      .set({
        expiresAt: new Date(now + 35 * 86400000),
        expiryReminderSentAt: null,
      })
      .where(eq(userAccess.id, a.accessId))

    const sent = await sendOnce({
      ...accessExpiryReminderSpec(),
      now: new Date(now),
      select: async () => [row],
    })

    expect(sent).toBe(0)
    expect(accessExpiring).not.toHaveBeenCalled()
    expect(await a.marker()).toBeNull()
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
        targetQuestionCount: 10,
        finalizedAt: new Date(),
      },
      {
        id: openBf,
        title: "Ouvert BF",
        startDate: past,
        endDate: future, // encore ouvert
        completionTime: 3600,
        createdBy: creatorBf,
        targetQuestionCount: 10,
        finalizedAt: new Date(),
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
  })
})

describe("comptes suspendus", () => {
  const banned = createId()

  beforeAll(async () => {
    await db.insert(user).values({
      id: banned,
      name: "Suspendu",
      email: `ban-${banned}@test.invalid`,
      banned: true,
      banReason: "test",
    })
    const bannedExam = createId()
    await db.insert(exams).values({
      id: bannedExam,
      title: "Examen Clos Suspendu",
      startDate: past,
      endDate: past,
      completionTime: 3600,
      createdBy: banned,
      targetQuestionCount: 10,
      finalizedAt: new Date(),
    })
    await db.insert(examParticipations).values({
      id: createId(),
      examId: bannedExam,
      userId: banned,
      score: 70,
      status: "completed",
      completedAt: past,
    })
    await seedAccess(banned, "exam", new Date(now + 3 * 86400000))
  })

  it("aucun courriel, aucun marqueur posé : le rappel repart si la suspension est levée", async () => {
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
  const inactive = (id: string, name: string) => ({
    id,
    name,
    email: `inact-${id}@test.invalid`,
    emailVerified: true,
    createdAt: old,
  })
  const calledFor = () =>
    inactivity.mock.calls.map((c) => (c[0] as { userId: string }).userId)

  it("plafonne un passage à 50 relances, le suivant reprend l'arriéré", async () => {
    const ids = Array.from({ length: 51 }, () => createId())
    await db.insert(user).values(ids.map((id) => inactive(id, "Arriéré")))

    expect(await sendInactivityReminders()).toBe(50)
    expect(await sendInactivityReminders()).toBe(1)
    expect(new Set(calledFor())).toEqual(new Set(ids))
  })

  it("relance les inactifs consentants", async () => {
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
    await db.insert(user).values([
      inactive(ids.eligible, "Éligible"),
      inactive(ids.liveSession, "Session vivante"),
      {
        ...inactive(ids.recentLogin, "Connexion récente"),
        lastLoginAt: new Date(now - 2 * DAY),
      },
      inactive(ids.recentTraining, "Entraînement récent"),
      { ...inactive(ids.optOut, "Refus"), notifyMarketing: false },
      {
        ...inactive(ids.stale, "Ancien"),
        createdAt: new Date(now - 200 * DAY),
      },
      {
        ...inactive(ids.staleBuyer, "Ancien acheteur"),
        createdAt: new Date(now - 200 * DAY),
      },
      { ...inactive(ids.admin, "Admin"), role: "admin" as const },
      { ...inactive(ids.unverified, "Non vérifié"), emailVerified: false },
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
    await db.insert(transactions).values({
      id: createId(),
      userId: ids.staleBuyer,
      productId: await seedProduct("training_access"),
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

    expect(await sendInactivityReminders()).toBe(2)
    expect(calledFor().sort()).toEqual([ids.eligible, ids.staleBuyer].sort())
    expect(inactivity).toHaveBeenCalledWith(
      expect.objectContaining({
        to: `inact-${ids.eligible}@test.invalid`,
        name: "Éligible",
        userId: ids.eligible,
      }),
    )
    expect(await candidateIds(inactivityReminderSpec())).not.toContain(
      ids.eligible,
    )
  })
})
