import { eq } from "drizzle-orm"
import { describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  examQuestions,
  exams,
  questions,
  trainingSessionItems,
  trainingSessions,
  user,
} from "@/db/schema"
import {
  getMyDashboard,
  getMyExamHistory,
  getMyProgression,
} from "@/features/analytics/dal"
import { viewerOf } from "@/features/questions/answer-key-lock"
import { getRevisionCounts } from "@/features/training/revision"
import {
  shiftCalendarDay,
  startOfAppZoneDay,
  toAppZoneCalendarDay,
} from "@/lib/app-zone"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"
import { objectiveIdFor } from "../helpers/objective"
import { seedAccess } from "../helpers/seed-payments"

vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
const NOW = Date.now()
const daysAgo = (n: number) => new Date(NOW - n * DAY)

const newStudent = async ({ training = false } = {}) => {
  const id = createId()
  await db.insert(user).values({
    id,
    name: "Progression",
    email: `progression-${id}@test.invalid`,
  })
  if (training) await seedAccess(id, "training", new Date(NOW + 20 * DAY))
  vi.mocked(getCurrentSession).mockResolvedValue({
    user: { id, role: "user" },
  } as never)
  return id
}

const newQuestion = async (domain: string, objectiveId: string) => {
  const id = createId()
  await db.insert(questions).values({
    id,
    question: "Q",
    correctAnswer: "A",
    options: ["A", "B"],
    objectiveId,
    domain,
  })
  return id
}

/** Une série close à `at` (commencée seulement, ou abandonnée), une réponse par question. */
const train = async (
  userId: string,
  at: Date,
  answers: { questionId: string; isCorrect: boolean }[] = [],
  {
    status = "completed",
  }: { status?: "completed" | "in_progress" | "abandoned" } = {},
) => {
  const sessionId = createId()
  await db.insert(trainingSessions).values({
    id: sessionId,
    userId,
    status,
    mode: "test",
    questionCount: Math.max(answers.length, 1),
    startedAt: new Date(at.getTime() - 60_000),
    completedAt: status === "in_progress" ? null : at,
    expiresAt: new Date(at.getTime() + DAY),
  })
  if (answers.length > 0) {
    await db.insert(trainingSessionItems).values(
      answers.map((a, position) => ({
        sessionId,
        questionId: a.questionId,
        position,
        selectedAnswer: "A",
        isCorrect: a.isCorrect,
        answeredAt: at,
      })),
    )
  }
}

/** Un examen blanc et la participation de `userId`, soumise à `completedAt` (ou en cours). */
const sitExam = async (
  userId: string,
  {
    open,
    completedAt,
    score = 0,
    questionIds = [],
    status = "completed",
    startedAt = new Date((completedAt?.getTime() ?? NOW) - HOUR),
  }: {
    open: boolean
    completedAt: Date | null
    score?: number
    questionIds?: string[]
    status?: "completed" | "auto_submitted"
    startedAt?: Date
  },
) => {
  const examId = createId()
  await db.insert(exams).values({
    id: examId,
    title: `Examen ${examId}`,
    startDate: new Date(NOW - 60 * DAY),
    endDate: open
      ? new Date(NOW + DAY)
      : new Date((completedAt?.getTime() ?? NOW) + 60_000),
    completionTime: 3600,
    createdBy: userId,
    targetQuestionCount: 10,
    finalizedAt: new Date(),
  })
  if (questionIds.length > 0) {
    await db.insert(examQuestions).values(
      questionIds.map((questionId, position) => ({
        examId,
        questionId,
        position,
      })),
    )
  }
  const participationId = createId()
  await db.insert(examParticipations).values({
    id: participationId,
    examId,
    userId,
    status: completedAt ? status : "in_progress",
    score,
    startedAt,
    completedAt,
  })
  if (questionIds.length > 0) {
    await db.insert(examAnswers).values(
      questionIds.map((questionId) => ({
        participationId,
        questionId,
        selectedAnswer: null,
        isCorrect: null,
      })),
    )
  }
  return examId
}

