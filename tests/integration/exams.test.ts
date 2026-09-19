import { and, eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  examQuestions,
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
  getAllExamsAdmin,
  getExamLeaderboard,
  getExamQuestionExplanations,
  getExamSession,
  getExamWithQuestions,
  getExamsStats,
  getExamsWithParticipation,
  getMyDashboardStats,
  getMyScoreHistory,
  getParticipantExamResults,
} from "@/features/exams/dal"
import {
  getMyTrainingScoreHistory,
  getTrainingHistory,
  getTrainingStats,
} from "@/features/training/dal"
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

/** Score écrit par `finalizeExam` : il ne repart pas vers le navigateur. */
const persistedScore = async (examId: string) => {
  const [p] = await db
    .select({ score: examParticipations.score })
    .from(examParticipations)
    .where(
      and(
        eq(examParticipations.examId, examId),
        eq(examParticipations.userId, STUDENT_ID),
      ),
    )
  return p?.score
}
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
    stripePriceLookupKey: `price_${suffix}`,
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

  it("updateExam et startExam concurrents : participation cohérente avec le set servi (verrou commun)", async () => {
    const id = await makeExam({ questionIds: examQIds.slice(0, 4) })
    const newSet = examQIds // set différent (6 questions)

    const now = Date.now()
    const [, start] = await Promise.all([
      (async () => {
        asAdmin()
        return updateExam({
          id,
          title: `Race ${suffix}`,
          startDate: now - 1000,
          endDate: now + DAY,
          questionIds: newSet,
          enablePause: false,
        })
      })(),
      (async () => {
        asStudent()
        return startExam({ examId: id })
      })(),
    ])

    // Invariant : si une participation a été créée, ses examAnswers correspondent
    // EXACTEMENT au set de questions effectivement stocké (pas de mélange
    // ancien/nouveau). Le verrou commun sur la ligne examen sérialise les deux.
    {
      const stored = await db
        .select({ questionId: examQuestions.questionId })
        .from(examQuestions)
        .where(eq(examQuestions.examId, id))
      const answers = await db
        .select({ questionId: examAnswers.questionId })
        .from(examAnswers)
        .innerJoin(
          examParticipations,
          eq(examParticipations.id, examAnswers.participationId),
        )
        .where(eq(examParticipations.examId, id))
      const storedSet = new Set(stored.map((r) => r.questionId))
      const answerSet = new Set(answers.map((r) => r.questionId))
      // Si aucune participation n'a survécu à la course, aucune réponse ne doit
      // exister — l'invariant se vérifie donc dans les deux issues.
      expect(answerSet).toEqual(start.success ? storedSet : new Set())
    }
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

  it("getExamsStats reflète l'état", async () => {
    asAdmin()
    const stats = await getExamsStats()
    expect(stats.total).toBeGreaterThanOrEqual(2)
    expect(stats.active).toBeGreaterThanOrEqual(2)
    expect(stats.eligibleCandidates).toBeGreaterThanOrEqual(1)
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
    // Le décompte des justes ne repart pas vers le navigateur : lu en base.
    expect(res).toEqual({ success: true })
    expect(await persistedScore(noPauseId)).toBe(50)
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
    expect(res).toEqual({ success: true })
    expect(await persistedScore(pauseId)).toBe(100)
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

  it("étudiant : ses propres résultats sont visibles après endDate, score retenu tant qu'une réponse chevauche un examen ouvert", async () => {
    // examQIds[0] est aussi dans noPauseId/pauseId, ouverts, où STUDENT a
    // participé : la réponse est différée et le score (50) avec elle.
    asStudent()
    const r = await getParticipantExamResults(pastExamId, STUDENT_ID)
    expect(r && "participant" in r).toBe(true)
    if (!r || "error" in r) return
    expect(r.participant.score).toBeNull()
  })

  it("admin : jamais verrouillé, le score de la même participation se lit", async () => {
    asAdmin()
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
})

describe("Anti-triche : chevauchement training / examen OUVERT", () => {
  // Sessions de STUDENT : q9 (chevauche un examen ouvert → score retenu) et q8
  // (examen clos seulement → score lisible). Scores distincts pour que la
  // moyenne discrimine.
  let withheldTrainingId: string
  let readableTrainingId: string
  let openId: string

  const seedCompletedTraining = async (
    userId: string,
    questionId: string,
    score = 100,
  ) => {
    const now = Date.now()
    const tsId = createId()
    await db.insert(trainingSessions).values({
      id: tsId,
      userId,
      status: "completed",
      questionCount: 1,
      score,
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
    return tsId
  }

  beforeAll(async () => {
    const now = Date.now()
    // q9 : examen OUVERT complété tôt par STUDENT + training complété. q9 ne doit
    // appartenir à aucun examen CLOS, sinon la branche examen l'autorise (trou
    // jumeau connu, hors périmètre ici).
    openId = await makeExam({ questionIds: [qIds[9]] })
    const openPartId = createId()
    await db.insert(examParticipations).values({
      id: openPartId,
      examId: openId,
      userId: STUDENT_ID,
      status: "completed",
      score: 100,
      startedAt: new Date(now - 2000),
      completedAt: new Date(now - 1000),
    })
    // Réponse enregistrée : elle retient aussi le score de la session
    // d'entraînement qui chevauche q9 (la participation, elle, est déjà retenue
    // par son examen propre, ouvert).
    await db.insert(examAnswers).values({
      id: createId(),
      participationId: openPartId,
      questionId: qIds[9],
      selectedAnswer: "A",
      isCorrect: true,
    })
    withheldTrainingId = await seedCompletedTraining(STUDENT_ID, qIds[9], 40)
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
    readableTrainingId = await seedCompletedTraining(STUDENT_ID, qIds[8], 100)
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
    expect(r.participant.score).toBe(100)
  })

  // Score retenu : le score en base compte les réponses différées ; le lire à
  // côté des compteurs qui les excluent le trahirait. Retenu à la lecture, sur
  // toutes les surfaces étudiant ; jamais pour un admin.
  describe("score retenu (scoreWithheldFor)", () => {
    it("getTrainingHistory : null sur la session chevauchant un examen ouvert, lisible sinon", async () => {
      asStudent()
      const { items } = await getTrainingHistory({ limit: 50 })
      expect(items.find((s) => s.id === withheldTrainingId)?.score).toBeNull()
      expect(items.find((s) => s.id === readableTrainingId)?.score).toBe(100)
    })

    it("getTrainingStats : la moyenne exclut la session retenue (une moyenne avant/après la rendrait)", async () => {
      asStudent()
      const stats = await getTrainingStats()
      // Sessions de STUDENT : 40 (retenue), 100 (lisible) et une sans score
      // (q7, seedée plus haut) → 100, pas 70.
      expect(stats?.totalSessions).toBe(3)
      expect(stats?.averageScore).toBe(100)
    })

    it("getMyTrainingScoreHistory : point retenu à null, hors des moyennes par domaine", async () => {
      asStudent()
      const h = await getMyTrainingScoreHistory()
      expect(
        h.sessions.find((s) => s.sessionId === withheldTrainingId)?.score,
      ).toBeNull()
      expect(
        h.sessions.find((s) => s.sessionId === readableTrainingId)?.score,
      ).toBe(100)
      // q8 (100) + q7 (sans score) restent ; la session retenue sort.
      expect(h.domainPerformance).toEqual([
        { domain: "Tous domaines", averageScore: 100, sessionCount: 2 },
      ])
    })

    it("participation à un examen encore OUVERT : score retenu sur la liste, l'historique et la moyenne", async () => {
      asStudent()
      const list = await getExamsWithParticipation()
      expect(
        list.find((e) => e.id === openId)?.userParticipation?.score,
      ).toBeNull()
      expect(
        list.find((e) => e.id === closedOnlyExamId)?.userParticipation?.score,
      ).toBe(100)

      const hist = await getMyScoreHistory()
      expect(hist.find((h) => h.examId === openId)?.score).toBeNull()
      expect(hist.find((h) => h.examId === closedOnlyExamId)?.score).toBe(100)
    })

    it("examen propre CLOS mais question répondue d'un examen OUVERT : retenu sur la liste et l'historique", async () => {
      // pastExamId est clos (la clause « examen propre » ne joue pas) ; seule
      // la réponse à examQIds[0], question des examens ouverts, le retient.
      asStudent()
      const list = await getExamsWithParticipation()
      expect(
        list.find((e) => e.id === pastExamId)?.userParticipation?.score,
      ).toBeNull()
      const hist = await getMyScoreHistory()
      expect(hist.find((h) => h.examId === pastExamId)?.score).toBeNull()
    })

    it("leaderboard : la ligne d'un propriétaire retenu est null pour LUI et pour les autres, et sort du rang", async () => {
      asStudent()
      const own = await getExamLeaderboard(pastExamId)
      const mine = own.find((e) => e.user?.id === STUDENT_ID)
      expect(mine).toBeDefined()
      expect(mine?.score).toBeNull()
      // Tri sur le score lisible, nulls last : la ligne retenue ferme la liste.
      expect(own.at(-1)?.user?.id).toBe(STUDENT_ID)

      // Un camarade (accès examen, autre compte) ne lit pas plus.
      asIntruder()
      const theirs = await getExamLeaderboard(pastExamId)
      expect(theirs.find((e) => e.user?.id === STUDENT_ID)?.score).toBeNull()
    })

    it("admin : jamais verrouillé — mêmes lectures, scores lisibles", async () => {
      asAdmin()
      const lb = await getExamLeaderboard(openId)
      expect(lb.find((e) => e.user?.id === STUDENT_ID)?.score).toBe(100)
    })
  })
})

// Score retenu par l'examen propre : « un score d'examen est retenu tant que
// son propre examen est ouvert » (CONTEXT.md), réponses ou non. Une
// participation auto-soumise sans réponse a un score 0 enregistré ; le livrer
// pendant la fenêtre ferait « 0 réussi · Score moyen : 0 % » là où la liste
// affiche « — ».
describe("score retenu — participation sans réponse", () => {
  const EMPTY_ID = createId()
  const emptyOpenId = createId()
  const emptyClosedId = createId()
  const emptyAdminOpenId = createId()
  let emptyExamIds: string[]

  const makeBareExam = (id: string, endDate: Date, questionId: string) => ({
    exam: {
      id,
      title: `Empty ${suffix} ${id.slice(0, 4)}`,
      startDate: new Date(Date.now() - DAY),
      endDate,
      createdBy: ADMIN_ID,
      completionTime: 3600,
    },
    questionId,
  })
  const participation = (examId: string, userId: string) => ({
    id: createId(),
    examId,
    userId,
    status: "auto_submitted" as const,
    score: 0,
    startedAt: new Date(Date.now() - 2000),
    completedAt: new Date(Date.now() - 1000),
  })

  beforeAll(async () => {
    await db.insert(user).values({
      id: EMPTY_ID,
      name: "IT empty",
      email: `empty-${suffix}@test.invalid`,
    })
    await grantExamAccess(EMPTY_ID)
    // Clos une minute avant le seed (lisible) ou ouvert une minute après
    // (retenu), aucune question répondue dans les deux cas. La borne exacte
    // `end_date > now()` (strict) est portée par le test du fragment SQL :
    // une date de fin égale à l'horloge JS du seed dépendrait de l'écart entre
    // cette horloge et celle de Neon.
    const specs = [
      makeBareExam(emptyOpenId, new Date(Date.now() + 60_000), qIds[2]),
      makeBareExam(emptyClosedId, new Date(Date.now() - 60_000), qIds[3]),
      makeBareExam(emptyAdminOpenId, new Date(Date.now() + 60_000), qIds[4]),
    ]
    emptyExamIds = specs.map((s) => s.exam.id)
    await db.insert(exams).values(specs.map((s) => s.exam))
    await db.insert(examQuestions).values(
      specs.map((s) => ({
        examId: s.exam.id,
        questionId: s.questionId,
        position: 0,
      })),
    )
    await db
      .insert(examParticipations)
      .values([
        participation(emptyOpenId, EMPTY_ID),
        participation(emptyClosedId, EMPTY_ID),
        participation(emptyAdminOpenId, ADMIN_ID),
      ])
  })

  afterAll(async () => {
    await db.delete(exams).where(inArray(exams.id, emptyExamIds))
    await db.delete(userAccess).where(eq(userAccess.userId, EMPTY_ID))
    await db.delete(transactions).where(eq(transactions.userId, EMPTY_ID))
    await db.delete(user).where(eq(user.id, EMPTY_ID))
  })

  it("liste des examens : null sur l'examen ouvert, 0 sur l'examen clos", async () => {
    setSession(EMPTY_ID, "user")
    const list = await getExamsWithParticipation()
    expect(
      list.find((e) => e.id === emptyOpenId)?.userParticipation,
    ).toMatchObject({ score: null })
    expect(
      list.find((e) => e.id === emptyClosedId)?.userParticipation,
    ).toMatchObject({ score: 0 })
  })

  it("historique et moyenne du tableau de bord : le point ouvert est null, la moyenne ne compte que le clos (0, pas null)", async () => {
    setSession(EMPTY_ID, "user")
    const hist = await getMyScoreHistory()
    expect(hist.find((h) => h.examId === emptyOpenId)?.score).toBeNull()
    expect(hist.find((h) => h.examId === emptyClosedId)?.score).toBe(0)

    const stats = await getMyDashboardStats()
    expect(stats?.completedExamsCount).toBe(2)
    expect(stats?.averageScore).toBe(0)
  })

  it("tout retenu : la moyenne est null, jamais 0", async () => {
    setSession(EMPTY_ID, "user")
    await db
      .update(exams)
      .set({ endDate: new Date(Date.now() + 60_000) })
      .where(eq(exams.id, emptyClosedId))
    try {
      const stats = await getMyDashboardStats()
      expect(stats?.completedExamsCount).toBe(2)
      expect(stats?.averageScore).toBeNull()
    } finally {
      await db
        .update(exams)
        .set({ endDate: new Date(Date.now() - 60_000) })
        .where(eq(exams.id, emptyClosedId))
    }
  })

  it("admin : lit le score brut de sa participation sur un examen ouvert", async () => {
    asAdmin()
    const list = await getExamsWithParticipation()
    expect(
      list.find((e) => e.id === emptyAdminOpenId)?.userParticipation,
    ).toMatchObject({ score: 0 })
    const hist = await getMyScoreHistory()
    expect(hist.find((h) => h.examId === emptyAdminOpenId)?.score).toBe(0)
  })
})
