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
  finalizeExam,
  pauseExam,
  reactivateExam,
  resumeExam,
  saveExamAnswer,
  startExam,
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
// 11 questions : q0..q5 examens, q6 = témoin non autorisé, q7 = training seul,
// q8 = chevauchement training + examen clos, q9 = training + examen ouvert,
// q10 = examen clos SEUL (aucun chevauchement).
const qIds = Array.from({ length: 11 }, () => createId())
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
let pastExamId: string
let closedOnlyExamId: string
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
  const uids = [ADMIN_ID, STUDENT_ID, INTRUDER_ID, NOACCESS_ID]
  await db
    .delete(trainingSessions)
    .where(inArray(trainingSessions.userId, uids))
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
  it("startExam crée la participation et pré-crée les réponses", async () => {
    asStudent()
    const res = await startExam({ examId: noPauseId })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.participationId).toBeTruthy()
    // startExam ne retourne plus pausePhase
    expect(res).not.toHaveProperty("pausePhase")

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

  it("getExamSession renvoie in_progress et isPaused=false", async () => {
    asStudent()
    const s = await getExamSession(noPauseId)
    expect(s?.status).toBe("in_progress")
    expect(s?.isPaused).toBe(false)
    // Anciens champs supprimés
    expect(s).not.toHaveProperty("pausePhase")
    expect(s).not.toHaveProperty("pauseEndedAt")
    expect(s).not.toHaveProperty("isPauseCutShort")
  })

  it("saveExamAnswer + finalizeExam calcule le score (3/6 = 50)", async () => {
    asStudent()
    const view = await getExamWithQuestions(noPauseId)
    const ids = view!.questions.map((q) => q._id)
    // 3 bonnes (A), 1 mauvaise (B), 2 non répondues → score = 3/6 = 50
    await saveExamAnswer({
      examId: noPauseId,
      questionId: ids[0],
      selectedAnswer: "A",
    })
    await saveExamAnswer({
      examId: noPauseId,
      questionId: ids[1],
      selectedAnswer: "A",
    })
    await saveExamAnswer({
      examId: noPauseId,
      questionId: ids[2],
      selectedAnswer: "A",
    })
    await saveExamAnswer({
      examId: noPauseId,
      questionId: ids[3],
      selectedAnswer: "B",
    })

    const res = await finalizeExam({ examId: noPauseId })
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
    // 4 réponses enregistrées, 2 non répondues (null)
    expect(
      r.participant.answers.filter((a) => a.selectedAnswer !== null),
    ).toHaveLength(4)
    expect(r.questions[0].correctAnswer).toBe("A")
  })

  it("getParticipantExamResults (étudiant, examen actif) → null avant endDate", async () => {
    asStudent()
    expect(await getParticipantExamResults(noPauseId, STUDENT_ID)).toBeNull()
  })
})

