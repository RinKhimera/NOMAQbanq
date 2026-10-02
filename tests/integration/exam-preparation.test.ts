import { asc, eq, inArray, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  examQuestions,
  exams,
  products,
  questions,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import { getMyDashboard } from "@/features/analytics/dal.dashboard"
import {
  createExam,
  finalizePreparedExam,
  saveExam,
  startExam,
  updateExam,
} from "@/features/exams/actions"
import {
  getAdminExam,
  getExamLeaderboard,
  getExamWithQuestions,
  getExamsStats,
  getExamsWithParticipation,
  getParticipantExamResults,
} from "@/features/exams/dal"
import { updateQuestion } from "@/features/questions/actions"
import { excludeLocked, lockFor } from "@/features/questions/answer-key-lock"
import { notUsedInLastExams } from "@/features/questions/last-use"
import { getAdminStats } from "@/features/users/dal"
import { getCurrentSession } from "@/lib/dal"
import { getPgErrorCode } from "@/lib/db-errors"
import { createId } from "@/lib/ids"
import { seedExam } from "../helpers/seed-exam"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))
vi.mock("@/lib/aws", () => ({
  createPresignedUpload: vi.fn(),
  deleteFromS3: vi.fn(),
  copyInS3: vi.fn().mockResolvedValue(undefined),
}))

const DAY = 24 * 60 * 60 * 1000
const suffix = createId().slice(0, 8)

const ADMIN_ID = createId()
const STUDENT_ID = createId()
// 12 questions : un jeu complet de 10, et de quoi en changer.
const qIds = Array.from({ length: 12 }, () => createId())
const deletedQId = createId()
// Dans aucun autre examen du fichier : les choix figés s'y lisent seuls.
const freeQId = createId()
// Seule dans un examen en préparation sans dates : le verrou anonyme s'y lit seul.
const undatedQId = createId()
const PID = createId()
const createdExams: string[] = []

const asUser = (id: string, role: "user" | "admin" = "user") =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue({ user: { id, role } } as never)
const asAdmin = () => asUser(ADMIN_ID, "admin")

// « Enregistrer » reçoit toujours l'état entier du formulaire.
const base = {
  title: `Préparation ${suffix}`,
  targetQuestionCount: 10,
  startDate: null,
  endDate: null,
  enablePause: false,
  audienceType: "subscribers" as const,
  audienceUserIds: [] as string[],
}

/** Fenêtre ouverte : ouverture hier, fermeture dans une semaine. */
const openWindow = () => ({
  startDate: Date.now() - DAY,
  endDate: Date.now() + 7 * DAY,
})

const saveNew = async (input: Parameters<typeof saveExam>[0]) => {
  asAdmin()
  const res = await saveExam(input)
  if (!res.success) throw new Error(res.error)
  createdExams.push(res.examId)
  return res.examId
}

/** Examen restreint à l'étudiant, jeu complet, prêt à finaliser. */
const saveComplete = (extra: Partial<Parameters<typeof saveExam>[0]> = {}) =>
  saveNew({
    ...base,
    ...openWindow(),
    questionIds: qIds.slice(0, 10),
    audienceType: "restricted",
    audienceUserIds: [STUDENT_ID],
    ...extra,
  })

const examRow = async (examId: string) => {
  const [row] = await db
    .select({
      finalizedAt: exams.finalizedAt,
      completionTime: exams.completionTime,
      startDate: exams.startDate,
      targetQuestionCount: exams.targetQuestionCount,
    })
    .from(exams)
    .where(eq(exams.id, examId))
  return row
}