const domainOf = async (domain: string, period: "7" | "30" | "tout" = "30") =>
  (await getMyProgression(period))!.domains.find((d) => d.domain === domain)!

describe("getMyProgression — maîtrise et couverture", () => {
  it("par objectif et par domaine, écarte une question à clé retenue tant que l'examen est ouvert", async () => {
    const objective = await objectiveIdFor(`Objectif ${createId()}`)
    const [q1, q2] = [
      await newQuestion("Cardiologie", objective),
      await newQuestion("Cardiologie", objective),
    ]
    // Jamais répondue : compte dans le total, pas dans la couverture.
    await newQuestion("Cardiologie", objective)
    const student = await newStudent()
    await train(student, daysAgo(3), [
      { questionId: q1, isCorrect: true },
      { questionId: q2, isCorrect: false },
    ])

    const before = await domainOf("Cardiologie")
    expect(before).toMatchObject({ total: 3, answered: 2, mastery: 50 })
    expect(before.objectives).toEqual([
      expect.objectContaining({
        id: objective,
        total: 3,
        covered: 2,
        mastery: 50,
      }),
    ])

    // Un examen ouvert contient q2 : sa clé est retenue pour l'étudiant.
    await sitExam(student, { open: true, completedAt: null, questionIds: [q2] })

    const locked = await domainOf("Cardiologie")
    expect(locked).toMatchObject({ total: 2, answered: 1, mastery: 100 })
    expect(locked.objectives).toEqual([
      expect.objectContaining({ total: 2, covered: 1, mastery: 100 }),
    ])
  })

  it("n'affiche pas un objectif à corriger (valeur invalide du référentiel)", async () => {
    const valid = await objectiveIdFor(`Valide ${createId()}`)
    const invalid = await objectiveIdFor(`Invalide ${createId()}`, {
      needsFix: true,
    })
    await newQuestion("Dermatologie", valid)
    await newQuestion("Dermatologie", invalid)
    await newStudent()

    const dermatologie = await domainOf("Dermatologie")
    expect(dermatologie.total).toBe(2)
    expect(dermatologie.objectives.map((o) => o.id)).toEqual([valid])
  })
})

describe("getMyProgression — tendance de maîtrise", () => {
  it("vaut l'écart avec la maîtrise au début de la période ; null sur « Tout » et sans réponse antérieure", async () => {
    const objective = await objectiveIdFor(`Tendance ${createId()}`)
    const [qa, qb] = [
      await newQuestion("Néphrologie", objective),
      await newQuestion("Néphrologie", objective),
    ]
    const recent = await newQuestion("Endocrinologie", objective)
    const student = await newStudent()
    await train(student, daysAgo(40), [
      { questionId: qa, isCorrect: true },
      { questionId: qb, isCorrect: false },
    ])
    await train(student, daysAgo(2), [
      { questionId: qb, isCorrect: true },
      { questionId: recent, isCorrect: true },
    ])

    expect(await domainOf("Néphrologie", "30")).toMatchObject({
      mastery: 100,
      trend: 50,
      periodAnswers: 1,
    })
    expect(await domainOf("Néphrologie", "tout")).toMatchObject({
      mastery: 100,
      trend: null,
      periodAnswers: 3,
    })
    // Rien avant le début de la période : pas de tendance.
    expect(await domainOf("Endocrinologie", "30")).toMatchObject({
      mastery: 100,
      trend: null,
    })
  })

  it("jumeau : un recul se lit négatif", async () => {
    const objective = await objectiveIdFor(`Recul ${createId()}`)
    const q = await newQuestion("Urologie", objective)
    const student = await newStudent()
    await train(student, daysAgo(10), [{ questionId: q, isCorrect: true }])
    await train(student, daysAgo(1), [{ questionId: q, isCorrect: false }])

    expect(await domainOf("Urologie", "7")).toMatchObject({
      mastery: 0,
      trend: -100,
    })
  })
})

