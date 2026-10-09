import { and, eq } from "drizzle-orm"
import { describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  examQuestions,
  exams,
  questions,
  user,
} from "@/db/schema"
import {
  getMyExamPercentile,
  getMyExamPercentiles,
} from "@/features/analytics/dal"
import { getExamLeaderboard } from "@/features/exams/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"
import { TEST_OBJECTIVE_ID } from "../helpers/objective"

vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const DAY = 24 * 60 * 60 * 1000

const asUser = (id: string, role: "user" | "admin" = "user") =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue({ user: { id, role } } as never)

type Participant = {
  score: number
  role?: "user" | "admin"
  deleted?: boolean
  status?: "completed" | "auto_submitted" | "in_progress"
}

/** Un examen et ses participants ; rend l'id de l'examen et ceux des participants, dans l'ordre. */
const seedExam = async (
  participants: Participant[],
  { open = false }: { open?: boolean } = {},
) => {
  const now = Date.now()
  const examId = createId()
  const userIds = participants.map(() => createId())

  await db.insert(user).values(
    participants.map((p, i) => ({
      id: userIds[i],
      name: `Pct ${i}`,
      email: `pct-${i}-${examId}@test.invalid`,
      role: p.role ?? "user",
      deletedAt: p.deleted ? new Date(now - DAY) : null,
    })),
  )
  await db.insert(exams).values({
    id: examId,
    title: "Percentile",
    startDate: new Date(now - 10 * DAY),
    endDate: open ? new Date(now + DAY) : new Date(now - DAY),
    completionTime: 3600,
    createdBy: userIds[0],
    targetQuestionCount: 10,
    finalizedAt: new Date(),
  })
  await db.insert(examParticipations).values(
    participants.map((p, i) => ({
      examId,
      userId: userIds[i],
      status: p.status ?? "completed",
      score: p.score,
      startedAt: new Date(now - 5 * DAY),
      completedAt: new Date(now - 5 * DAY + 1000),
    })),
  )
  return { examId, userIds }
}

/**
 * Rend retenu le score de la participation de `userId` à `examId` : il y a
 * répondu à une question qui figure aussi dans un examen OUVERT auquel il
 * participe (correction différée).
 */
const withholdScore = async (examId: string, userId: string) => {
  const now = Date.now()
  const questionId = createId()
  const openExamId = createId()
  await db.insert(questions).values({
    id: questionId,
    question: "Q retenue",
    correctAnswer: "A",
    options: ["A", "B"],
    objectiveId: TEST_OBJECTIVE_ID,
    domain: "Cardiologie",
  })
  await db.insert(exams).values({
    id: openExamId,
    title: "Ouvert",
    startDate: new Date(now - DAY),
    endDate: new Date(now + DAY),
    completionTime: 3600,
    createdBy: userId,
    targetQuestionCount: 10,
    finalizedAt: new Date(),
  })
  await db.insert(examQuestions).values({
    examId: openExamId,
    questionId,
    position: 0,
  })
  await db.insert(examParticipations).values({
    examId: openExamId,
    userId,
    status: "in_progress",
    startedAt: new Date(now),
  })
  const [participation] = await db
    .select({ id: examParticipations.id })
    .from(examParticipations)
    .where(
      and(
        eq(examParticipations.examId, examId),
        eq(examParticipations.userId, userId),
      ),
    )
  await db.insert(examAnswers).values({
    participationId: participation!.id,
    questionId,
    selectedAnswer: "A",
    isCorrect: true,
  })
}

const five: Participant[] = [
  { score: 70 },
  { score: 40 },
  { score: 50 },
  { score: 90 },
  { score: 60 },
]