const orderOf = async (examId: string) =>
  (
    await db
      .select({ questionId: examQuestions.questionId })
      .from(examQuestions)
      .where(eq(examQuestions.examId, examId))
      .orderBy(asc(examQuestions.position))
  ).map((r) => r.questionId)

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: ADMIN_ID,
      name: "Prép admin",
      email: `prep-adm-${suffix}@test.invalid`,
      role: "admin",
    },
    {
      id: STUDENT_ID,
      name: "Prép étudiant",
      email: `prep-stu-${suffix}@test.invalid`,
    },
  ])
  await db.insert(questions).values([
    ...qIds.map((id, i) => ({
      id,
      question: `Q préparation ${i} ${suffix}`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: "Objectif",
      domain: "Cardiologie",
    })),
    {
      id: undatedQId,
      question: `Q sans dates ${suffix}`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: "Objectif",
      domain: "Cardiologie",
    },
    {
      id: freeQId,
      question: `Q libre ${suffix}`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: "Objectif",
      domain: "Cardiologie",
    },
    {
      id: deletedQId,
      question: `Q supprimée ${suffix}`,
      correctAnswer: "A",
      options: ["A", "B"],
      objectifCmc: "Objectif",
      domain: "Cardiologie",
    },
  ])

  // Accès Examens de l'étudiant : le tableau de bord ne compte les examens
  // disponibles qu'avec lui.
  await db.insert(products).values({
    id: PID,
    code: "exam_access",
    name: "Exam",
    description: "desc",
    priceCad: 5000,
    durationDays: 30,
    accessType: "exam",
    stripeProductId: `prod_${suffix}`,
    stripePriceId: `price_${suffix}`,
    stripePriceLookupKey: `price_${suffix}`,
  })
  const txId = createId()
  await db.insert(transactions).values({
    id: txId,
    userId: STUDENT_ID,
    productId: PID,
    type: "manual",
    status: "completed",
    amountPaid: 5000,
    currency: "CAD",
    accessType: "exam",
    durationDays: 30,
    accessExpiresAt: new Date(Date.now() + 20 * DAY),
  })
  await db.insert(userAccess).values({
    userId: STUDENT_ID,
    accessType: "exam",
    expiresAt: new Date(Date.now() + 20 * DAY),
    lastTransactionId: txId,
  })
})

afterAll(async () => {
  // Examens créés par l'action ou par `seedExam` : tous portent cet admin.
  await db.delete(exams).where(eq(exams.createdBy, ADMIN_ID))
  await db.delete(userAccess).where(eq(userAccess.userId, STUDENT_ID))
  await db.delete(transactions).where(eq(transactions.userId, STUDENT_ID))
  await db.delete(products).where(eq(products.id, PID))
  await db
    .delete(questions)
    .where(inArray(questions.id, [...qIds, freeQId, undatedQId, deletedQId]))
  await db.delete(user).where(inArray(user.id, [ADMIN_ID, STUDENT_ID]))
})

describe("enregistrer un examen en préparation", () => {
  it("titre et visé suffisent ; jeu partiel, sans dates, liste restreinte vide se relisent tels quels", async () => {
    const examId = await saveNew({
      ...base,
      questionIds: qIds.slice(0, 3),
      audienceType: "restricted",
      audienceUserIds: [],
    })

    const read = await getAdminExam(examId)
    expect(read?.exam).toMatchObject({
      finalizedAt: null,
      startDate: null,
      endDate: null,
      completionTime: null,
      targetQuestionCount: 10,
      questionCount: 3,
      audienceType: "restricted",
    })
    expect(read?.questions.map((q) => q._id)).toEqual(qIds.slice(0, 3))

    // Réenregistré sans `questionIds` : jeu conservé, dates ajoutées.
    const again = await saveExam({
      id: examId,
      ...base,
      ...openWindow(),
      audienceType: "restricted",
      audienceUserIds: [],
    })
    expect(again).toEqual({ success: true, examId, finalized: false })
    expect(await orderOf(examId)).toEqual(qIds.slice(0, 3))
  })

  it("un champ omis n'est jamais lu comme « effacer » : il est refusé", async () => {
    const withoutAudience = { ...base, audienceType: undefined }
    asAdmin()
    const res = await saveExam(withoutAudience as never)
    expect(res.success).toBe(false)
  })

  it.each([9, 231])("refuse un visé de %i", async (targetQuestionCount) => {
    asAdmin()
    const res = await saveExam({ ...base, targetQuestionCount })
    expect(res).toEqual({
      success: false,
      error: "Entre 10 et 230 questions",
    })
  })

  it("refuse un jeu plus grand que le visé", async () => {
    asAdmin()
    const res = await saveExam({ ...base, questionIds: qIds.slice(0, 11) })
    expect(res).toEqual({
      success: false,
      error: "Le jeu de questions dépasse le nombre visé",
    })
  })

  it("refuse d'abaisser le visé sous le nombre de questions choisies", async () => {
    const examId = await saveNew({
      ...base,
      targetQuestionCount: 12,
      questionIds: qIds,
    })

    const res = await saveExam({ id: examId, ...base, targetQuestionCount: 11 })

    expect(res).toMatchObject({
      success: false,
      fieldErrors: {
        targetQuestionCount:
          "Le nombre visé ne peut pas descendre sous les 12 questions déjà choisies.",
      },
    })
    expect((await examRow(examId))?.targetQuestionCount).toBe(12)
  })
})

