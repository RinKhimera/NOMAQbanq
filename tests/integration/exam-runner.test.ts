/**
 * Tests d'intégration : startExam pré-création + saveExamAnswer + saveExamFlag
 * + finalizeExam + pauseExam/resumeExam.
 */
import { and, eq } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { examAnswers, examParticipations, questions, user } from "@/db/schema"
import {
  finalizeExam,
  pauseExam,
  resumeExam,
  saveExamAnswer,
  saveExamFlag,
  startExam,
} from "@/features/exams/actions"
import { getExamSession } from "@/features/exams/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"
import { TEST_OBJECTIVE_ID } from "../helpers/objective"
import { seedExam } from "../helpers/seed-exam"
import { seedAccess } from "../helpers/seed-payments"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const DAY = 24 * 60 * 60 * 1000
const ADMIN_ID = createId()
const STUDENT_ID = createId()
const qIds = Array.from({ length: 4 }, () => createId())

const asStudent = () =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue({ user: { id: STUDENT_ID, role: "user" } } as never)

const NOT_IN_PROGRESS = {
  success: false,
  error: "Cette participation n'est plus active.",
  code: "NOT_IN_PROGRESS",
}

/** Examen ouvert sur les 4 questions, dans l'ordre de `qIds`. */
const openExam = (opts: { enablePause?: boolean } = {}) => {
  const now = Date.now()
  return seedExam({
    createdBy: ADMIN_ID,
    title: "ER Exam",
    startDate: now - 3600_000,
    endDate: now + 3600_000,
    questionIds: qIds,
    enablePause: opts.enablePause ?? false,
    pauseDurationMinutes: opts.enablePause ? 15 : undefined,
  })
}

/** Examen ouvert sur lequel l'étudiant a démarré sa participation. */
const startedExam = async (opts: { enablePause?: boolean } = {}) => {
  const examId = await openExam(opts)
  asStudent()
  const s = await startExam({ examId })
  if (!s.success) throw new Error(s.error)
  return examId
}

const participationOf = async (examId: string) => {
  const [p] = await db
    .select({ id: examParticipations.id, score: examParticipations.score })
    .from(examParticipations)
    .where(
      and(
        eq(examParticipations.examId, examId),
        eq(examParticipations.userId, STUDENT_ID),
      ),
    )
  return p
}

const answerRow = async (examId: string, questionId: string) => {
  const [row] = await db
    .select({
      selectedAnswer: examAnswers.selectedAnswer,
      isCorrect: examAnswers.isCorrect,
      isFlagged: examAnswers.isFlagged,
    })
    .from(examAnswers)
    .innerJoin(
      examParticipations,
      eq(examParticipations.id, examAnswers.participationId),
    )
    .where(
      and(
        eq(examParticipations.examId, examId),
        eq(examAnswers.questionId, questionId),
      ),
    )
  return row
}

