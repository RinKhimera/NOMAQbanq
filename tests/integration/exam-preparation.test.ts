import { asc, eq, inArray, sql } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  examQuestions,
  exams,
  questions,
  user,
} from "@/db/schema"
import { getMyDashboard } from "@/features/analytics/dal.dashboard"
import {
  finalizePreparedExam,
  saveExam,
  startExam,
} from "@/features/exams/actions"
import { closeExpiredExamParticipations } from "@/features/exams/cron"
import {
  getAdminExam,
  getExamLeaderboard,
  getExamWithQuestions,
  getExamsOverview,
  getExamsWithParticipation,
  getParticipantExamResults,
} from "@/features/exams/dal"
import { sendExamResultsNotifications } from "@/features/notifications/cron"
import { updateQuestion } from "@/features/questions/actions"
import { excludeLocked, lockFor } from "@/features/questions/answer-key-lock"
import { notUsedInLastExams } from "@/features/questions/last-use"
import { getAdminStats } from "@/features/users/dal"
import { getCurrentSession } from "@/lib/dal"
import { getPgErrorCode } from "@/lib/db-errors"
import { adminPhaseOf } from "@/lib/exam-phase"
import { createId } from "@/lib/ids"
import { createFinalizedExam, saveAndFinalize } from "../helpers/exam-form"
import { TEST_OBJECTIVE_ID } from "../helpers/objective"
import { seedExam } from "../helpers/seed-exam"
import { seedAccess } from "../helpers/seed-payments"

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))
vi.mock("@/email", () =>
  import("../helpers/fake-mailer").then((m) => m.fakeMailer),
)
vi.mock("@/lib/aws", () => ({
  createPresignedUpload: vi.fn(),
  deleteFromS3: vi.fn(),
  copyInS3: vi.fn().mockResolvedValue(undefined),
}))

const DAY = 24 * 60 * 60 * 1000

const ADMIN_ID = createId()
const STUDENT_ID = createId()
// 12 questions : un jeu complet de 10, et de quoi en changer.
const qIds = Array.from({ length: 12 }, () => createId())
const deletedQId = createId()
// Dans aucun autre examen du fichier : les choix figés s'y lisent seuls.
const freeQId = createId()
// Seule dans un examen en préparation sans dates : le verrou anonyme s'y lit seul.
const undatedQId = createId()

const asUser = (id: string, role: "user" | "admin" = "user") =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue({ user: { id, role } } as never)
const asAdmin = () => asUser(ADMIN_ID, "admin")