describe("un examen en préparation n'existe pas pour l'étudiant", () => {
  it("absent des listes, introuvable, non démarrable même par un admin une fois l'ouverture passée", async () => {
    const examId = await saveNew({
      ...base,
      ...openWindow(),
      questionIds: qIds.slice(0, 10),
      audienceType: "subscribers",
    })

    asUser(STUDENT_ID)
    expect((await getExamsWithParticipation()).map((e) => e.id)).not.toContain(
      examId,
    )
    expect(await getExamWithQuestions(examId)).toBeNull()
    expect(await startExam({ examId })).toEqual({
      success: false,
      error: "Cet examen est en préparation : il n'est pas encore ouvert.",
    })

    asAdmin()
    expect((await getExamsWithParticipation()).map((e) => e.id)).not.toContain(
      examId,
    )
    expect(await startExam({ examId })).toEqual({
      success: false,
      error: "Cet examen est en préparation : il n'est pas encore ouvert.",
    })
    const participations = await db
      .select({ id: examParticipations.id })
      .from(examParticipations)
      .where(eq(examParticipations.examId, examId))
    expect(participations).toHaveLength(0)
  })

  it("compté en préparation dans les statistiques admin, dans aucune phase datée", async () => {
    asAdmin()
    const before = await getExamsStats()
    await saveNew({ ...base, ...openWindow(), audienceType: "subscribers" })
    const after = await getExamsStats()

    expect(after.preparation).toBe(before.preparation + 1)
    expect(after.active).toBe(before.active)
    expect(after.upcoming).toBe(before.upcoming)
  })
})

describe("contrainte et lectures filtrées", () => {
  it("la base refuse un examen finalisé sans dates (exams_finalized_complete)", async () => {
    const examId = await saveComplete()
    await finalizePreparedExam({ examId })

    const error = await db
      .update(exams)
      .set({ startDate: null })
      .where(eq(exams.id, examId))
      .then(
        () => null,
        (e: unknown) => e,
      )

    expect(getPgErrorCode(error)).toBe("23514")
  })

  it("classement et résultats : introuvables pour un examen en préparation sans dates", async () => {
    const examId = await saveNew({ ...base, questionIds: qIds.slice(0, 3) })

    asUser(STUDENT_ID)
    expect(await getExamLeaderboard(examId)).toEqual([])
    expect(await getParticipantExamResults(examId, STUDENT_ID)).toBeNull()

    asAdmin()
    expect(await getParticipantExamResults(examId, STUDENT_ID)).toBeNull()
  })

  it("jumeau : les mêmes lectures répondent sur un examen finalisé", async () => {
    const examId = await seedExam({
      createdBy: ADMIN_ID,
      title: `Jumeau ${suffix}`,
      startDate: Date.now() - 7 * DAY,
      endDate: Date.now() - DAY,
      questionIds: qIds.slice(0, 3),
    })

    asAdmin()
    expect(await getParticipantExamResults(examId, STUDENT_ID)).toMatchObject({
      error: "NO_PARTICIPATION",
    })
  })

  it("compteurs : un examen en préparation qui garde ses dates n'est pas compté", async () => {
    const countersOf = async () => {
      asAdmin()
      const [stats, admin] = await Promise.all([
        getExamsStats(),
        getAdminStats(),
      ])
      asUser(STUDENT_ID)
      const dashboard = await getMyDashboard("tout")
      return {
        past: stats.past,
        active: admin.activeExams,
        available: dashboard?.exams.availableCount ?? -1,
      }
    }
    const before = await countersOf()

    await saveNew({ ...base, ...openWindow(), questionIds: qIds.slice(0, 3) })
    await saveNew({
      ...base,
      startDate: Date.now() - 7 * DAY,
      endDate: Date.now() - DAY,
    })
    expect(await countersOf()).toEqual(before)

    // Jumeaux finalisés, mêmes fenêtres : chaque compteur bouge.
    await seedExam({
      createdBy: ADMIN_ID,
      title: `Jumeau ouvert ${suffix}`,
      ...openWindow(),
      questionIds: qIds.slice(0, 3),
    })
    await seedExam({
      createdBy: ADMIN_ID,
      title: `Jumeau clos ${suffix}`,
      startDate: Date.now() - 7 * DAY,
      endDate: Date.now() - DAY,
      questionIds: qIds.slice(0, 3),
    })
    expect(await countersOf()).toEqual({
      past: before.past + 1,
      active: before.active + 1,
      available: before.available + 2,
    })
  })
})