beforeAll(async () => {
  await db.insert(user).values([
    { id: ADMIN_ID, name: "ER admin", email: "er-adm@test.invalid" },
    { id: STUDENT_ID, name: "ER student", email: "er-stu@test.invalid" },
  ])
  await seedAccess(STUDENT_ID, "exam", new Date(Date.now() + 10 * DAY))
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `ER Q${i} ?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectiveId: TEST_OBJECTIVE_ID,
      domain: "ER",
    })),
  )
})

describe("startExam pré-création", () => {
  it("crée une ligne examAnswers (selectedAnswer null) par question", async () => {
    const examId = await openExam()
    asStudent()
    const res = await startExam({ examId })
    expect(res.success).toBe(true)

    const p = await participationOf(examId)
    const rows = await db
      .select()
      .from(examAnswers)
      .where(eq(examAnswers.participationId, p.id))
    expect(rows.map((r) => r.questionId).sort()).toEqual([...qIds].sort())
    expect(rows.every((r) => r.selectedAnswer === null)).toBe(true)
    expect(rows.every((r) => r.isCorrect === null)).toBe(true)
  })
})

describe("saveExamAnswer", () => {
  it("met à jour la ligne et ne renvoie JAMAIS isCorrect", async () => {
    const examId = await startedExam()
    const res = await saveExamAnswer({
      examId,
      questionId: qIds[0],
      selectedAnswer: "A",
    })
    expect(res).toEqual({ success: true, serverNow: expect.any(Number) })

    // isCorrect est calculé côté serveur, en base seulement.
    expect(await answerRow(examId, qIds[0])).toMatchObject({
      selectedAnswer: "A",
      isCorrect: true,
    })
  })

  it("saveExamAnswer sur question hors examen → échec", async () => {
    const examId = await startedExam()
    const res = await saveExamAnswer({
      examId,
      questionId: createId(),
      selectedAnswer: "A",
    })
    expect(res).toEqual({
      success: false,
      error: "Cette question ne fait pas partie de l'examen.",
    })
  })
})

describe("saveExamFlag", () => {
  it("marque et démarque une question", async () => {
    const examId = await startedExam()

    const r1 = await saveExamFlag({
      examId,
      questionId: qIds[1],
      isFlagged: true,
    })
    expect(r1.success).toBe(true)
    expect((await answerRow(examId, qIds[1]))?.isFlagged).toBe(true)

    const r2 = await saveExamFlag({
      examId,
      questionId: qIds[1],
      isFlagged: false,
    })
    expect(r2.success).toBe(true)
    expect((await answerRow(examId, qIds[1]))?.isFlagged).toBe(false)
  })
})

describe("finalizeExam", () => {
  it("calcule le score depuis les lignes en base", async () => {
    const examId = await startedExam()
    await saveExamAnswer({ examId, questionId: qIds[0], selectedAnswer: "A" })
    await saveExamAnswer({ examId, questionId: qIds[2], selectedAnswer: "B" })

    const res = await finalizeExam({ examId })
    // Le décompte des justes ne repart pas vers le navigateur : lu en base.
    expect(res).toEqual({ success: true })
    // 1 juste, 1 fausse, 2 sans réponse : 1/4.
    expect((await participationOf(examId))?.score).toBe(25)
  })

  it("finalizeExam refuse une 2e soumission", async () => {
    const examId = await startedExam()
    expect(await finalizeExam({ examId })).toEqual({ success: true })

    expect(await finalizeExam({ examId })).toEqual(NOT_IN_PROGRESS)
  })
})

describe("pauseExam / resumeExam", () => {
  it("une seule pause autorisée ; resume cumule la durée", async () => {
    const examId = await openExam({ enablePause: true })
    asStudent()
    expect(await getExamSession(examId)).toBeNull()
    await startExam({ examId })
    expect(await getExamSession(examId)).toMatchObject({
      participationId: (await participationOf(examId))?.id,
      status: "in_progress",
      isPaused: false,
      pauseStartedAt: null,
    })

    const r1 = await pauseExam({ examId })
    expect(r1.success).toBe(true)
    expect(await getExamSession(examId)).toMatchObject({
      isPaused: true,
      pauseStartedAt: r1.pauseStartedAt,
    })

    expect(await pauseExam({ examId })).toEqual({
      success: false,
      error: "Vous êtes déjà en pause.",
    })

    const r3 = await resumeExam({ examId })
    expect(r3.success).toBe(true)
    expect(r3.totalPauseDurationMs).toBeGreaterThanOrEqual(0)
    expect(await getExamSession(examId)).toMatchObject({
      isPaused: false,
      totalPauseDurationMs: r3.totalPauseDurationMs,
    })

    const r4 = await pauseExam({ examId })
    expect(r4.success).toBe(false)
  })

  it("saveExamAnswer refuse pendant la pause", async () => {
    const examId = await startedExam({ enablePause: true })
    await pauseExam({ examId })

    const res = await saveExamAnswer({
      examId,
      questionId: qIds[0],
      selectedAnswer: "A",
    })
    expect(res.success).toBe(false)
    expect(res.error).toContain("pause")
  })

  it("saveExamAnswer accepte de nouveau après la reprise", async () => {
    const examId = await startedExam({ enablePause: true })
    await pauseExam({ examId })
    await resumeExam({ examId })

    const res = await saveExamAnswer({
      examId,
      questionId: qIds[0],
      selectedAnswer: "A",
    })
    expect(res.success).toBe(true)
  })
})

describe("saveExamAnswer — budget-temps + anti-race", () => {
  // completionTime = 4 questions × 83 s = 332 s ; budget dépassé au-delà de
  // 332 s + GRACE_MS (10 s, `lib/attempt-clock`).
  const makeStartedExam = async (backdateMs: number): Promise<string> => {
    const examId = await startedExam()
    await db
      .update(examParticipations)
      .set({ startedAt: new Date(Date.now() - backdateMs) })
      .where(
        and(
          eq(examParticipations.examId, examId),
          eq(examParticipations.userId, STUDENT_ID),
        ),
      )
    return examId
  }

  it("refuse une réponse au-delà du budget-temps (TIME_UP) et ne la persiste pas", async () => {
    const eId = await makeStartedExam(400_000)
    const res = await saveExamAnswer({
      examId: eId,
      questionId: qIds[0],
      selectedAnswer: "A",
    })
    expect(res).toEqual({
      success: false,
      error: "Temps écoulé.",
      code: "TIME_UP",
    })
    expect((await answerRow(eId, qIds[0]))?.selectedAnswer).toBeNull()
  })

  it("réponse hors-temps refusée puis finalize isAutoSubmit tardif → score ne l'inclut pas", async () => {
    const eId = await makeStartedExam(400_000)
    const save = await saveExamAnswer({
      examId: eId,
      questionId: qIds[0],
      selectedAnswer: "A", // bonne réponse (correctAnswer = "A")
    })
    expect(save.success).toBe(false) // TIME_UP

    const fin = await finalizeExam({ examId: eId, isAutoSubmit: true })
    expect(fin).toEqual({ success: true })
    expect((await participationOf(eId))?.score).toBe(0)
  })

  it("race déterministe : finalize PUIS save → save refusé (session plus active)", async () => {
    const eId = await makeStartedExam(1_000) // dans les temps
    const fin = await finalizeExam({ examId: eId, isAutoSubmit: false })
    expect(fin.success).toBe(true)

    const save = await saveExamAnswer({
      examId: eId,
      questionId: qIds[0],
      selectedAnswer: "A",
    })
    expect(save).toEqual(NOT_IN_PROGRESS)
  })
})