describe("Machine de pause", () => {
  it("startExam crée la participation (sans pausePhase)", async () => {
    asStudent()
    const res = await startExam({ examId: pauseId })
    expect(res.success).toBe(true)
    expect(res).not.toHaveProperty("pausePhase")
    const view = await getExamWithQuestions(pauseId)
    pauseOrderedIds = view!.questions.map((q) => q._id)
  })

  it("pauseExam démarre la pause", async () => {
    asStudent()
    const res = await pauseExam({ examId: pauseId })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.pauseStartedAt).toBeGreaterThan(0)

    const s = await getExamSession(pauseId)
    expect(s?.isPaused).toBe(true)
  })

  it("saveExamAnswer refusé pendant la pause", async () => {
    asStudent()
    const res = await saveExamAnswer({
      examId: pauseId,
      questionId: pauseOrderedIds[0],
      selectedAnswer: "A",
    })
    expect(res.success).toBe(false)
  })

  it("pauseExam refuse une 2e pause (déjà en pause)", async () => {
    asStudent()
    const res = await pauseExam({ examId: pauseId })
    expect(res.success).toBe(false)
  })

  it("resumeExam reprend après la pause (durée enregistrée)", async () => {
    asStudent()
    const res = await resumeExam({ examId: pauseId })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.totalPauseDurationMs).toBeGreaterThanOrEqual(0)
    const s = await getExamSession(pauseId)
    expect(s?.isPaused).toBe(false)
  })

  it("pauseExam refuse une 2e utilisation (pause déjà utilisée)", async () => {
    asStudent()
    const res = await pauseExam({ examId: pauseId })
    expect(res.success).toBe(false)
  })

  it("saveExamAnswer + finalizeExam → 100 après reprise", async () => {
    asStudent()
    for (const qId of pauseOrderedIds) {
      await saveExamAnswer({
        examId: pauseId,
        questionId: qId,
        selectedAnswer: "A",
      })
    }
    const res = await finalizeExam({ examId: pauseId })
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
  it("étudiant : examen OUVERT complété → pas d'explication (anti-fuite avant endDate)", async () => {
    // L'étudiant a complété noPauseId, mais cet examen est encore OUVERT
    // (endDate dans le futur) → ses explications ne doivent pas être révélées
    // avant l'ouverture des résultats. (Révélation testée après endDate plus bas.)
    asStudent()
    expect(await getExamQuestionExplanations([qIds[0]])).toEqual([])
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

  it("updateExam autorise une édition de métadonnées même avec participations (set inchangé)", async () => {
    asAdmin()
    const now = Date.now()
    const res = await updateExam({
      id: noPauseId,
      title: `Titre maj ${suffix}`,
      startDate: now - 1000,
      endDate: now + DAY,
      questionIds: examQIds, // jeu de questions inchangé
      enablePause: false,
    })
    expect(res.success).toBe(true)
  })

  it("updateExam refuse un changement du jeu de questions si participations", async () => {
    asAdmin()
    const now = Date.now()
    const res = await updateExam({
      id: noPauseId,
      title: `Nope ${suffix}`,
      startDate: now - 1000,
      endDate: now + DAY,
      questionIds: examQIds.slice(0, 5), // set modifié (5 ≠ 6)
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
  beforeAll(async () => {
    const now = Date.now()
    // Examen clos SEUL (q10, aucun chevauchement avec un examen ouvert) +
    // participation complétée : le témoin « révélation après endDate ».
    closedOnlyExamId = await makeExam({
      questionIds: [qIds[10]],
      startDate: now - 3 * DAY,
      endDate: now - DAY,
    })
    const closedOnlyPartId = createId()
    await db.insert(examParticipations).values({
      id: closedOnlyPartId,
      examId: closedOnlyExamId,
      userId: STUDENT_ID,
      status: "completed",
      score: 100,
      startedAt: new Date(now - 3 * DAY + 1000),
      completedAt: new Date(now - 2 * DAY),
    })
    await db.insert(examAnswers).values({
      id: createId(),
      participationId: closedOnlyPartId,
      questionId: qIds[10],
      selectedAnswer: "A",
      isCorrect: true,
    })
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

  it("explications révélées après endDate (examen CLOS complété)", async () => {
    // Participation complétée sur closedOnlyExamId (endDate passée) contenant
    // q10, qui n'appartient à aucun examen ouvert → explication autorisée.
    asStudent()
    const r = await getExamQuestionExplanations([qIds[10]])
    expect(r).toHaveLength(1)
    expect(r[0].explanation).toContain("Explication")
  })

  it("finalizeExam hors budget-temps → refus ; auto-submit accepté", async () => {
    const activeId = await makeExam({ questionIds: examQIds })
    const partId = createId()
    await db.insert(examParticipations).values({
      id: partId,
      examId: activeId,
      userId: STUDENT_ID,
      status: "in_progress",
      score: 0,
      startedAt: new Date(Date.now() - 10 * DAY), // budget largement dépassé
    })
    // Pre-create answer rows (as startExam would do)
    await db.insert(examAnswers).values(
      examQIds.map((qId) => ({
        id: createId(),
        participationId: partId,
        questionId: qId,
        selectedAnswer: null,
        isCorrect: null,
        isFlagged: false,
      })),
    )
    asStudent()
    const ko = await finalizeExam({ examId: activeId })
    expect(ko.success).toBe(false)

    const ok = await finalizeExam({ examId: activeId, isAutoSubmit: true })
    expect(ok.success).toBe(true)
  })

  it("compat participation legacy (sans lignes examAnswers pré-créées)", async () => {
    // Tests que finalizeExam gère gracieusement une participation sans lignes EA
    const legacyExamId = await makeExam({ questionIds: examQIds })
    const partId = createId()
    const now = Date.now()
    await db.insert(examParticipations).values({
      id: partId,
      examId: legacyExamId,
      userId: STUDENT_ID,
      status: "in_progress",
      score: 0,
      startedAt: new Date(now - 100),
    })
    // Pas de lignes examAnswers (participation legacy)
    asStudent()
    const res = await finalizeExam({ examId: legacyExamId })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.totalQuestions).toBe(0)
    expect(res.score).toBe(0)
  })
})

describe("Anti-triche : chevauchement training / examen OUVERT", () => {
  const seedCompletedTraining = async (userId: string, questionId: string) => {
    const now = Date.now()
    const tsId = createId()
    await db.insert(trainingSessions).values({
      id: tsId,
      userId,
      status: "completed",
      questionCount: 1,
      startedAt: new Date(now - 3600_000),
      completedAt: new Date(now - 3500_000),
      expiresAt: new Date(now + DAY),
    })
    await db.insert(trainingSessionItems).values({
      id: createId(),
      sessionId: tsId,
      questionId,
      position: 0,
      selectedAnswer: "A",
      isCorrect: true,
    })
  }

  beforeAll(async () => {
    const now = Date.now()
    // q9 : examen OUVERT complété tôt par STUDENT + training complété. q9 ne doit
    // appartenir à aucun examen CLOS, sinon la branche examen l'autorise (trou
    // jumeau connu, hors périmètre ici).
    const openId = await makeExam({ questionIds: [qIds[9]] })
    await db.insert(examParticipations).values({
      id: createId(),
      examId: openId,
      userId: STUDENT_ID,
      status: "completed",
      score: 100,
      startedAt: new Date(now - 2000),
      completedAt: new Date(now - 1000),
    })
    await seedCompletedTraining(STUDENT_ID, qIds[9])
    // INTRUDER : participation in_progress + training sur q1.
    await db.insert(examParticipations).values({
      id: createId(),
      examId: noPauseId,
      userId: INTRUDER_ID,
      status: "in_progress",
      score: 0,
      startedAt: new Date(now - 1000),
    })
    await seedCompletedTraining(INTRUDER_ID, qIds[1])
    // q8 : examen CLOS + training complété → seuls les examens OUVERTS doivent
    // bloquer la branche training. Participation in_progress : la branche examen
    // (completed/auto_submitted) ne peut pas accorder q8 — si le test passe,
    // c'est bien la branche training qui a servi l'explication.
    const closedId = await makeExam({
      questionIds: [qIds[8]],
      startDate: now - 3 * DAY,
      endDate: now - DAY,
    })
    await db.insert(examParticipations).values({
      id: createId(),
      examId: closedId,
      userId: STUDENT_ID,
      status: "in_progress",
      score: 0,
      startedAt: new Date(now - 3 * DAY + 1000),
    })
    await seedCompletedTraining(STUDENT_ID, qIds[8])
  })

  it("participation complétée sur un examen ouvert : le training ne révèle pas la question", async () => {
    asStudent()
    expect(await getExamQuestionExplanations([qIds[9]])).toEqual([])
  })

  it("participation in_progress sur un examen ouvert : le training ne révèle pas la question", async () => {
    asIntruder()
    expect(await getExamQuestionExplanations([qIds[1]])).toEqual([])
  })

  it("examen clos chevauchant : l'explication reste servie via le training", async () => {
    asStudent()
    expect(await getExamQuestionExplanations([qIds[8]])).toHaveLength(1)
  })

  it("branche examen : question d'un examen clos masquée si elle chevauche un examen ouvert", async () => {
    // q0 : examen clos complété (pastExamId) MAIS aussi examens ouverts où
    // STUDENT participe → la révélation post-endDate est différée.
    asStudent()
    expect(await getExamQuestionExplanations([examQIds[0]])).toEqual([])
  })

  it("getParticipantExamResults : correctAnswer/isCorrect masqués pour les questions chevauchant un examen ouvert", async () => {
    asStudent()
    const r = await getParticipantExamResults(pastExamId, STUDENT_ID)
    expect(r && "participant" in r).toBe(true)
    if (!r || "error" in r) return

    const q0 = r.questions.find((q) => q._id === examQIds[0])
    expect(q0).toBeDefined()
    expect(q0?.correctAnswer).toBeUndefined()

    const a0 = r.participant.answers.find((a) => a.questionId === examQIds[0])
    expect(a0?.selectedAnswer).toBe("A")
    expect(a0?.isCorrect).toBeNull()
  })

  it("getParticipantExamResults : examen clos sans chevauchement → correction servie", async () => {
    asStudent()
    const r = await getParticipantExamResults(closedOnlyExamId, STUDENT_ID)
    expect(r && "participant" in r).toBe(true)
    if (!r || "error" in r) return

    expect(r.questions.find((q) => q._id === qIds[10])?.correctAnswer).toBe("A")
    expect(
      r.participant.answers.find((a) => a.questionId === qIds[10])?.isCorrect,
    ).toBe(true)
  })
})