describe("getMyProgression — réponse sans date", () => {
  it("compte comme la plus ancienne, au début de la période comme aujourd'hui", async () => {
    const objective = await objectiveIdFor(`Sans date ${createId()}`)
    const q = await newQuestion("Ophtalmologie", objective)
    const student = await newStudent()
    await train(student, daysAgo(30), [{ questionId: q, isCorrect: true }])
    await db
      .update(trainingSessionItems)
      .set({ answeredAt: null })
      .where(eq(trainingSessionItems.questionId, q))

    expect(await domainOf("Ophtalmologie", "7")).toMatchObject({
      mastery: 100,
      trend: 0,
    })
  })
})

describe("getMyProgression — jours d'activité", () => {
  const today = toAppZoneCalendarDay(NOW)
  const dayStart = (back: number) =>
    startOfAppZoneDay(shiftCalendarDay(today, -back)).getTime()

  it("compte les journées civiles de l'Est avec une série close ou un examen soumis", async () => {
    // L'activité d'un autre étudiant, sur d'autres jours, ne compte pas.
    const classmate = await newStudent()
    await train(classmate, new Date(dayStart(5) + 10 * HOUR))
    await sitExam(classmate, {
      open: false,
      completedAt: new Date(dayStart(4) + 10 * HOUR),
    })
    const student = await newStudent()

    // Jour J-3 : deux séries, dont une à 23 h 30 heure de l'Est (le
    // lendemain en UTC) — une seule journée.
    await train(student, new Date(dayStart(3) + HOUR))
    await train(student, new Date(dayStart(3) + 23.5 * HOUR))
    // Jour J-2 : un examen soumis automatiquement.
    await sitExam(student, {
      open: false,
      completedAt: new Date(dayStart(2) + 10 * HOUR),
      status: "auto_submitted",
    })
    // Jour J-1 : une série seulement commencée, ou abandonnée à son
    // expiration, ne compte pas.
    await train(student, new Date(dayStart(1) + 10 * HOUR), [], {
      status: "in_progress",
    })
    await train(student, new Date(dayStart(1) + 11 * HOUR), [], {
      status: "abandoned",
    })
    // Hors des 7 jours.
    await train(student, new Date(dayStart(20) + 10 * HOUR))

    expect((await getMyProgression("7"))!.activity).toEqual({
      days: 2,
      firstDay: shiftCalendarDay(today, -3),
    })
    expect((await getMyProgression("tout"))!.activity).toEqual({
      days: 3,
      firstDay: shiftCalendarDay(today, -20),
    })
  })

  it("date une participation close par le cron du jour où elle a commencé", async () => {
    const student = await newStudent()
    // Commencée à J-5, abandonnée, close par le cron le soir de J-4.
    await sitExam(student, {
      open: false,
      startedAt: new Date(dayStart(5) + 10 * HOUR),
      completedAt: new Date(dayStart(4) + 20 * HOUR),
      status: "auto_submitted",
    })
    expect((await getMyProgression("tout"))!.activity).toEqual({
      days: 1,
      firstDay: shiftCalendarDay(today, -5),
    })
  })

  it("rend zéro jour sans activité", async () => {
    await newStudent()
    expect((await getMyProgression("30"))!.activity).toEqual({
      days: 0,
      firstDay: null,
    })
  })
})