describe("finaliser", () => {
  it("refuse avec un message par champ : jeu incomplet, dates absentes, liste restreinte vide", async () => {
    const examId = await saveNew({
      ...base,
      questionIds: qIds.slice(0, 3),
      audienceType: "restricted",
      audienceUserIds: [],
    })

    const res = await finalizePreparedExam({ examId })

    expect(res).toMatchObject({
      success: false,
      fieldErrors: {
        questionIds: "Le jeu compte 3 questions sur 10 visées.",
        startDate: "Date d'ouverture requise",
        endDate: "Date de fermeture requise",
        audienceUserIds: "Sélectionnez au moins un utilisateur",
      },
    })
    expect((await examRow(examId))?.finalizedAt).toBeNull()
  })

  it("refuse une fenêtre déjà close", async () => {
    const examId = await saveComplete({
      startDate: Date.now() - 7 * DAY,
      endDate: Date.now() - DAY,
    })

    expect(await finalizePreparedExam({ examId })).toMatchObject({
      success: false,
      fieldErrors: {
        endDate: "La fenêtre est déjà close : décalez les dates.",
      },
    })
  })

  it("refuse un jeu qui contient une question supprimée depuis", async () => {
    const examId = await saveComplete({
      questionIds: [...qIds.slice(0, 9), deletedQId],
    })
    await db
      .update(questions)
      .set({ deletedAt: new Date() })
      .where(eq(questions.id, deletedQId))

    expect(await finalizePreparedExam({ examId })).toMatchObject({
      success: false,
      fieldErrors: {
        questionIds:
          "Le jeu contient des questions supprimées : retirez-les avant de finaliser.",
      },
    })
  })

  it("fixe la durée sur le jeu réel, mélange l'ordre puis le fige, et ouvre aussitôt une fenêtre entamée", async () => {
    const examId = await saveComplete()

    expect(await finalizePreparedExam({ examId })).toEqual({ success: true })

    const row = await examRow(examId)
    expect(row?.finalizedAt).toBeInstanceOf(Date)
    expect(row?.completionTime).toBe(10 * 83)
    const order = await orderOf(examId)
    expect([...order].sort()).toEqual([...qIds.slice(0, 10)].sort())
    // 1 chance sur 10! de retomber sur l'ordre de sélection.
    expect(order).not.toEqual(qIds.slice(0, 10))
    expect(await orderOf(examId)).toEqual(order)

    asUser(STUDENT_ID)
    expect(await startExam({ examId })).toMatchObject({ success: true })
  })

  it("une seconde finalisation est refusée", async () => {
    const examId = await saveComplete()
    await finalizePreparedExam({ examId })

    expect(await finalizePreparedExam({ examId })).toEqual({
      success: false,
      error: "Cet examen est déjà finalisé.",
    })
  })

  it("l'ancien formulaire crée un examen finalisé, ordre mélangé", async () => {
    asAdmin()
    const res = await createExam({
      title: `Formulaire ${suffix}`,
      ...openWindow(),
      questionIds: qIds.slice(0, 10),
    })
    if (!res.success) throw new Error(res.error)
    createdExams.push(res.examId)

    expect((await examRow(res.examId))?.completionTime).toBe(10 * 83)
    expect((await examRow(res.examId))?.finalizedAt).toBeInstanceOf(Date)
  })
})