// « Enregistrer » reçoit toujours l'état entier du formulaire.
const base = {
  title: "Préparation",
  targetQuestionCount: 10,
  startDate: null,
  endDate: null,
  enablePause: false,
  audienceType: "subscribers" as const,
  audienceUserIds: [] as string[],
  isHidden: false,
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
      email: "prep-adm@test.invalid",
      role: "admin",
    },
    {
      id: STUDENT_ID,
      name: "Prép étudiant",
      email: "prep-stu@test.invalid",
    },
  ])
  await db.insert(questions).values([
    ...qIds.map((id, i) => ({
      id,
      question: `Q préparation ${i}`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectiveId: TEST_OBJECTIVE_ID,
      domain: "Cardiologie",
    })),
    {
      id: undatedQId,
      question: "Q sans dates",
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectiveId: TEST_OBJECTIVE_ID,
      domain: "Cardiologie",
    },
    {
      id: freeQId,
      question: "Q libre",
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectiveId: TEST_OBJECTIVE_ID,
      domain: "Cardiologie",
    },
    {
      id: deletedQId,
      question: "Q supprimée",
      correctAnswer: "A",
      options: ["A", "B"],
      objectiveId: TEST_OBJECTIVE_ID,
      domain: "Cardiologie",
    },
  ])

  // Accès Examens de l'étudiant : le tableau de bord ne compte les examens
  // disponibles qu'avec lui.
  await seedAccess(STUDENT_ID, "exam", new Date(Date.now() + 20 * DAY))
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
    expect(await orderOf(examId)).toEqual(qIds.slice(0, 3))

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

  it("sans aucune question ni date, se relit puis se réenregistre tel quel", async () => {
    const input = { ...base, questionIds: [] }
    const examId = await saveNew(input)
    const first = await getAdminExam(examId)
    expect(first?.exam).toMatchObject({
      finalizedAt: null,
      startDate: null,
      endDate: null,
      questionCount: 0,
      targetQuestionCount: 10,
    })

    expect(await saveExam({ id: examId, ...input })).toEqual({
      success: true,
      examId,
      finalized: false,
    })
    expect(await getAdminExam(examId)).toEqual(first)
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

  it("en préparation dans la vue de pilotage, dans aucune phase datée", async () => {
    const examId = await saveNew({
      ...base,
      ...openWindow(),
      audienceType: "subscribers",
    })
    asAdmin()
    const item = (await getExamsOverview()).find((e) => e.id === examId)
    expect(item && adminPhaseOf(item, Date.now())).toBe("preparation")
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

    asAdmin()
    expect(await getExamLeaderboard(examId)).toEqual([])
    asUser(STUDENT_ID)
    expect(await getParticipantExamResults(examId, STUDENT_ID)).toBeNull()

    asAdmin()
    expect(await getParticipantExamResults(examId, STUDENT_ID)).toBeNull()
  })

  it("jumeau : les mêmes lectures répondent sur un examen finalisé", async () => {
    const examId = await seedExam({
      createdBy: ADMIN_ID,
      title: "Jumeau",
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
    // Fenêtres posées autour d'une date que ce test est seul à occuper : les
    // examens des autres tests, datés autour d'aujourd'hui, y sont tous à
    // venir. Les compteurs datés s'y relèvent en valeurs exactes.
    const anchor = Date.UTC(2001, 0, 15)
    const openAt = { startDate: anchor - DAY, endDate: anchor + 7 * DAY }
    const closedAt = { startDate: anchor - 7 * DAY, endDate: anchor - DAY }
    const datedCountersAtAnchor = async () => {
      // `getAdminStats` lit son `now` dans l'horloge JS.
      vi.useFakeTimers({ toFake: ["Date"], now: anchor })
      try {
        asAdmin()
        const [overview, admin] = await Promise.all([
          getExamsOverview(),
          getAdminStats(),
        ])
        return {
          past: overview.filter((e) => adminPhaseOf(e, anchor) === "completed")
            .length,
          active: admin.activeExams,
        }
      } finally {
        vi.useRealTimers()
      }
    }
    // Sans filtre de fenêtre, la disponibilité compte tous les examens aux
    // abonnés du fichier : elle se lit en écart.
    const available = async () => {
      asUser(STUDENT_ID)
      return (await getMyDashboard("tout"))?.exams.availableCount ?? -1
    }
    const availableBefore = await available()

    await saveNew({ ...base, ...openAt, questionIds: qIds.slice(0, 3) })
    await saveNew({ ...base, ...closedAt })
    expect(await datedCountersAtAnchor()).toEqual({ past: 0, active: 0 })
    expect(await available()).toBe(availableBefore)

    // Jumeaux finalisés, mêmes fenêtres : chaque compteur bouge.
    await seedExam({
      createdBy: ADMIN_ID,
      title: "Jumeau ouvert",
      ...openAt,
      questionIds: qIds.slice(0, 3),
    })
    await seedExam({
      createdBy: ADMIN_ID,
      title: "Jumeau clos",
      ...closedAt,
      questionIds: qIds.slice(0, 3),
    })
    expect(await datedCountersAtAnchor()).toEqual({ past: 1, active: 1 })
    expect(await available()).toBe(availableBefore + 2)
  })
})

describe("crons et dates nulles", () => {
  it("la clôture et les courriels de résultats balaient sans erreur un examen sans dates", async () => {
    await saveNew({ ...base, questionIds: qIds.slice(0, 3) })

    // Aucune participation du fichier n'est sur un examen clos.
    await expect(closeExpiredExamParticipations()).resolves.toMatchObject({
      closedCount: 0,
    })
    await expect(sendExamResultsNotifications()).resolves.toBe(0)
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

  it("le formulaire crée un examen finalisé : enregistrer puis finaliser", async () => {
    asAdmin()
    const res = await createFinalizedExam({
      title: "Formulaire",
      ...openWindow(),
      questionIds: qIds.slice(0, 10),
    })
    if (!res.success) throw new Error(res.error)

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
      title: "Renommé",
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
      title: "Ancien déploiement",
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
    const res = await saveAndFinalize({
      id: examId,
      title: "Ancien déploiement",
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

describe("suspendu et en préparation", () => {
  it("finaliser un examen suspendu ne l'ouvre pas, admin compris", async () => {
    const examId = await saveComplete()
    await db.update(exams).set({ isActive: false }).where(eq(exams.id, examId))

    expect(await finalizePreparedExam({ examId })).toEqual({ success: true })

    for (const asViewer of [() => asUser(STUDENT_ID), asAdmin]) {
      asViewer()
      expect(await startExam({ examId })).toEqual({
        success: false,
        error: "Cet examen est suspendu : il ne peut pas être commencé.",
      })
    }
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
        question: "Q libre",
        options: ["A", "B", "C", "D"],
        correctAnswer: "B",
        explanation: "Parce que.",
        references: [],
        objectiveId: TEST_OBJECTIVE_ID,
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
    // Fenêtres lointaines : ces deux examens sont les plus récents du fichier.
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
