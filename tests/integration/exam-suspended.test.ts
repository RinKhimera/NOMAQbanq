import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
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
  liftExamSuspension,
  removeExamQuestions,
  saveExam,
  saveExamAnswer,
  startExam,
  suspendExam,
} from "@/features/exams/actions"
import {
  getExamWithQuestions,
  getExamsWithParticipation,
  getParticipantExamResults,
} from "@/features/exams/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"
import { TEST_OBJECTIVE_ID } from "../helpers/objective"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const DAY = 24 * 60 * 60 * 1000

const ADMIN_ID = createId()
// Membres de l'audience restreinte : la sélection vaut accès, sans abonnement.
const NEWCOMER_ID = createId()
const RUNNER_ID = createId()
const qIds = [createId(), createId()]

const asUser = (id: string, role: "user" | "admin" = "user") =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue({ user: { id, role } } as never)

/** Examen restreint aux deux membres, ouvert tant qu'on ne le suspend pas. */
const seedExam = async ({
  closed = false,
  finalized = true,
}: { closed?: boolean; finalized?: boolean } = {}) => {
  const now = Date.now()
  const examId = createId()
  await db.insert(exams).values({
    id: examId,
    title: "Suspendu",
    startDate: new Date(now - 10 * DAY),
    endDate: closed ? new Date(now - DAY) : new Date(now + DAY),
    completionTime: 3600,
    audienceType: "restricted",
    createdBy: ADMIN_ID,
    targetQuestionCount: 10,
    finalizedAt: finalized ? new Date() : null,
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

const suspend = (examId: string) =>
  db.update(exams).set({ isActive: false }).where(eq(exams.id, examId))

const isActiveOf = async (examId: string) =>
  (
    await db
      .select({ isActive: exams.isActive })
      .from(exams)
      .where(eq(exams.id, examId))
  )[0]?.isActive

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: ADMIN_ID,
      name: "Sus admin",
      email: "sus-adm@test.invalid",
    },
    {
      id: NEWCOMER_ID,
      name: "Sus nouveau",
      email: "sus-new@test.invalid",
    },
    {
      id: RUNNER_ID,
      name: "Sus en cours",
      email: "sus-run@test.invalid",
    },
  ])
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `Q suspendu ${i}`,
      correctAnswer: "A",
      options: ["A", "B"],
      objectiveId: TEST_OBJECTIVE_ID,
      domain: "Cardiologie",
    })),
  )
})

describe("suspendre un examen", () => {
  it("suspend puis lève la suspension d'un examen ouvert", async () => {
    const examId = await seedExam()
    asUser(ADMIN_ID, "admin")

    expect(await suspendExam({ examId })).toEqual({ success: true })
    expect(await isActiveOf(examId)).toBe(false)
    expect(await liftExamSuspension({ examId })).toEqual({ success: true })
    expect(await isActiveOf(examId)).toBe(true)
  })

  it("refuse un examen clos ou en préparation, sans rien écrire", async () => {
    asUser(ADMIN_ID, "admin")
    for (const examId of [
      await seedExam({ closed: true }),
      await seedExam({ finalized: false }),
    ]) {
      expect(await suspendExam({ examId })).toEqual({
        success: false,
        error:
          "Seul un examen finalisé et ouvert (à venir ou en cours) peut être suspendu, ou voir sa suspension levée.",
      })
      expect(await isActiveOf(examId)).toBe(true)
    }
  })

  it("ne lève pas la suspension d'un examen clos depuis", async () => {
    const examId = await seedExam({ closed: true })
    await suspend(examId)
    asUser(ADMIN_ID, "admin")

    expect((await liftExamSuspension({ examId })).success).toBe(false)
    expect(await isActiveOf(examId)).toBe(false)
  })

  it("est réservé aux admins", async () => {
    const examId = await seedExam()
    asUser(NEWCOMER_ID)

    await expect(suspendExam({ examId })).rejects.toThrow()
    expect(await isActiveOf(examId)).toBe(true)
  })
})

describe("retour en préparation", () => {
  it("changer le jeu d'un examen suspendu lève la suspension, au compositeur comme au formulaire", async () => {
    asUser(ADMIN_ID, "admin")
    const composed = await seedExam()
    await suspend(composed)
    expect(
      (await removeExamQuestions({ examId: composed, questionIds: [qIds[0]!] }))
        .success,
    ).toBe(true)
    expect(await isActiveOf(composed)).toBe(true)

    const saved = await seedExam()
    await suspend(saved)
    const res = await saveExam({
      id: saved,
      title: "Suspendu",
      targetQuestionCount: 10,
      startDate: null,
      endDate: null,
      questionIds: [qIds[1]!],
      enablePause: false,
      audienceType: "restricted",
      audienceUserIds: [NEWCOMER_ID, RUNNER_ID],
      isHidden: false,
    })
    expect(res).toMatchObject({ success: true, finalized: false })
    expect(await isActiveOf(saved)).toBe(true)
  })
})

describe("examen suspendu", () => {
  it("startExam refuse une nouvelle participation, avec son propre message", async () => {
    const examId = await seedExam()
    await suspend(examId)
    asUser(NEWCOMER_ID)

    const res = await startExam({ examId })

    expect(res).toEqual({
      success: false,
      error: "Cet examen est suspendu : il ne peut pas être commencé.",
    })
    const rows = await db
      .select({ id: examParticipations.id })
      .from(examParticipations)
      .where(eq(examParticipations.examId, examId))
    expect(rows).toHaveLength(0)
  })

  it("startExam refuse aussi un admin", async () => {
    const examId = await seedExam()
    await suspend(examId)
    asUser(ADMIN_ID, "admin")

    expect(await startExam({ examId })).toEqual({
      success: false,
      error: "Cet examen est suspendu : il ne peut pas être commencé.",
    })
  })

  it("reste visible de qui le voyait : liste et lecture, suspension comprise", async () => {
    const examId = await seedExam()
    await suspend(examId)

    for (const viewer of [
      () => asUser(NEWCOMER_ID),
      () => asUser(ADMIN_ID, "admin"),
    ]) {
      viewer()
      const listed = (await getExamsWithParticipation()).find(
        (e) => e.id === examId,
      )
      expect(listed?.isActive).toBe(false)
      expect(await getExamWithQuestions(examId)).not.toBeNull()
    }
  })

  it("ne coupe pas une participation en cours : reprise, réponse et soumission", async () => {
    const examId = await seedExam()
    asUser(RUNNER_ID)
    const started = await startExam({ examId })
    expect(started.success).toBe(true)
    await suspend(examId)

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
    await suspend(examId)
    asUser(RUNNER_ID)

    expect(await getExamWithQuestions(examId)).not.toBeNull()
    const results = await getParticipantExamResults(examId, RUNNER_ID)
    expect(results && "participant" in results).toBe(true)
  })
})