describe("modifier un examen finalisé", () => {
  it("changer son jeu sans participation le remet en préparation", async () => {
    const examId = await saveComplete()
    await finalizePreparedExam({ examId })

    const res = await saveExam({
      id: examId,
      ...base,
      ...openWindow(),
      questionIds: [...qIds.slice(0, 9), qIds[10]],
      audienceType: "restricted",
      audienceUserIds: [STUDENT_ID],
    })

    expect(res).toEqual({ success: true, examId, finalized: false })
    expect(await examRow(examId)).toMatchObject({
      finalizedAt: null,
      completionTime: null,
    })
    asUser(STUDENT_ID)
    expect(await getExamWithQuestions(examId)).toBeNull()
  })

  it("jumeau : changer son titre ou ses dates garde la finalisation", async () => {
    const examId = await saveComplete()
    await finalizePreparedExam({ examId })
    const order = await orderOf(examId)

    const res = await saveExam({
      id: examId,
      ...base,
      title: `Renommé ${suffix}`,
      startDate: Date.now() + DAY,
      endDate: Date.now() + 8 * DAY,
      questionIds: order,
      audienceType: "restricted",
      audienceUserIds: [STUDENT_ID],
    })

    expect(res).toEqual({ success: true, examId, finalized: true })
    expect((await examRow(examId))?.finalizedAt).toBeInstanceOf(Date)
    expect(await orderOf(examId)).toEqual(order)
  })

  it("un jeu figé par une participation reste refusé", async () => {
    const examId = await saveComplete()
    await finalizePreparedExam({ examId })
    asUser(STUDENT_ID)
    await startExam({ examId })

    asAdmin()
    const res = await saveExam({
      id: examId,
      ...base,
      ...openWindow(),
      questionIds: [...qIds.slice(0, 9), qIds[10]],
      audienceType: "restricted",
      audienceUserIds: [STUDENT_ID],
    })

    expect(res).toEqual({
      success: false,
      error:
        "Cet examen a déjà des participations ; ses questions ne peuvent plus être modifiées.",
    })
    expect((await examRow(examId))?.finalizedAt).toBeInstanceOf(Date)
  })

  it("un visé à 0 inséré par l'ancien déploiement se recale sur le jeu, participations comprises", async () => {
    const examId = await seedExam({
      createdBy: ADMIN_ID,
      title: `Ancien déploiement ${suffix}`,
      ...openWindow(),
      questionIds: qIds.slice(0, 10),
    })
    await db
      .update(exams)
      .set({ targetQuestionCount: 0 })
      .where(eq(exams.id, examId))
    await db.insert(examParticipations).values({
      examId,
      userId: STUDENT_ID,
      status: "in_progress",
      startedAt: new Date(),
    })

    asAdmin()
    const res = await updateExam({
      id: examId,
      title: `Ancien déploiement ${suffix}`,
      ...openWindow(),
      questionIds: qIds.slice(0, 10),
    })

    expect(res).toEqual({ success: true })
    const row = await examRow(examId)
    expect(row?.targetQuestionCount).toBe(10)
    expect(row?.finalizedAt).toBeInstanceOf(Date)
  })

  it("un examen finalisé qui reste finalisé est validé en entier", async () => {
    const examId = await saveComplete()
    await finalizePreparedExam({ examId })

    const res = await saveExam({
      id: examId,
      ...base,
      startDate: null,
      endDate: null,
      audienceType: "restricted",
      audienceUserIds: [STUDENT_ID],
    })

    expect(res).toMatchObject({
      success: false,
      fieldErrors: { startDate: "Date d'ouverture requise" },
    })
  })
})

describe("désactivé et en préparation", () => {
  it("finaliser un examen désactivé ne l'ouvre pas", async () => {
    const examId = await saveComplete()
    await db.update(exams).set({ isActive: false }).where(eq(exams.id, examId))

    expect(await finalizePreparedExam({ examId })).toEqual({ success: true })

    asUser(STUDENT_ID)
    expect(await startExam({ examId })).toEqual({
      success: false,
      error: "Cet examen n'est plus disponible.",
    })
  })
})

describe("verrou de clé et choix figés", () => {
  it("choix figés non appliqués à un examen en préparation, verrou anonyme inchangé", async () => {
    const questionId = freeQId
    await saveComplete({ questionIds: [...qIds.slice(0, 9), questionId] })

    asAdmin()
    expect(
      await updateQuestion({
        id: questionId,
        question: `Q libre ${suffix}`,
        options: ["A", "B", "C", "D"],
        correctAnswer: "B",
        explanation: "Parce que.",
        references: [],
        objectifCMC: "Objectif",
        domain: "Cardiologie",
      }),
    ).toEqual({ success: true })

    expect((await lockFor("anonymous", [questionId])).has(questionId)).toBe(
      true,
    )
  })
})

