import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examAudience,
  examParticipations,
  examQuestions,
  exams,
  questions,
  user,
} from "@/db/schema"
import {
  finalizeExam,
  saveExamAnswer,
  startExam,
} from "@/features/exams/actions"
import {
  getExamLeaderboard,
  getExamWithQuestions,
  getExamsWithParticipation,
  getParticipantExamResults,
} from "@/features/exams/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const DAY = 24 * 60 * 60 * 1000
const suffix = createId().slice(0, 8)

const ADMIN_ID = createId()
// Membres de l'audience restreinte : la sélection vaut accès, sans abonnement.
const NEWCOMER_ID = createId()
const RUNNER_ID = createId()
const qIds = [createId(), createId()]

const createdExams: string[] = []

const asUser = (id: string, role: "user" | "admin" = "user") =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue({ user: { id, role } } as never)

/** Examen restreint aux deux membres, actif tant qu'on ne le désactive pas. */
const seedExam = async ({ closed = false }: { closed?: boolean } = {}) => {
  const now = Date.now()
  const examId = createId()
  createdExams.push(examId)
  await db.insert(exams).values({
    id: examId,
    title: `Désactivé ${suffix}`,
    startDate: new Date(now - 10 * DAY),
    endDate: closed ? new Date(now - DAY) : new Date(now + DAY),
    completionTime: 3600,
    audienceType: "restricted",
    createdBy: ADMIN_ID,
  })
  await db
    .insert(examQuestions)
    .values(
      qIds.map((questionId, position) => ({ examId, questionId, position })),
    )
  await db.insert(examAudience).values([
    { examId, userId: NEWCOMER_ID },
    { examId, userId: RUNNER_ID },
  ])
  return examId
}

const deactivate = (examId: string) =>
  db.update(exams).set({ isActive: false }).where(eq(exams.id, examId))

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: ADMIN_ID,
      name: "Dés admin",
      email: `des-adm-${suffix}@test.invalid`,
    },
    {
      id: NEWCOMER_ID,
      name: "Dés nouveau",
      email: `des-new-${suffix}@test.invalid`,
    },
    {
      id: RUNNER_ID,
      name: "Dés en cours",
      email: `des-run-${suffix}@test.invalid`,
    },
  ])
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `Q désactivé ${i} ${suffix}`,
      correctAnswer: "A",
      options: ["A", "B"],
      objectifCmc: "Objectif",
      domain: "Cardiologie",
    })),
  )
})

afterAll(async () => {
  await db.delete(exams).where(inArray(exams.id, createdExams))
  await db.delete(questions).where(inArray(questions.id, qIds))
  await db
    .delete(user)
    .where(inArray(user.id, [ADMIN_ID, NEWCOMER_ID, RUNNER_ID]))
})

describe("examen désactivé", () => {
  it("startExam refuse une nouvelle participation, avec son propre message", async () => {
    const examId = await seedExam()
    await deactivate(examId)
    asUser(NEWCOMER_ID)

    const res = await startExam({ examId })

    expect(res).toEqual({
      success: false,
      error: "Cet examen n'est plus disponible.",
    })
    const rows = await db
      .select({ id: examParticipations.id })
      .from(examParticipations)
      .where(eq(examParticipations.examId, examId))
    expect(rows).toHaveLength(0)
  })

  it("startExam laisse un admin démarrer", async () => {
    const examId = await seedExam()
    await deactivate(examId)
    asUser(ADMIN_ID, "admin")

    expect((await startExam({ examId })).success).toBe(true)
  })

  it("se lit comme introuvable pour un non-admin sans participation", async () => {
    const examId = await seedExam()
    await deactivate(examId)

    asUser(NEWCOMER_ID)
    expect(await getExamWithQuestions(examId)).toBeNull()
    asUser(ADMIN_ID, "admin")
    expect(await getExamWithQuestions(examId)).not.toBeNull()
  })

  it("ne coupe pas une participation en cours : reprise, réponse et soumission", async () => {
    const examId = await seedExam()
    asUser(RUNNER_ID)
    const started = await startExam({ examId })
    expect(started.success).toBe(true)
    await deactivate(examId)

    const resumed = await startExam({ examId })
    expect(resumed.success && resumed.participationId).toBe(
      started.success && started.participationId,
    )
    expect((await getExamWithQuestions(examId))?.questions).toHaveLength(2)
    expect(
      (
        await saveExamAnswer({
          examId,
          questionId: qIds[0]!,
          selectedAnswer: "A",
        })
      ).success,
    ).toBe(true)
    expect(await finalizeExam({ examId })).toEqual({ success: true })
  })

  it("laisse lisibles, après la clôture, la page et les résultats d'un participant", async () => {
    const examId = await seedExam({ closed: true })
    await db.insert(examParticipations).values({
      examId,
      userId: RUNNER_ID,
      status: "completed",
      score: 50,
      startedAt: new Date(Date.now() - 5 * DAY),
      completedAt: new Date(Date.now() - 5 * DAY + 1000),
    })
    await deactivate(examId)
    asUser(RUNNER_ID)

    expect(await getExamWithQuestions(examId)).not.toBeNull()
    const results = await getParticipantExamResults(examId, RUNNER_ID)
    expect(results && "participant" in results).toBe(true)
  })

  it("la liste ne livre un examen désactivé qu'à qui y a participé", async () => {
    const examId = await seedExam()
    asUser(RUNNER_ID)
    expect((await startExam({ examId })).success).toBe(true)
    await deactivate(examId)

    const ids = async () => (await getExamsWithParticipation()).map((e) => e.id)
    expect(await ids()).toContain(examId)
    asUser(NEWCOMER_ID)
    expect(await ids()).not.toContain(examId)
    asUser(ADMIN_ID, "admin")
    expect(await ids()).toContain(examId)
  })

  it("le classement d'un examen désactivé est vide pour un non-participant", async () => {
    const examId = await seedExam({ closed: true })
    await db.insert(examParticipations).values({
      examId,
      userId: RUNNER_ID,
      status: "completed",
      score: 50,
      startedAt: new Date(Date.now() - 5 * DAY),
      completedAt: new Date(Date.now() - 5 * DAY + 1000),
    })
    await deactivate(examId)

    asUser(NEWCOMER_ID)
    expect(await getExamLeaderboard(examId)).toEqual([])
    asUser(RUNNER_ID)
    expect(await getExamLeaderboard(examId)).toHaveLength(1)
  })
})
