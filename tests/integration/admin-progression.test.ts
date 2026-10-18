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
  getMyExamPercentiles,
  getMyProgression,
} from "@/features/analytics/dal"
import {
  type StudentProgressFilters,
  getStudentProgress,
  getStudentProgressList,
  getStudentProgressNeighbors,
} from "@/features/analytics/dal.admin-progression"
import { getCurrentSession } from "@/lib/dal"
import type { DashboardPeriod } from "@/lib/dashboard-period"
import { createId } from "@/lib/ids"
import { objectiveIdFor } from "../helpers/objective"
import { seedAccess } from "../helpers/seed-payments"

vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
const NOW = Date.now()
const daysAgo = (n: number) => new Date(NOW - n * DAY)

const signIn = (id: string, role: "user" | "admin") =>
  vi.mocked(getCurrentSession).mockResolvedValue({
    user: { id, role },
  } as never)

const newAccount = async ({
  name = "Étudiant",
  role = "user",
  ...rest
}: {
  name?: string
  role?: "user" | "admin"
  banned?: boolean
  deletedAt?: Date
} = {}) => {
  const id = createId()
  await db.insert(user).values({
    id,
    name,
    email: `progression-${id}@test.invalid`,
    role,
    ...rest,
  })
  return id
}

const newAdmin = () => newAccount({ name: "Admin", role: "admin" })

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

