import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  exams,
  products,
  questionExplanations,
  questionImages,
  questions,
  trainingSessionItems,
  trainingSessions,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import {
  createExam,
  deactivateExam,
  deleteParticipation,
  reactivateExam,
  resumeFromPause,
  startExam,
  startPause,
  submitExamAnswers,
  updateExam,
} from "@/features/exams/actions"
import {
  getActiveExamAccessCount,
  getAllExamsAdmin,
  getExamLeaderboard,
  getExamQuestionExplanations,
  getExamSession,
  getExamWithQuestions,
  getExamsStats,
  getParticipantExamResults,
  getPauseStatus,
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
const STUDENT_ID = createId()
const INTRUDER_ID = createId()
const NOACCESS_ID = createId()
const PID = createId()
// 8 questions : q0..q5 examens, q6 = témoin non autorisé, q7 = training seul.
const qIds = Array.from({ length: 8 }, () => createId())
const examQIds = qIds.slice(0, 6)

const setSession = (id: string, role: "user" | "admin") =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue({ user: { id, role } } as never)
const asAdmin = () => setSession(ADMIN_ID, "admin")
const asStudent = () => setSession(STUDENT_ID, "user")
const asIntruder = () => setSession(INTRUDER_ID, "user")
const asNoAccess = () => setSession(NOACCESS_ID, "user")

const grantExamAccess = async (userId: string) => {
  const txId = createId()
  await db.insert(transactions).values({
    id: txId,
    userId,
    productId: PID,
    type: "manual",
    status: "completed",
    amountPaid: 5000,
    currency: "CAD",
    accessType: "exam",
    durationDays: 90,
    accessExpiresAt: new Date(Date.now() + 90 * DAY),
  })
  await db.insert(userAccess).values({
    userId,
    accessType: "exam",
    expiresAt: new Date(Date.now() + 10 * DAY),
    lastTransactionId: txId,
  })
}

const makeExam = async (opts: {
  questionIds: string[]
  enablePause?: boolean
  startDate?: number
  endDate?: number
  pauseDurationMinutes?: number
}): Promise<string> => {
  asAdmin()
  const now = Date.now()
  const res = await createExam({
    title: `Exam ${suffix} ${createId().slice(0, 4)}`,
    startDate: opts.startDate ?? now - 3600_000,
    endDate: opts.endDate ?? now + 3600_000,
    questionIds: opts.questionIds,
    enablePause: opts.enablePause ?? false,
    pauseDurationMinutes: opts.pauseDurationMinutes,
  })
  if (!res.success) throw new Error(res.error)
  return res.examId
}

let noPauseId: string
let pauseId: string
let pauseOrderedIds: string[] = []

beforeAll(async () => {
  await db.insert(user).values([
    { id: ADMIN_ID, name: "IT admin", email: `adm-${suffix}@test.invalid` },
    { id: STUDENT_ID, name: "IT student", email: `stu-${suffix}@test.invalid` },
    { id: INTRUDER_ID, name: "IT intru", email: `int-${suffix}@test.invalid` },
    { id: NOACCESS_ID, name: "IT noacc", email: `noa-${suffix}@test.invalid` },
  ])
  await db.insert(products).values({
    id: PID,
    code: "exam_access",
    name: "Exam",
    description: "desc",
    priceCad: 5000,
    durationDays: 90,
    accessType: "exam",
    stripeProductId: `prod_${suffix}`,
    stripePriceId: `price_${suffix}`,
  })
  await grantExamAccess(STUDENT_ID)
  await grantExamAccess(INTRUDER_ID)

  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `Q ${i} ${suffix} ?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: `Obj ${suffix}`,
      domain: `EXAM-${suffix}`,
    })),
  )
  await db.insert(questionExplanations).values(
    qIds.map((id, i) => ({
      questionId: id,
      explanation: `Explication ${i} ${suffix}`,
      references: i === 0 ? ["Ref 1"] : null,
    })),
  )
  await db
    .insert(questionImages)
    .values([
      { questionId: qIds[0], storagePath: `t/${suffix}/0.jpg`, position: 0 },
    ])

  noPauseId = await makeExam({ questionIds: examQIds })
  pauseId = await makeExam({ questionIds: examQIds, enablePause: true })
})

afterAll(async () => {
  // Supprimer les examens cascade participations/réponses/jonctions.
  await db.delete(exams).where(eq(exams.createdBy, ADMIN_ID))
  // Sessions training (cascade items) avant les questions (FK restrict sur items).
  await db
    .delete(trainingSessions)
    .where(eq(trainingSessions.userId, STUDENT_ID))
  const uids = [ADMIN_ID, STUDENT_ID, INTRUDER_ID, NOACCESS_ID]
  await db.delete(userAccess).where(inArray(userAccess.userId, uids))
  await db.delete(transactions).where(inArray(transactions.userId, uids))
  await db
    .delete(questionImages)
    .where(inArray(questionImages.questionId, qIds))
  await db
    .delete(questionExplanations)
    .where(inArray(questionExplanations.questionId, qIds))
  await db.delete(questions).where(inArray(questions.id, qIds))
  await db.delete(products).where(eq(products.id, PID))
  await db.delete(user).where(inArray(user.id, uids))
})

describe("Admin CRUD", () => {
  it("createExam refuse une question inexistante", async () => {
    asAdmin()
    const now = Date.now()
    const res = await createExam({
      title: `Bad ${suffix}`,
      startDate: now,
      endDate: now + DAY,
      questionIds: [...examQIds.slice(0, 2), createId()],
      enablePause: false,
    })
    expect(res.success).toBe(false)
  })

  it("updateExam sur un examen sans participation change le titre + questions", async () => {
    const id = await makeExam({ questionIds: examQIds.slice(0, 4) })
    asAdmin()
    const now = Date.now()
    const res = await updateExam({
      id,
      title: `Updated ${suffix}`,
      startDate: now - 1000,
      endDate: now + DAY,
      questionIds: examQIds, // passe de 4 à 6 questions
      enablePause: false,
    })
    expect(res.success).toBe(true)

    const view = await getExamWithQuestions(id)
    expect(view?.exam.title).toBe(`Updated ${suffix}`)
    expect(view?.questions).toHaveLength(6)
    expect(view?.exam.completionTime).toBe(6 * 83)
  })

  it("deactivate puis reactivate bascule isActive", async () => {
    const id = await makeExam({ questionIds: examQIds.slice(0, 3) })
    asAdmin()
    await deactivateExam({ examId: id })
    let all = await getAllExamsAdmin()
    expect(all.find((e) => e.id === id)?.isActive).toBe(false)

    await reactivateExam({ examId: id })
    all = await getAllExamsAdmin()
    expect(all.find((e) => e.id === id)?.isActive).toBe(true)
  })

  it("getExamsStats + getActiveExamAccessCount reflètent l'état", async () => {
    asAdmin()
    const stats = await getExamsStats()
    expect(stats.total).toBeGreaterThanOrEqual(2)
    expect(stats.active).toBeGreaterThanOrEqual(2)
    expect(stats.eligibleCandidates).toBeGreaterThanOrEqual(1)

    expect(await getActiveExamAccessCount()).toBeGreaterThanOrEqual(1)
  })
})

describe("Passation sans pause (scoring serveur)", () => {
  it("startExam crée la participation (pausePhase null)", async () => {
    asStudent()
    const res = await startExam({ examId: noPauseId })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.pausePhase).toBeNull()

    // Idempotent : 2e appel → même participation.
    const again = await startExam({ examId: noPauseId })
    expect(again.success && again.participationId).toBe(res.participationId)
  })

  it("getExamWithQuestions masque correctAnswer pour l'étudiant", async () => {
    asStudent()
    const view = await getExamWithQuestions(noPauseId)
    expect(view?.questions).toHaveLength(6)
    expect(view?.questions[0]).not.toHaveProperty("correctAnswer")
    expect(view?.questions[0].images).toHaveLength(1)
  })

  it("getExamSession renvoie in_progress", async () => {
    asStudent()
    const s = await getExamSession(noPauseId)
    expect(s?.status).toBe("in_progress")
  })

  it("submitExamAnswers calcule le score (3/6 = 50)", async () => {
    asStudent()
    const view = await getExamWithQuestions(noPauseId)
    const ids = view!.questions.map((q) => q._id)
    const res = await submitExamAnswers({
      examId: noPauseId,
      answers: [
        { questionId: ids[0], selectedAnswer: "A" },
        { questionId: ids[1], selectedAnswer: "A" },
        { questionId: ids[2], selectedAnswer: "A" },
        { questionId: ids[3], selectedAnswer: "B" },
      ],
    })
    expect(res).toMatchObject({
      success: true,
      score: 50,
      correctAnswers: 3,
      totalQuestions: 6,
    })
  })

  it("startExam refuse une 2e passation (déjà passé)", async () => {
    asStudent()
    const res = await startExam({ examId: noPauseId })
    expect(res.success).toBe(false)
  })

  it("getParticipantExamResults (admin) révèle correctAnswer + réponses", async () => {
    asAdmin()
    const r = await getParticipantExamResults(noPauseId, STUDENT_ID)
    expect(r && "participant" in r).toBe(true)
    if (!r || "error" in r) return
    expect(r.participant.score).toBe(50)
    expect(r.participant.answers).toHaveLength(4)
    expect(r.questions[0].correctAnswer).toBe("A")
  })

  it("getParticipantExamResults (étudiant, examen actif) → null avant endDate", async () => {
    asStudent()
    expect(await getParticipantExamResults(noPauseId, STUDENT_ID)).toBeNull()
  })
})

describe("Machine de pause", () => {
  it("startExam → before_pause", async () => {
    asStudent()
    const res = await startExam({ examId: pauseId })
    expect(res.success && res.pausePhase).toBe("before_pause")
    const view = await getExamWithQuestions(pauseId)
    pauseOrderedIds = view!.questions.map((q) => q._id)
  })

  it("auto-pause refusée hors mi-parcours (TOO_EARLY)", async () => {
    asStudent()
    const res = await startPause({ examId: pauseId, manualTrigger: false })
    expect(res.success).toBe(false)
  })

  it("submit d'une question verrouillée (≥ midpoint) en before_pause → refus", async () => {
    asStudent()
    const res = await submitExamAnswers({
      examId: pauseId,
      answers: [{ questionId: pauseOrderedIds[3], selectedAnswer: "A" }],
    })
    expect(res.success).toBe(false)
  })

  it("startPause manuel → during_pause", async () => {
    asStudent()
    const res = await startPause({ examId: pauseId, manualTrigger: true })
    expect(res.success).toBe(true)
    const status = await getPauseStatus(pauseId)
    expect(status?.pausePhase).toBe("during_pause")
    expect(status?.midpoint).toBe(3)
  })

  it("submit pendant la pause → refus", async () => {
    asStudent()
    const res = await submitExamAnswers({
      examId: pauseId,
      answers: [{ questionId: pauseOrderedIds[0], selectedAnswer: "A" }],
    })
    expect(res.success).toBe(false)
  })

  it("resumeFromPause → after_pause (cut short, durée enregistrée)", async () => {
    asStudent()
    const res = await resumeFromPause({ examId: pauseId })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.isPauseCutShort).toBe(true)
    expect(res.totalPauseDurationMs).toBeGreaterThanOrEqual(0)
    const s = await getExamSession(pauseId)
    expect(s?.pausePhase).toBe("after_pause")
  })

  it("submit complet après reprise → 100", async () => {
    asStudent()
    const res = await submitExamAnswers({
      examId: pauseId,
      answers: pauseOrderedIds.map((questionId) => ({
        questionId,
        selectedAnswer: "A",
      })),
    })
    expect(res).toMatchObject({ success: true, score: 100, totalQuestions: 6 })
  })
})

describe("Leaderboard", () => {
  it("admin voit le classement trié par score", async () => {
    asAdmin()
    const lb = await getExamLeaderboard(pauseId)
    expect(lb.length).toBeGreaterThanOrEqual(1)
    expect(lb[0].user?.id).toBe(STUDENT_ID)
    expect(lb[0].score).toBe(100)
  })

  it("non-admin ne voit pas le classement pendant l'examen actif", async () => {
    asIntruder()
    expect(await getExamLeaderboard(pauseId)).toEqual([])
  })
})

describe("Explications lazy (autorisation)", () => {
  it("étudiant autorisé sur une question d'examen complété", async () => {
    asStudent()
    const r = await getExamQuestionExplanations([qIds[0]])
    expect(r).toHaveLength(1)
    expect(r[0].explanation).toContain("Explication")
  })

  it("étudiant non autorisé sur une question témoin (q6)", async () => {
    asStudent()
    expect(await getExamQuestionExplanations([qIds[6]])).toEqual([])
  })

  it("intrus non autorisé (aucun examen complété)", async () => {
    asIntruder()
    expect(await getExamQuestionExplanations([qIds[0]])).toEqual([])
  })
})

describe("IDOR / accès", () => {
  it("startExam refusé sans accès payant (non-admin)", async () => {
    asNoAccess()
    const res = await startExam({ examId: noPauseId })
    expect(res.success).toBe(false)
  })

  it("un intrus ne peut pas lire les résultats d'autrui", async () => {
    asIntruder()
    expect(await getParticipantExamResults(noPauseId, STUDENT_ID)).toBeNull()
  })

  it("updateExam refusé si l'examen a des participations", async () => {
    asAdmin()
    const now = Date.now()
    const res = await updateExam({
      id: noPauseId,
      title: `Nope ${suffix}`,
      startDate: now - 1000,
      endDate: now + DAY,
      questionIds: examQIds,
      enablePause: false,
    })
    expect(res.success).toBe(false)
  })
})

describe("deleteParticipation (admin)", () => {
  it("supprime la participation → résultats NO_PARTICIPATION", async () => {
    asAdmin()
    const r = await getParticipantExamResults(noPauseId, STUDENT_ID)
    if (!r || !("participant" in r)) throw new Error("participation attendue")

    const del = await deleteParticipation({
      participationId: r.participant.participationId,
    })
    expect(del.success).toBe(true)

    const after = await getParticipantExamResults(noPauseId, STUDENT_ID)
    expect(after && "error" in after && after.error).toBe("NO_PARTICIPATION")
  })
})

describe("Gardes d'accès post-endDate + TIME_UP (F3)", () => {
  let pastExamId: string

  beforeAll(async () => {
    const now = Date.now()
    // Examen terminé (endDate dans le passé) + participation complétée seedée
    // directement (startExam refuserait hors fenêtre).
    pastExamId = await makeExam({
      questionIds: examQIds,
      startDate: now - 3 * DAY,
      endDate: now - DAY,
    })
    const partId = createId()
    await db.insert(examParticipations).values({
      id: partId,
      examId: pastExamId,
      userId: STUDENT_ID,
      status: "completed",
      score: 50,
      startedAt: new Date(now - 3 * DAY + 1000),
      completedAt: new Date(now - 2 * DAY),
    })
    await db.insert(examAnswers).values([
      {
        id: createId(),
        participationId: partId,
        questionId: examQIds[0],
        selectedAnswer: "A",
        isCorrect: true,
      },
      {
        id: createId(),
        participationId: partId,
        questionId: examQIds[1],
        selectedAnswer: "B",
        isCorrect: false,
      },
    ])
    // Session training complétée contenant q7 → autorise q7 via le branch training
    // de getExamQuestionExplanations (q7 n'appartient à aucun examen).
    const tsId = createId()
    await db.insert(trainingSessions).values({
      id: tsId,
      userId: STUDENT_ID,
      status: "completed",
      questionCount: 1,
      startedAt: new Date(now - DAY),
      completedAt: new Date(now - DAY + 1000),
      expiresAt: new Date(now + DAY),
    })
    await db.insert(trainingSessionItems).values({
      id: createId(),
      sessionId: tsId,
      questionId: qIds[7],
      position: 0,
      selectedAnswer: "A",
      isCorrect: true,
    })
  })

  it("étudiant : ses propres résultats sont visibles après endDate", async () => {
    asStudent()
    const r = await getParticipantExamResults(pastExamId, STUDENT_ID)
    expect(r && "participant" in r).toBe(true)
    if (!r || "error" in r) return
    expect(r.participant.score).toBe(50)
  })

  it("leaderboard après endDate : un participant le voit", async () => {
    asStudent()
    const lb = await getExamLeaderboard(pastExamId)
    expect(lb.some((e) => e.user?.id === STUDENT_ID)).toBe(true)
  })

  it("leaderboard après endDate : non-participant avec accès le voit", async () => {
    asIntruder() // accès exam, aucune participation
    expect(
      (await getExamLeaderboard(pastExamId)).length,
    ).toBeGreaterThanOrEqual(1)
  })

  it("leaderboard après endDate : non-participant sans accès → []", async () => {
    asNoAccess()
    expect(await getExamLeaderboard(pastExamId)).toEqual([])
  })

  it("explications autorisées via une session de training complétée", async () => {
    asStudent()
    expect(await getExamQuestionExplanations([qIds[7]])).toHaveLength(1)
  })

  it("submit non-auto hors budget-temps → refus ; auto-submit accepté", async () => {
    const activeId = await makeExam({ questionIds: examQIds })
    await db.insert(examParticipations).values({
      id: createId(),
      examId: activeId,
      userId: STUDENT_ID,
      status: "in_progress",
      score: 0,
      startedAt: new Date(Date.now() - 10 * DAY), // budget largement dépassé
    })
    asStudent()
    const ids = (await getExamWithQuestions(activeId))!.questions.map(
      (q) => q._id,
    )
    const ko = await submitExamAnswers({
      examId: activeId,
      answers: [{ questionId: ids[0], selectedAnswer: "A" }],
    })
    expect(ko.success).toBe(false)

    const ok = await submitExamAnswers({
      examId: activeId,
      answers: [{ questionId: ids[0], selectedAnswer: "A" }],
      isAutoSubmit: true,
    })
    expect(ok.success).toBe(true)
  })
})
