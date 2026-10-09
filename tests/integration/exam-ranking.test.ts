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
  EXAM_RANKING_LIMIT,
  getExamLeaderboard,
  getExamRanking,
} from "@/features/exams/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"
import { TEST_OBJECTIVE_ID } from "../helpers/objective"
import { seedAccess } from "../helpers/seed-payments"

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
  username?: string | null
  image?: string | null
  /** Décalage de la soumission, en secondes après la première. */
  completedAfter?: number
}

/** Un examen et ses participants ; rend l'id de l'examen et ceux des participants, dans l'ordre. */
const seedExam = async (
  participants: Participant[],
  {
    open = false,
    audienceType = "subscribers",
  }: { open?: boolean; audienceType?: "subscribers" | "restricted" } = {},
) => {
  const now = Date.now()
  const examId = createId()
  const userIds = participants.map(() => createId())

  await db.insert(user).values(
    participants.map((p, i) => ({
      id: userIds[i],
      name: `Nom Complet ${i}`,
      email: `rank-${i}-${examId}@test.invalid`,
      username: p.username === undefined ? `cand_${i}_${examId}` : p.username,
      image: p.image ?? null,
      role: p.role ?? "user",
      deletedAt: p.deleted ? new Date(now - DAY) : null,
    })),
  )
  await db.insert(exams).values({
    id: examId,
    title: "Examen classé",
    startDate: new Date(now - 10 * DAY),
    endDate: open ? new Date(now + DAY) : new Date(now - DAY),
    completionTime: 3600,
    createdBy: userIds[0],
    targetQuestionCount: 10,
    audienceType,
    finalizedAt: new Date(),
  })
  await db.insert(examParticipations).values(
    participants.map((p, i) => ({
      examId,
      userId: userIds[i],
      status: p.status ?? "completed",
      score: p.score,
      startedAt: new Date(now - 5 * DAY),
      completedAt:
        p.status === "in_progress"
          ? null
          : new Date(now - 5 * DAY + 1000 * (1 + (p.completedAfter ?? i))),
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
    title: "Examen encore ouvert",
    startDate: new Date(now - DAY),
    endDate: new Date(now + DAY),
    completionTime: 3600,
    createdBy: userId,
    targetQuestionCount: 10,
    finalizedAt: new Date(),
  })
  await db
    .insert(examQuestions)
    .values({ examId: openExamId, questionId, position: 0 })
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

describe("classement d'examen (lecteur étudiant)", () => {
  it("est refusé sans session", async () => {
    const { examId } = await seedExam([{ score: 50 }])
    vi.mocked(getCurrentSession).mockResolvedValue(null)

    expect(await getExamRanking(examId)).toBeNull()
  })

  it("est refusé à un étudiant qui n'a pas participé", async () => {
    const { examId } = await seedExam([{ score: 50 }])
    const outsider = createId()
    await db.insert(user).values({
      id: outsider,
      name: "Abonné absent",
      email: `outsider-${outsider}@test.invalid`,
    })
    asUser(outsider)

    expect(await getExamRanking(examId)).toBeNull()
  })

  it("est refusé à une participation encore en cours", async () => {
    const { examId, userIds } = await seedExam([
      { score: 50 },
      { score: 0, status: "in_progress" },
    ])
    asUser(userIds[1])

    expect(await getExamRanking(examId)).toBeNull()
  })

  it("est refusé tant que l'examen est ouvert, admin compris", async () => {
    const { examId, userIds } = await seedExam(
      [{ score: 50 }, { score: 40, role: "admin" }],
      { open: true },
    )
    asUser(userIds[0])
    expect(await getExamRanking(examId)).toBeNull()

    asUser(userIds[1], "admin")
    expect(await getExamRanking(examId)).toBeNull()
  })

  it("compte les participations terminées d'étudiants, hors admin, supprimés et en cours", async () => {
    const { examId, userIds } = await seedExam([
      { score: 60 },
      { score: 90, role: "admin" },
      { score: 80, deleted: true },
      { score: 70, status: "auto_submitted" },
      { score: 0, status: "in_progress" },
      { score: 40 },
    ])
    asUser(userIds[0])

    const ranking = await getExamRanking(examId)

    expect(ranking?.total).toBe(3)
    expect(ranking?.rows).toEqual([
      expect.objectContaining({ rank: 1, score: 70, isSelf: false }),
      expect.objectContaining({ rank: 2, score: 60, isSelf: true }),
      expect.objectContaining({ rank: 3, score: 40, isSelf: false }),
    ])
    expect(ranking?.mine).toEqual({ held: false, rank: 2, score: 60 })
  })

  it("donne des rangs distincts aux ex æquo, la première soumission devant, comme le classement admin", async () => {
    const { examId, userIds } = await seedExam([
      { score: 70, completedAfter: 30 },
      { score: 70, completedAfter: 10 },
      { score: 90, completedAfter: 50 },
      { score: 70, completedAfter: 20 },
      { score: 50, role: "admin", completedAfter: 0 },
    ])
    const usernameOf = (i: number) => `cand_${i}_${examId}`

    asUser(userIds[0])
    const ranking = await getExamRanking(examId)
    expect(ranking?.rows.map((r) => [r.rank, r.username])).toEqual([
      [1, usernameOf(2)],
      [2, usernameOf(1)],
      [3, usernameOf(3)],
      [4, usernameOf(0)],
    ])

    asUser(userIds[4], "admin")
    const admin = (await getExamLeaderboard(examId)).filter(
      (e) => e.user?.flag === null,
    )
    expect(admin.map((e) => e.user?.username)).toEqual(
      ranking?.rows.map((r) => r.username),
    )
  })

  it("ne livre des autres que rang, nom d'utilisateur, photo et score ; jamais la photo d'un anonyme", async () => {
    const { examId, userIds } = await seedExam([
      { score: 60 },
      { score: 40, username: null },
      { score: 20 },
    ])
    // Adresse réelle d'un avatar téléversé : elle porte l'id de son
    // propriétaire, accepté pour un candidat qui a un nom d'utilisateur.
    const avatarOf = (id: string) => `https://cdn.test/avatars/${id}/1.webp`
    for (const id of userIds)
      await db
        .update(user)
        .set({ image: avatarOf(id) })
        .where(eq(user.id, id))
    asUser(userIds[0])

    const ranking = await getExamRanking(examId)

    expect(ranking?.rows).toEqual([
      {
        rank: 1,
        username: `cand_0_${examId}`,
        image: avatarOf(userIds[0]),
        score: 60,
        isSelf: true,
      },
      { rank: 2, username: null, image: null, score: 40, isSelf: false },
      {
        rank: 3,
        username: `cand_2_${examId}`,
        image: avatarOf(userIds[2]),
        score: 20,
        isSelf: false,
      },
    ])
    const payload = JSON.stringify(ranking)
    expect(payload).not.toContain("Nom Complet")
    expect(payload).not.toContain("@test.invalid")
    expect(payload).not.toContain(userIds[1])
  })

  it("écarte la participation d'un autre candidat dont le score est retenu", async () => {
    const { examId, userIds } = await seedExam([
      { score: 60 },
      { score: 90 },
      { score: 40 },
    ])
    await withholdScore(examId, userIds[1])
    asUser(userIds[0])

    const ranking = await getExamRanking(examId)

    expect(ranking?.total).toBe(2)
    expect(ranking?.rows.map((r) => r.score)).toEqual([60, 40])
    expect(ranking?.mine).toEqual({ held: false, rank: 1, score: 60 })
  })

  it("rend le classement des autres sans ma ligne quand mon score est retenu", async () => {
    const { examId, userIds } = await seedExam([
      { score: 60 },
      { score: 90 },
      { score: 40 },
    ])
    await withholdScore(examId, userIds[0])
    asUser(userIds[0])

    const ranking = await getExamRanking(examId)

    expect(ranking?.mine).toEqual({
      held: true,
      withheldBy: "Examen encore ouvert",
    })
    expect(ranking?.total).toBe(2)
    expect(ranking?.rows.map((r) => [r.score, r.isSelf])).toEqual([
      [90, false],
      [40, false],
    ])
  })

  it("garde ma ligne au-delà de la limite d'affichage", async () => {
    const n = EXAM_RANKING_LIMIT + 2
    const { examId, userIds } = await seedExam(
      Array.from({ length: n }, (_, i) => ({ score: n - i })),
    )
    asUser(userIds[n - 1])

    const ranking = await getExamRanking(examId)

    expect(ranking?.total).toBe(n)
    expect(ranking?.rows).toHaveLength(EXAM_RANKING_LIMIT + 1)
    expect(ranking?.rows.at(-1)).toEqual(
      expect.objectContaining({ rank: n, isSelf: true }),
    )
    expect(ranking?.mine).toEqual({ held: false, rank: n, score: 1 })
  })

  it("rend le classement à un lecteur dont la copie a été soumise automatiquement", async () => {
    const { examId, userIds } = await seedExam([
      { score: 70 },
      { score: 50, status: "auto_submitted" },
    ])
    asUser(userIds[1])

    const ranking = await getExamRanking(examId)

    expect(ranking?.mine).toEqual({ held: false, rank: 2, score: 50 })
    expect(ranking?.hasOwnCopy).toBe(true)
  })

  it("garde « Voir mes réponses » à un admin qui a passé l'examen, sans le classer", async () => {
    const { examId, userIds } = await seedExam([
      { score: 60 },
      { score: 90, role: "admin" },
    ])
    asUser(userIds[1], "admin")

    const ranking = await getExamRanking(examId)

    expect(ranking?.mine).toBeNull()
    expect(ranking?.hasOwnCopy).toBe(true)
    expect(ranking?.rows.map((r) => r.score)).toEqual([60])
  })

  it("s'ouvre à l'admin sans participation, sans ligne à lui", async () => {
    const { examId } = await seedExam([{ score: 60 }, { score: 40 }])
    const adminId = createId()
    await db.insert(user).values({
      id: adminId,
      name: "Admin",
      email: `admin-${adminId}@test.invalid`,
      role: "admin",
    })
    asUser(adminId, "admin")

    const ranking = await getExamRanking(examId)

    expect(ranking?.mine).toBeNull()
    expect(ranking?.hasOwnCopy).toBe(false)
    expect(ranking?.rows.map((r) => r.score)).toEqual([60, 40])
    expect(ranking?.correctionLocked).toBe(false)
  })

  it("verrouille la correction sans accès Examens actif, sauf sur invitation", async () => {
    const { examId, userIds } = await seedExam([{ score: 60 }, { score: 40 }])
    asUser(userIds[0])
    expect((await getExamRanking(examId))?.correctionLocked).toBe(true)

    await seedAccess(userIds[0], "exam", new Date(Date.now() + 10 * DAY))
    expect((await getExamRanking(examId))?.correctionLocked).toBe(false)

    const invited = await seedExam([{ score: 60 }], {
      audienceType: "restricted",
    })
    asUser(invited.userIds[0])
    expect((await getExamRanking(invited.examId))?.correctionLocked).toBe(false)
  })

  it("rend l'en-tête de l'examen", async () => {
    const { examId, userIds } = await seedExam([{ score: 60 }])
    const questionId = createId()
    await db.insert(questions).values({
      id: questionId,
      question: "Q de l'examen",
      correctAnswer: "A",
      options: ["A", "B"],
      objectiveId: TEST_OBJECTIVE_ID,
      domain: "Cardiologie",
    })
    await db.insert(examQuestions).values({ examId, questionId, position: 0 })
    asUser(userIds[0])

    const ranking = await getExamRanking(examId)

    expect(ranking?.exam).toEqual({
      id: examId,
      title: "Examen classé",
      endDate: expect.any(Number),
      questionCount: 1,
    })
  })
})