describe("getMyProgression — compteurs de révision", () => {
  it("rend par domaine les compteurs de getRevisionCounts, avec l'accès Entraînement", async () => {
    const objective = await objectiveIdFor(`Révision ${createId()}`)
    const [failed, seen] = [
      await newQuestion("Rhumatologie", objective),
      await newQuestion("Rhumatologie", objective),
    ]
    await newQuestion("Rhumatologie", objective)
    const student = await newStudent({ training: true })
    await train(student, daysAgo(2), [
      { questionId: failed, isCorrect: false },
      { questionId: seen, isCorrect: true },
    ])

    const progression = (await getMyProgression("30"))!
    expect(progression.trainingAccess).toBe(true)
    const rhumatologie = progression.domains.find(
      (d) => d.domain === "Rhumatologie",
    )!
    const counts = await getRevisionCounts(
      viewerOf({ id: student, role: "user" }),
      { domain: "Rhumatologie" },
    )
    expect(rhumatologie.revision).toEqual({
      failed: counts.failed,
      unseen: counts.unseen,
      bookmarked: counts.bookmarked,
    })
    expect(rhumatologie.revision).toEqual({
      failed: 1,
      unseen: 1,
      bookmarked: 0,
    })
  })

  it("sans accès Entraînement, aucun compteur", async () => {
    await newStudent()
    const progression = (await getMyProgression("30"))!
    expect(progression.trainingAccess).toBe(false)
    expect(progression.domains.every((d) => d.revision === null)).toBe(true)
  })
})

describe("score retenu", () => {
  it("n'entre ni dans le score moyen ni dans N / M réussis, et se lit null dans l'historique", async () => {
    const student = await newStudent()
    await sitExam(student, { open: false, completedAt: daysAgo(5), score: 50 })
    const openExam = await sitExam(student, {
      open: true,
      completedAt: daysAgo(1),
      score: 90,
    })

    const dashboard = (await getMyDashboard("30"))!
    expect(dashboard.exams).toMatchObject({
      averageScore: 50,
      periodGradedCount: 1,
      periodPassedCount: 0,
    })

    const history = await getMyExamHistory()
    expect(history.items.map((i) => [i.examId === openExam, i.score])).toEqual([
      [true, null],
      [false, 50],
    ])
  })
})

describe("getMyExamHistory", () => {
  it("pagine par 10, dans les deux sens, avec le total", async () => {
    // Les participations d'un autre étudiant n'entrent ni dans la liste ni
    // dans le total.
    const classmate = await newStudent()
    await sitExam(classmate, { open: false, completedAt: daysAgo(2) })
    const student = await newStudent()
    for (let i = 0; i < 12; i++) {
      await sitExam(student, {
        open: false,
        completedAt: daysAgo(i + 1),
        score: 70,
      })
    }

    const first = await getMyExamHistory()
    expect(first).toMatchObject({ total: 12, firstIndex: 0, prevCursor: null })
    expect(first.items).toHaveLength(10)
    expect(first.nextCursor).not.toBeNull()

    const second = await getMyExamHistory(first.nextCursor)
    expect(second).toMatchObject({
      total: 12,
      firstIndex: 10,
      nextCursor: null,
    })
    expect(second.items).toHaveLength(2)
    expect(second.items[0]!.completedAt).toBeLessThan(
      first.items.at(-1)!.completedAt,
    )

    const back = await getMyExamHistory(null, second.prevCursor)
    expect(back.firstIndex).toBe(0)
    expect(back.items.map((i) => i.examId)).toEqual(
      first.items.map((i) => i.examId),
    )
  })

  it("revient en tête de liste sur un curseur qui ne mène plus à rien", async () => {
    const student = await newStudent()
    for (let i = 0; i < 11; i++) {
      await sitExam(student, { open: false, completedAt: daysAgo(i + 1) })
    }
    const first = await getMyExamHistory()
    const second = await getMyExamHistory(first.nextCursor)
    expect(second.items).toHaveLength(1)
    // La seule copie de la page 2 est supprimée par un admin.
    await db
      .delete(examParticipations)
      .where(eq(examParticipations.examId, second.items[0]!.examId))

    const stale = await getMyExamHistory(first.nextCursor)
    expect(stale).toMatchObject({ total: 10, firstIndex: 0 })
    expect(stale.items).toHaveLength(10)
  })

  it("rend une page vide sans session", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null)
    expect(await getMyExamHistory()).toMatchObject({ items: [], total: 0 })
    expect(await getMyProgression("30")).toBeNull()
  })
})
