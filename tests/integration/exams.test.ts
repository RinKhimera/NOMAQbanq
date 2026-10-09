import { and, eq } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  examQuestions,
  exams,
  questionExplanations,
  questionImages,
  questions,
  trainingSessionItems,
  trainingSessions,
  user,
} from "@/db/schema"
import {
  getMyDashboard,
  getMyRecentParticipations,
} from "@/features/analytics/dal"
import {
  deactivateExam,
  deleteParticipation,
  finalizeExam,
  reactivateExam,
  saveExamAnswer,
  startExam,
} from "@/features/exams/actions"
import {
  getExamLeaderboard,
  getExamQuestionExplanations,
  getExamSession,
  getExamWithQuestions,
  getExamsOverview,
  getExamsWithParticipation,
  getParticipantExamResults,
} from "@/features/exams/dal"
import { getTrainingHistory } from "@/features/training/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"
import {
  createFinalizedExam,
  saveAndFinalize,
  saveExamSettings,
} from "../helpers/exam-form"
import { TEST_OBJECTIVE_ID } from "../helpers/objective"
import { seedExam } from "../helpers/seed-exam"
import { seedAccess } from "../helpers/seed-payments"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const DAY = 24 * 60 * 60 * 1000
const ADMIN_ID = createId()
const STUDENT_ID = createId()
// Passe les examens de bout en bout : ses participations complétées restent
// hors du tableau de bord de STUDENT, dont l'historique est borné à 5.
const TAKER_ID = createId()
const INTRUDER_ID = createId()
const NOACCESS_ID = createId()
// 11 questions : q0..q5 examens, q6 = témoin non autorisé, q7 = training seul,
// q8 = chevauchement training + examen clos, q9 = training + examen ouvert,
// q10 = examen clos SEUL (aucun chevauchement).
const qIds = Array.from({ length: 11 }, () => createId())
const examQIds = qIds.slice(0, 6)
// Banque des tests de création et de modification, qui exigent 10 questions.
const crudQIds = Array.from({ length: 12 }, () => createId())

const setSession = (id: string, role: "user" | "admin") =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue({ user: { id, role } } as never)
const asAdmin = () => setSession(ADMIN_ID, "admin")
const asStudent = () => setSession(STUDENT_ID, "user")
const asTaker = () => setSession(TAKER_ID, "user")

/** Score écrit par `finalizeExam` : il ne repart pas vers le navigateur. */
const persistedScore = async (examId: string) => {
  const [p] = await db
    .select({ score: examParticipations.score })
    .from(examParticipations)
    .where(
      and(
        eq(examParticipations.examId, examId),
        eq(examParticipations.userId, TAKER_ID),
      ),
    )
  return p?.score
}
const asIntruder = () => setSession(INTRUDER_ID, "user")
const asNoAccess = () => setSession(NOACCESS_ID, "user")

const grantExamAccess = (userId: string) =>
  seedAccess(userId, "exam", new Date(Date.now() + 10 * DAY))

const makeExam = async (opts: {
  questionIds: string[]
  startDate?: number
  endDate?: number
}): Promise<string> => {
  const now = Date.now()
  return seedExam({
    createdBy: ADMIN_ID,
    title: `Exam ${createId().slice(0, 4)}`,
    startDate: opts.startDate ?? now - 3600_000,
    endDate: opts.endDate ?? now + 3600_000,
    questionIds: opts.questionIds,
  })
}

// Examen ouvert que l'étudiant a déjà terminé (100), réponses comprises : il
// retient la correction de toute question qu'il partage. Semé le premier, il
// ferme avant tout autre examen ouvert de l'étudiant.
let completedOpenId: string
// Examen clos complété (50) dont q0 chevauche completedOpenId.
let pastExamId: string
// Examen clos complété (100) sur q10, qu'aucun examen ouvert ne partage.
let closedOnlyExamId: string

/** Examen ouvert neuf (q0..q5) que TAKER vient de démarrer. */
const startedExam = async () => {
  const examId = await makeExam({ questionIds: examQIds })
  asTaker()
  const res = await startExam({ examId })
  if (!res.success) throw new Error(res.error)
  return examId
}