describe("percentile d'examen", () => {
  // Le participant lu est toujours le premier de la liste.
  it.each<{
    name: string
    participants: Participant[]
    open?: boolean
    /** Index du participant dont le score est rendu retenu. */
    withheld?: number
    expected: number | null | undefined
  }>([
    {
      // 70 bat 40, 50 et 60 : 3 des 4 autres.
      name: "rend la part des autres participants au score strictement inférieur",
      participants: five,
      expected: 75,
    },
    {
      name: "n'existe pas sous 5 participations lisibles",
      participants: five.slice(0, 4),
      expected: null,
    },
    {
      // 60 bat 40 et 20, pas l'autre 60 : 2 des 4 autres.
      name: "ne compte pas les ex æquo comme battus",
      participants: [
        { score: 60 },
        { score: 60 },
        { score: 40 },
        { score: 80 },
        { score: 20 },
      ],
      expected: 50,
    },
    {
      // 70 bat 4 des 6 autres : 66,67 %.
      name: "arrondit à l'entier inférieur, pour ne jamais surestimer la position",
      participants: [...five, { score: 65 }, { score: 95 }],
      expected: 66,
    },
    {
      name: "rend 100 au premier sans ex æquo",
      participants: [{ score: 95 }, ...five.slice(1)],
      expected: 100,
    },
    {
      name: "n'existe pas pour un examen ouvert",
      participants: five,
      open: true,
      expected: undefined,
    },
    {
      // 4 étudiants lisibles seulement : sous le seuil.
      name: "écarte les comptes admin et supprimés du groupe de pairs",
      participants: [
        ...five.slice(0, 4),
        { score: 10, role: "admin" },
        { score: 20, deleted: true },
      ],
      expected: null,
    },
    {
      name: "compte les participations soumises à l'expiration du temps",
      participants: [
        ...five.slice(0, 4),
        { score: 60, status: "auto_submitted" },
      ],
      expected: 75,
    },
    {
      name: "ignore une participation encore en cours",
      participants: [...five.slice(0, 4), { score: 60, status: "in_progress" }],
      expected: null,
    },
    {
      name: "écarte un pair au score retenu",
      participants: five,
      withheld: 4,
      expected: null,
    },
    {
      name: "n'existe pas quand le score du participant est retenu",
      participants: [...five, { score: 30 }],
      withheld: 0,
      expected: null,
    },
  ])("$name", async ({ participants, open, withheld, expected }) => {
    const { examId, userIds } = await seedExam(participants, { open })
    if (withheld !== undefined) await withholdScore(examId, userIds[withheld]!)
    asUser(userIds[0])
    expect((await getMyExamPercentiles())[examId]).toBe(expected)
    expect(await getMyExamPercentile(examId)).toBe(expected ?? null)
  })
})

describe("classement d'examen : même population que le percentile", () => {
  const population: Participant[] = [
    { score: 70 },
    { score: 40 },
    { score: 50 },
    { score: 90 },
    { score: 60 },
    { score: 100, role: "admin" },
    { score: 95, deleted: true },
  ]

  it("hors comptes admin et supprimés, le rang recoupe le percentile", async () => {
    const { examId, userIds } = await seedExam(population)
    asUser(userIds[0])
    const percentile = (await getMyExamPercentiles())[examId]

    asUser(createId(), "admin")
    // Population du classement : ce que l'écran range (`populationRanks`).
    const leaderboard = (await getExamLeaderboard(examId)).filter(
      (e) => e.user?.flag === null,
    )

    expect(leaderboard.map((e) => e.score)).toEqual([90, 70, 60, 50, 40])
    const rank = leaderboard.findIndex((e) => e.user?.id === userIds[0])
    const below = leaderboard.length - 1 - rank
    expect(percentile).toBe(
      Math.floor((100 * below) / (leaderboard.length - 1)),
    )
  })

  it("côté admin, garde toutes les participations et identifie admins et supprimés", async () => {
    const { examId, userIds } = await seedExam(population)
    asUser(createId(), "admin")

    const leaderboard = await getExamLeaderboard(examId)

    expect(leaderboard.map((e) => [e.score, e.user?.flag])).toEqual([
      [100, "admin"],
      [95, "deleted"],
      [90, null],
      [70, null],
      [60, null],
      [50, null],
      [40, null],
    ])
    expect(leaderboard[0]?.user?.id).toBe(userIds[5])
  })

  it("départage les ex æquo de façon stable, par participation", async () => {
    const { examId } = await seedExam([
      { score: 60 },
      { score: 60 },
      { score: 60 },
      { score: 60 },
      { score: 60 },
    ])
    await db
      .update(examParticipations)
      .set({ completedAt: new Date(Date.now() - 5 * DAY) })
      .where(eq(examParticipations.examId, examId))
    asUser(createId(), "admin")

    const order = (await getExamLeaderboard(examId)).map(
      (e) => e.participationId,
    )
    expect(order).toEqual([...order].sort())
  })
})