describe("verrou anonyme d'un examen en préparation sans dates", () => {
  it("ses questions sont retenues et exclues du tirage public", async () => {
    await saveNew({ ...base, questionIds: [undatedQId] })

    expect((await lockFor("anonymous", [undatedQId])).has(undatedQId)).toBe(
      true,
    )
    const drawable = await db
      .select({ id: questions.id })
      .from(questions)
      .where(
        sql`${eq(questions.id, undatedQId)} and ${excludeLocked("anonymous", sql`"questions"."id"`)}`,
      )
    expect(drawable).toEqual([])
  })
})

describe("dernière utilisation", () => {
  it("un examen en préparation ne compte pas ; un examen finalisé, si", async () => {
    // Fenêtres lointaines : ces deux examens sont les plus récents de la base.
    const far = Date.UTC(2099, 0, 1)
    const finalizedId = await saveComplete({
      questionIds: qIds.slice(0, 10),
      startDate: far,
      endDate: far + 7 * DAY,
    })
    await finalizePreparedExam({ examId: finalizedId })
    await saveNew({
      ...base,
      questionIds: [qIds[10], qIds[11]],
      startDate: far + DAY,
      endDate: far + 8 * DAY,
    })

    const notUsed = await db
      .select({ id: questions.id })
      .from(questions)
      .where(
        sql`${inArray(questions.id, [qIds[0], qIds[10]])} and ${notUsedInLastExams(1, sql`"questions"."id"`)}`,
      )

    expect(notUsed.map((r) => r.id)).toEqual([qIds[10]])
  })
})

describe("concurrence", () => {
  it("deux finalisations simultanées : une seule passe", async () => {
    const examId = await saveComplete()

    const results = await Promise.all([
      finalizePreparedExam({ examId }),
      finalizePreparedExam({ examId }),
    ])

    expect(results.filter((r) => r.success)).toHaveLength(1)
    expect(results).toContainEqual({
      success: false,
      error: "Cet examen est déjà finalisé.",
    })
  })

  it("deux enregistrements simultanés : le jeu est celui de l'un des deux, entier", async () => {
    const examId = await saveNew({ ...base, ...openWindow() })
    const setA = qIds.slice(0, 10)
    const setB = qIds.slice(2, 12)

    asAdmin()
    const results = await Promise.all(
      [setA, setB].map((questionIds) =>
        saveExam({ id: examId, ...base, ...openWindow(), questionIds }),
      ),
    )

    expect(results.every((r) => r.success)).toBe(true)
    const stored = [...(await orderOf(examId))].sort()
    expect([[...setA].sort(), [...setB].sort()]).toContainEqual(stored)
  })

  it("finalisation et démarrage simultanés : pas de participation sans finalisation", async () => {
    const examId = await saveComplete()

    asUser(STUDENT_ID)
    const start = startExam({ examId })
    asAdmin()
    const [started] = await Promise.all([
      start,
      finalizePreparedExam({ examId }),
    ])

    // Sérialisés par le verrou de l'examen : le démarrage passe après la
    // finalisation, sur le jeu qu'elle a fixé, ou il est refusé et ne laisse
    // aucune participation. Sans la garde, un démarrage passé avant la
    // finalisation laisserait une participation antérieure à elle.
    const row = await examRow(examId)
    expect(row?.finalizedAt).toBeInstanceOf(Date)
    const participations = await db
      .select({
        id: examParticipations.id,
        startedAt: examParticipations.startedAt,
      })
      .from(examParticipations)
      .where(eq(examParticipations.examId, examId))
    expect(participations).toHaveLength(started.success ? 1 : 0)
    const finalSet = [...(await orderOf(examId))].sort()
    for (const p of participations) {
      expect(p.startedAt?.getTime()).toBeGreaterThanOrEqual(
        row?.finalizedAt?.getTime() ?? Infinity,
      )
      const answered = await db
        .select({ questionId: examAnswers.questionId })
        .from(examAnswers)
        .where(eq(examAnswers.participationId, p.id))
      expect(answered.map((a) => a.questionId).sort()).toEqual(finalSet)
    }
  })
})