/**
 * Sur un examen démarré : 3 bonnes (A), 1 mauvaise (B), 1 hors options
 * refusée, 1 sans réponse, puis finalisation → 3/6 = 50.
 */
const answerAndFinalize = async (examId: string) => {
  asTaker()
  for (const questionId of examQIds.slice(0, 3)) {
    await saveExamAnswer({ examId, questionId, selectedAnswer: "A" })
  }
  await saveExamAnswer({
    examId,
    questionId: examQIds[3],
    selectedAnswer: "B",
  })
  const orphan = await saveExamAnswer({
    examId,
    questionId: examQIds[4],
    selectedAnswer: "Z",
  })
  const finalized = await finalizeExam({ examId })
  return { orphan, finalized }
}

beforeAll(async () => {
  await db.insert(user).values([
    { id: ADMIN_ID, name: "IT admin", email: "adm@test.invalid" },
    {
      id: STUDENT_ID,
      name: "IT student",
      username: "it-stu",
      email: "stu@test.invalid",
    },
    { id: TAKER_ID, name: "IT taker", email: "tak@test.invalid" },
    { id: INTRUDER_ID, name: "IT intru", email: "int@test.invalid" },
    { id: NOACCESS_ID, name: "IT noacc", email: "noa@test.invalid" },
  ])
  await grantExamAccess(STUDENT_ID)
  await grantExamAccess(TAKER_ID)
  await grantExamAccess(INTRUDER_ID)

  await db.insert(questions).values(
    [...qIds, ...crudQIds].map((id, i) => ({
      id,
      question: `Q ${i} ?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectiveId: TEST_OBJECTIVE_ID,
      domain: "EXAM",
    })),
  )
  await db.insert(questionExplanations).values(
    qIds.map((id, i) => ({
      questionId: id,
      explanation: `Explication ${i}`,
      references: i === 0 ? ["Ref 1"] : null,
    })),
  )
  await db
    .insert(questionImages)
    .values([{ questionId: qIds[0], storagePath: "t/0.jpg", position: 0 }])

  completedOpenId = await makeExam({ questionIds: examQIds })
  const completedId = createId()
  await db.insert(examParticipations).values({
    id: completedId,
    examId: completedOpenId,
    userId: STUDENT_ID,
    status: "completed",
    score: 100,
    startedAt: new Date(Date.now() - 2000),
    completedAt: new Date(Date.now() - 1000),
  })
  await db.insert(examAnswers).values(
    examQIds.map((questionId) => ({
      participationId: completedId,
      questionId,
      selectedAnswer: "A",
      isCorrect: true,
    })),
  )

  const now = Date.now()
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
  // Participation seedée directement : startExam refuserait hors fenêtre.
  pastExamId = await makeExam({
    questionIds: examQIds,
    startDate: now - 3 * DAY,
    endDate: now - DAY,
  })
  const pastPartId = createId()
  await db.insert(examParticipations).values({
    id: pastPartId,
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
      participationId: pastPartId,
      questionId: examQIds[0],
      selectedAnswer: "A",
      isCorrect: true,
    },
    {
      id: createId(),
      participationId: pastPartId,
      questionId: examQIds[1],
      selectedAnswer: "B",
      isCorrect: false,
    },
  ])
  // Session training complétée contenant q7 → autorise q7 via la branche
  // training de getExamQuestionExplanations (q7 n'appartient à aucun examen).
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

describe("Admin CRUD", () => {
  it("la création refuse une question supprimée (INVALID_QUESTIONS)", async () => {
    const deletedId = createId()
    await db.insert(questions).values({
      id: deletedId,
      question: "Q supprimée ?",
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectiveId: TEST_OBJECTIVE_ID,
      domain: "EXAM",
      deletedAt: new Date(),
    })
    asAdmin()
    const now = Date.now()
    const res = await createFinalizedExam({
      title: "Bad",
      startDate: now,
      endDate: now + DAY,
      questionIds: [...crudQIds.slice(0, 9), deletedId],
      enablePause: false,
    })
    expect(res).toEqual({
      success: false,
      error: "Certaines questions sélectionnées sont introuvables.",
    })
  })

  it("la modification sur un examen sans participation change le titre + questions", async () => {
    const id = await makeExam({ questionIds: crudQIds.slice(0, 10) })
    asAdmin()
    const now = Date.now()
    const res = await saveAndFinalize({
      id,
      title: "Updated",
      startDate: now - 1000,
      endDate: now + DAY,
      questionIds: crudQIds.slice(0, 11), // passe de 10 à 11 questions
      enablePause: false,
    })
    expect(res.success).toBe(true)

    const view = await getExamWithQuestions(id)
    expect(view?.exam.title).toBe("Updated")
    expect(view?.questions).toHaveLength(11)
    expect(view?.exam.completionTime).toBe(11 * 83)
  })

  it("modification et startExam concurrents : participation cohérente avec le set servi (verrou commun)", async () => {
    const id = await makeExam({ questionIds: crudQIds.slice(0, 10) })
    const newSet = crudQIds.slice(2, 12) // set différent

    const now = Date.now()
    const [, start] = await Promise.all([
      // `saveExam` seul : la finalisation qui suivrait relirait la session
      // courante, déjà basculée sur l'étudiant par l'autre branche.
      (async () => {
        asAdmin()
        return saveExamSettings({
          id,
          title: "Race",
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
    let all = await getExamsOverview()
    expect(all.find((e) => e.id === id)?.isActive).toBe(false)

    await reactivateExam({ examId: id })
    all = await getExamsOverview()
    expect(all.find((e) => e.id === id)?.isActive).toBe(true)
  })
})

describe("Passation sans pause (scoring serveur)", () => {
  it("startExam crée la participation et pré-crée les réponses", async () => {
    const examId = await makeExam({ questionIds: examQIds })
    asTaker()
    const res = await startExam({ examId })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.participationId).toBeTruthy()

    // Idempotent : 2e appel → même participation.
    const again = await startExam({ examId })
    expect(again.success && again.participationId).toBe(res.participationId)
  })

  it("getExamWithQuestions masque correctAnswer pour l'étudiant", async () => {
    const examId = await startedExam()
    const view = await getExamWithQuestions(examId)
    expect(view?.questions).toHaveLength(6)
    expect(view?.questions[0]).not.toHaveProperty("correctAnswer")
    expect(view?.questions[0].images).toHaveLength(1)
  })

  it("getExamSession renvoie in_progress et isPaused=false", async () => {
    const examId = await startedExam()
    const s = await getExamSession(examId)
    expect(s?.status).toBe("in_progress")
    expect(s?.isPaused).toBe(false)
  })

  it("saveExamAnswer + finalizeExam calcule le score (3/6 = 50)", async () => {
    const examId = await startedExam()
    const { orphan, finalized } = await answerAndFinalize(examId)
    // Hors options : refusé sans écriture (l'admin voit 4 réponses, plus bas).
    expect(orphan.success).toBe(false)
    // Le décompte des justes ne repart pas vers le navigateur : lu en base.
    expect(finalized).toEqual({ success: true })
    expect(await persistedScore(examId)).toBe(50)
  })

  it("startExam refuse une 2e passation (déjà passé)", async () => {
    asStudent()
    expect(await startExam({ examId: completedOpenId })).toEqual({
      success: false,
      error: "Vous avez déjà passé cet examen.",
    })
  })

  it("getParticipantExamResults (admin) révèle correctAnswer + réponses", async () => {
    const examId = await startedExam()
    await answerAndFinalize(examId)
    asAdmin()
    const r = await getParticipantExamResults(examId, TAKER_ID)
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
    expect(
      await getParticipantExamResults(completedOpenId, STUDENT_ID),
    ).toBeNull()
  })
})

describe("Leaderboard", () => {
  it("admin voit le classement trié par score", async () => {
    asAdmin()
    const lb = await getExamLeaderboard(completedOpenId)
    expect(lb).toHaveLength(1)
    expect(lb[0].user?.id).toBe(STUDENT_ID)
    expect(lb[0].user?.username).toBe("it-stu")
    expect(lb[0].score).toBe(100)
  })

  it("le classement admin (nom complet, copies) reste réservé à l'admin", async () => {
    asStudent()
    await expect(getExamLeaderboard(completedOpenId)).rejects.toThrow()
  })
})

describe("Explications lazy (autorisation)", () => {
  it("étudiant : examen OUVERT complété → pas d'explication (anti-fuite avant endDate)", async () => {
    // L'étudiant a complété completedOpenId, mais cet examen est encore OUVERT
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
    const res = await startExam({ examId: completedOpenId })
    expect(res.success).toBe(false)
  })

  it("un intrus ne peut pas lire les résultats d'autrui", async () => {
    // Examen clos : seule la propriété (ou le rôle admin) retient la lecture.
    asIntruder()
    expect(await getParticipantExamResults(pastExamId, STUDENT_ID)).toBeNull()
  })

  /** Examen de 10 questions dont l'étudiant a une participation. */
  const takenExam = async () => {
    const id = await makeExam({ questionIds: crudQIds.slice(0, 10) })
    await db.insert(examParticipations).values({
      id: createId(),
      examId: id,
      userId: STUDENT_ID,
      status: "in_progress",
      startedAt: new Date(),
    })
    return id
  }

  it("la modification autorise une édition de métadonnées même avec participations (set inchangé)", async () => {
    const id = await takenExam()
    asAdmin()
    const now = Date.now()
    const res = await saveAndFinalize({
      id,
      title: "Titre maj",
      startDate: now - 1000,
      endDate: now + DAY,
      questionIds: crudQIds.slice(0, 10), // jeu de questions inchangé
      enablePause: false,
    })
    expect(res.success).toBe(true)
  })

  it("la modification refuse un changement du jeu de questions si participations", async () => {
    const id = await takenExam()
    asAdmin()
    const now = Date.now()
    const res = await saveAndFinalize({
      id,
      title: "Nope",
      startDate: now - 1000,
      endDate: now + DAY,
      questionIds: crudQIds.slice(1, 11), // set modifié
      enablePause: false,
    })
    expect(res).toEqual({
      success: false,
      error:
        "Cet examen a déjà des participations ; ses questions ne peuvent plus être modifiées.",
    })
  })
})

describe("deleteParticipation (admin)", () => {
  it("supprime la participation → résultats NO_PARTICIPATION", async () => {
    const examId = await makeExam({ questionIds: examQIds })
    await db.insert(examParticipations).values({
      id: createId(),
      examId,
      userId: TAKER_ID,
      status: "completed",
      score: 50,
      startedAt: new Date(Date.now() - 2000),
      completedAt: new Date(Date.now() - 1000),
    })
    asAdmin()
    const r = await getParticipantExamResults(examId, TAKER_ID)
    if (!r || !("participant" in r)) throw new Error("participation attendue")

    const del = await deleteParticipation({
      participationId: r.participant.participationId,
    })
    expect(del.success).toBe(true)

    const after = await getParticipantExamResults(examId, TAKER_ID)
    expect(after && "error" in after && after.error).toBe("NO_PARTICIPATION")
  })
})

describe("Gardes d'accès post-endDate + TIME_UP", () => {
  it("étudiant : ses propres résultats sont visibles après endDate, score retenu tant qu'une réponse chevauche un examen ouvert", async () => {
    // examQIds[0] est aussi dans completedOpenId, ouvert, où STUDENT a
    // répondu : la réponse est différée et le score (50) avec elle.
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
      userId: TAKER_ID,
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
    asTaker()
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
    const intruderOpenId = await makeExam({ questionIds: examQIds })
    await db.insert(examParticipations).values({
      id: createId(),
      examId: intruderOpenId,
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
      const { items } = await getTrainingHistory({ pageSize: 50 })
      expect(items.find((s) => s.id === withheldTrainingId)?.score).toBeNull()
      expect(items.find((s) => s.id === readableTrainingId)?.score).toBe(100)
    })

    it("courbe hebdomadaire du tableau de bord : la série retenue n'entre pas dans la moyenne de sa semaine", async () => {
      asStudent()
      const d = await getMyDashboard("tout")
      // 40 (retenue) et 100 (lisible), closes il y a une heure : 100, pas 70.
      expect(d?.training.weekly.at(-1)?.averageScore).toBe(100)
    })

    it("participation à un examen encore OUVERT : score retenu sur la liste, l'historique et la moyenne", async () => {
      asStudent()
      const list = await getExamsWithParticipation()
      // Retenu par son examen propre, ouvert : aucun AUTRE examen ouvert ne
      // partage la question répondue, donc pas de titre « publié à la
      // fermeture de … ».
      expect(
        list.find((e) => e.id === openId)?.userParticipation,
      ).toMatchObject({ score: null, withheldBy: null })
      expect(
        list.find((e) => e.id === closedOnlyExamId)?.userParticipation,
      ).toMatchObject({ score: 100, withheldBy: null })

      const recent = await getMyRecentParticipations()
      expect(recent.find((h) => h.examId === openId)?.score).toBeNull()
      const curve = (await getMyDashboard("tout"))?.exams.history ?? []
      expect(curve.some((h) => h.examId === openId)).toBe(false)
      expect(curve.find((h) => h.examId === closedOnlyExamId)?.score).toBe(100)
    })

    it("examen propre CLOS mais question répondue d'un examen OUVERT : retenu sur la liste et l'historique", async () => {
      // pastExamId est clos (la clause « examen propre » ne joue pas) ; seule
      // la réponse à examQIds[0], question des examens ouverts, le retient.
      asStudent()
      const list = await getExamsWithParticipation()
      expect(
        list.find((e) => e.id === pastExamId)?.userParticipation?.score,
      ).toBeNull()
      // « Publié à la fermeture de … » nomme l'examen ouvert qui retient, le
      // premier à fermer : la branche titre de `withheldByOpenExamTitle`,
      // corrélée au milieu de trois jointures, s'exécute ici sur un vrai
      // Postgres.
      const [completedOpen] = await db
        .select({ title: exams.title })
        .from(exams)
        .where(eq(exams.id, completedOpenId))
      expect(
        list.find((e) => e.id === pastExamId)?.userParticipation?.withheldBy,
      ).toBe(completedOpen.title)
      const recent = await getMyRecentParticipations()
      expect(recent.find((h) => h.examId === pastExamId)?.score).toBeNull()
      const curve = (await getMyDashboard("tout"))?.exams.history ?? []
      expect(curve.some((h) => h.examId === pastExamId)).toBe(false)
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

  const makeBareExam = (id: string, endDate: Date, questionId: string) => ({
    exam: {
      id,
      title: `Empty ${id.slice(0, 4)}`,
      startDate: new Date(Date.now() - DAY),
      endDate,
      createdBy: ADMIN_ID,
      targetQuestionCount: 10,
      finalizedAt: new Date(),
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
      email: "empty@test.invalid",
    })
    await grantExamAccess(EMPTY_ID)
    // Clos une minute avant le seed (lisible) ou ouvert une minute après
    // (retenu), aucune question répondue dans les deux cas. La borne exacte
    // `end_date > now()` (strict) est portée par tests/questions/answer-key-lock.test.ts :
    // une date de fin égale à l'horloge JS du seed dépendrait de l'écart entre
    // cette horloge et celle de Postgres.
    const specs = [
      makeBareExam(emptyOpenId, new Date(Date.now() + 60_000), qIds[2]),
      makeBareExam(emptyClosedId, new Date(Date.now() - 60_000), qIds[3]),
      makeBareExam(emptyAdminOpenId, new Date(Date.now() + 60_000), qIds[4]),
    ]
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
    const recent = await getMyRecentParticipations()
    expect(recent.find((h) => h.examId === emptyOpenId)?.score).toBeNull()
    expect(recent.find((h) => h.examId === emptyClosedId)?.score).toBe(0)

    const d = await getMyDashboard("tout")
    expect(d?.exams.completedCount).toBe(2)
    expect(d?.exams.averageScore).toBe(0)
  })

  it("tout retenu : la moyenne est null, jamais 0", async () => {
    setSession(EMPTY_ID, "user")
    await db
      .update(exams)
      .set({ endDate: new Date(Date.now() + 60_000) })
      .where(eq(exams.id, emptyClosedId))
    try {
      const d = await getMyDashboard("tout")
      expect(d?.exams.completedCount).toBe(2)
      expect(d?.exams.averageScore).toBeNull()
      expect(d?.exams.overallAverage).toBeNull()
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
    const recent = await getMyRecentParticipations()
    expect(recent.find((h) => h.examId === emptyAdminOpenId)?.score).toBe(0)
  })
})