/** Une série close à `at`, une réponse par question. */
const train = async (
  userId: string,
  at: Date,
  answers: { questionId: string; isCorrect: boolean }[] = [],
  questionCount = Math.max(answers.length, 1),
) => {
  const sessionId = createId()
  await db.insert(trainingSessions).values({
    id: sessionId,
    userId,
    status: "completed",
    mode: "test",
    questionCount,
    score: 80,
    startedAt: new Date(at.getTime() - 60_000),
    completedAt: at,
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

/** Un examen blanc et la participation soumise de `userId`, ouvert ou clos. */
const sitExam = async (
  userId: string,
  {
    open,
    completedAt,
    score,
    questionIds = [],
  }: {
    open: boolean
    completedAt: Date
    score: number
    questionIds?: string[]
  },
) => {
  const examId = createId()
  await db.insert(exams).values({
    id: examId,
    title: `Examen ${examId}`,
    startDate: new Date(NOW - 90 * DAY),
    endDate: open
      ? new Date(NOW + DAY)
      : new Date(completedAt.getTime() + 60_000),
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
    status: "completed",
    score,
    startedAt: new Date(completedAt.getTime() - HOUR),
    completedAt,
  })
  if (questionIds.length > 0) {
    await db.insert(examAnswers).values(
      questionIds.map((questionId) => ({
        participationId,
        questionId,
        selectedAnswer: "A",
        isCorrect: true,
      })),
    )
  }
  return examId
}

/** Ce que l'étudiant lit sur sa page Progression, connecté. */
const ownReads = async (studentId: string, period: DashboardPeriod) => {
  signIn(studentId, "user")
  const [dashboard, progression, history] = await Promise.all([
    getMyDashboard(period),
    getMyProgression(period),
    getMyExamHistory(),
  ])
  const percentiles = await getMyExamPercentiles(
    history.items.map((i) => i.examId),
  )
  return { dashboard, progression, history, percentiles }
}

/** Un jeton propre au test, posé dans les noms : la recherche isole ses comptes. */
const token = () => createId().slice(0, 10)

const list = (
  search: string,
  options: Partial<StudentProgressFilters> & { offset?: number } = {},
) =>
  getStudentProgressList({
    search,
    period: "30",
    sortBy: "lastActivity",
    sortOrder: "desc",
    ...options,
  })

describe("getStudentProgressList — population", () => {
  it("liste les étudiants, suspendus et inactifs compris, sans admin ni compte supprimé", async () => {
    const t = token()
    const active = await newAccount({ name: `Actif ${t}` })
    const suspended = await newAccount({ name: `Suspendu ${t}`, banned: true })
    const idle = await newAccount({ name: `Inactif ${t}` })
    await newAccount({ name: `Admin ${t}`, role: "admin" })
    await newAccount({ name: `Supprimé ${t}`, deletedAt: daysAgo(40) })
    await train(active, daysAgo(2))
    signIn(await newAdmin(), "admin")

    const page = await list(t)

    expect(page.total).toBe(3)
    expect(page.items.map((r) => r.id).toSorted()).toEqual(
      [active, suspended, idle].toSorted(),
    )
    expect(page.items.find((r) => r.id === suspended)?.banned).toBe(true)
    expect(page.items.find((r) => r.id === idle)).toMatchObject({
      averageScore: null,
      examsGraded: null,
      examsPassed: null,
      questionCount: null,
      activityDays: null,
      lastActivityAt: null,
    })
  })

  it("refuse un non-admin", async () => {
    signIn(await newAccount(), "user")
    await expect(list(token())).rejects.toThrow("NEXT_REDIRECT")
  })
})

describe("getStudentProgressList — chiffres de la bande", () => {
  it("rend, sur la période, les chiffres de la bande que l'étudiant lit sur sa page", async () => {
    const t = token()
    const objective = await objectiveIdFor(`Bande ${t}`)
    const q = await newQuestion("Cardiologie", objective)
    const student = await newAccount({ name: `Bande ${t}` })
    await train(student, daysAgo(3), [], 25)
    await train(student, daysAgo(3), [], 15)
    await train(student, daysAgo(45), [], 40)
    await sitExam(student, { open: false, completedAt: daysAgo(40), score: 50 })
    await sitExam(student, { open: false, completedAt: daysAgo(6), score: 72 })
    await sitExam(student, { open: false, completedAt: daysAgo(4), score: 55 })
    // Ouvert : score retenu, hors moyenne et hors « réussis / notés ».
    await sitExam(student, {
      open: true,
      completedAt: daysAgo(1),
      score: 95,
      questionIds: [q],
    })
    const admin = await newAdmin()

    for (const period of ["7", "30", "tout"] as const) {
      const own = await ownReads(student, period)
      signIn(admin, "admin")
      const [row] = (await list(t, { period })).items

      expect(row).toMatchObject({
        averageScore: own.dashboard!.exams.averageScore,
        averageTrend: own.dashboard!.exams.averageTrend,
        examsPassed: own.dashboard!.exams.periodPassedCount,
        examsGraded: own.dashboard!.exams.periodGradedCount,
        questionCount: own.dashboard!.training.questionCount,
        activityDays: own.progression!.activity.days,
      })
    }
    // Valeurs connues sur 30 jours : moyenne de 72 et 55, contre 50 avant.
    expect((await list(t)).items[0]).toMatchObject({
      averageScore: 63,
      averageTrend: 13,
      examsPassed: 1,
      examsGraded: 2,
      questionCount: 40,
      activityDays: 4,
    })
  })

  it("garde la dernière activité hors de la période", async () => {
    const t = token()
    const student = await newAccount({ name: `Ancien ${t}` })
    const last = daysAgo(50)
    await train(student, last, [], 12)
    signIn(await newAdmin(), "admin")

    expect((await list(t, { period: "7" })).items[0]).toMatchObject({
      lastActivityAt: last.getTime(),
      questionCount: 0,
      activityDays: 0,
      averageScore: null,
      examsGraded: null,
    })
  })
})

describe("getStudentProgressList — filtres", () => {
  it("fusionne les deux accès : actif si l'un l'est, expiré si l'un a existé, aucun sinon", async () => {
    const t = token()
    const examOnly = await newAccount({ name: `Examens ${t}` })
    const mixed = await newAccount({ name: `Mixte ${t}` })
    const lapsed = await newAccount({ name: `Expiré ${t}` })
    const never = await newAccount({ name: `Jamais ${t}` })
    await seedAccess(examOnly, "exam", new Date(NOW + 10 * DAY))
    await seedAccess(mixed, "exam", daysAgo(5))
    await seedAccess(mixed, "training", new Date(NOW + 10 * DAY))
    await seedAccess(lapsed, "training", daysAgo(5))
    signIn(await newAdmin(), "admin")

    const accessOf = async (access?: "active" | "expired" | "none") =>
      (await list(t, { access })).items.map((r) => r.id).toSorted()

    expect(
      Object.fromEntries((await list(t)).items.map((r) => [r.id, r.access])),
    ).toEqual({
      [examOnly]: "active",
      [mixed]: "active",
      [lapsed]: "expired",
      [never]: "none",
    })
    expect(await accessOf("active")).toEqual([examOnly, mixed].toSorted())
    expect(await accessOf("expired")).toEqual([lapsed])
    expect(await accessOf("none")).toEqual([never])
  })

  it("« Actifs seulement » retient un jour d'activité sur la période", async () => {
    const t = token()
    const recent = await newAccount({ name: `Récent ${t}` })
    const old = await newAccount({ name: `Ancien ${t}` })
    await newAccount({ name: `Jamais ${t}` })
    await train(recent, daysAgo(2))
    await train(old, daysAgo(20))
    signIn(await newAdmin(), "admin")

    const active = async (period: DashboardPeriod) =>
      (await list(t, { period, activeOnly: true })).items.map((r) => r.id)

    expect(await active("7")).toEqual([recent])
    expect((await active("30")).toSorted()).toEqual([recent, old].toSorted())
  })
})

describe("getStudentProgressList — tri et pagination", () => {
  it("met une valeur absente en dernier dans les deux sens, puis par nom", async () => {
    const t = token()
    const low = await newAccount({ name: `C ${t}` })
    const high = await newAccount({ name: `D ${t}` })
    const noneB = await newAccount({ name: `B ${t}` })
    const noneA = await newAccount({ name: `A ${t}` })
    await sitExam(low, { open: false, completedAt: daysAgo(3), score: 40 })
    await sitExam(high, { open: false, completedAt: daysAgo(3), score: 80 })
    signIn(await newAdmin(), "admin")

    const order = async (sortOrder: "asc" | "desc") =>
      (await list(t, { sortBy: "score", sortOrder })).items.map((r) => r.id)

    expect(await order("desc")).toEqual([high, low, noneA, noneB])
    expect(await order("asc")).toEqual([low, high, noneA, noneB])
  })

  it("trie par défaut sur la dernière activité, la plus récente d'abord", async () => {
    const t = token()
    const older = await newAccount({ name: `A ${t}` })
    const newer = await newAccount({ name: `B ${t}` })
    const never = await newAccount({ name: `C ${t}` })
    await train(older, daysAgo(10))
    await sitExam(newer, { open: false, completedAt: daysAgo(1), score: 60 })
    signIn(await newAdmin(), "admin")

    expect((await list(t)).items.map((r) => r.id)).toEqual([
      newer,
      older,
      never,
    ])
  })

  it("pagine par 20 et donne les voisins à travers une frontière de page", async () => {
    const t = token()
    const ids: string[] = []
    for (let k = 0; k < 22; k++) {
      ids.push(
        await newAccount({ name: `Page ${String(k).padStart(2, "0")} ${t}` }),
      )
    }
    signIn(await newAdmin(), "admin")
    const filters = {
      search: t,
      period: "30",
      sortBy: "lastActivity",
      sortOrder: "desc",
    } as const

    const first = await list(t)
    const second = await list(t, { offset: 20 })
    expect(first.total).toBe(22)
    expect(first.items.map((r) => r.id)).toEqual(ids.slice(0, 20))
    expect(second.items.map((r) => r.id)).toEqual(ids.slice(20))

    expect(await getStudentProgressNeighbors(ids[19], filters)).toEqual({
      position: 20,
      total: 22,
      previousId: ids[18],
      nextId: ids[20],
    })
    expect(await getStudentProgressNeighbors(ids[0], filters)).toMatchObject({
      previousId: null,
      nextId: ids[1],
    })
    // Hors de la liste filtrée : un compte que la recherche ne retient pas.
    const outsider = await newAccount({ name: `Ailleurs ${token()}` })
    expect(await getStudentProgressNeighbors(outsider, filters)).toBeNull()
  })

  it("refuse les voisins à un non-admin", async () => {
    const student = await newAccount()
    signIn(student, "user")
    await expect(
      getStudentProgressNeighbors(student, {
        period: "30",
        sortBy: "lastActivity",
        sortOrder: "desc",
      }),
    ).rejects.toThrow("NEXT_REDIRECT")
  })
})

describe("getStudentProgress — miroir de la page étudiante", () => {
  it("rend, pour chaque période, les chiffres que l'étudiant lit connecté, examen ouvert à score retenu compris", async () => {
    const objective = await objectiveIdFor(`Miroir ${createId()}`)
    const [q1, q2, q3] = [
      await newQuestion("Cardiologie", objective),
      await newQuestion("Cardiologie", objective),
      await newQuestion("Pneumologie", objective),
    ]
    const student = await newAccount({ name: "Miroir" })
    await seedAccess(student, "training", new Date(NOW + 20 * DAY))
    await train(student, daysAgo(40), [{ questionId: q1, isCorrect: false }])
    await train(student, daysAgo(2), [
      { questionId: q1, isCorrect: true },
      { questionId: q2, isCorrect: false },
      { questionId: q3, isCorrect: true },
    ])
    await sitExam(student, { open: false, completedAt: daysAgo(35), score: 50 })
    await sitExam(student, { open: false, completedAt: daysAgo(5), score: 72 })
    // Examen encore ouvert qui contient q2 : score et clé retenus pour l'étudiant.
    const openExam = await sitExam(student, {
      open: true,
      completedAt: daysAgo(1),
      score: 90,
      questionIds: [q2],
    })
    const admin = await newAdmin()

    for (const period of ["7", "30", "tout"] as const) {
      const own = await ownReads(student, period)
      signIn(admin, "admin")
      const mirror = await getStudentProgress(student, period)

      expect(mirror).toEqual({
        student: expect.objectContaining({ id: student, name: "Miroir" }),
        ...own,
      })
      expect(
        mirror!.history.items.find((i) => i.examId === openExam)?.score,
      ).toBeNull()
    }
  })

  it("introuvable pour un identifiant inconnu, un compte admin ou un compte supprimé", async () => {
    const admin = await newAdmin()
    const deleted = await newAccount({ deletedAt: daysAgo(40) })
    signIn(admin, "admin")

    expect(await getStudentProgress(createId(), "30")).toBeNull()
    expect(await getStudentProgress(admin, "30")).toBeNull()
    expect(await getStudentProgress(deleted, "30")).toBeNull()
  })

  it("refuse un non-admin, même pour sa propre progression", async () => {
    const student = await newAccount()
    signIn(student, "user")

    await expect(getStudentProgress(student, "30")).rejects.toThrow(
      "NEXT_REDIRECT",
    )
  })
})
