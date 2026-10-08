import { eq } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
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
  completeTrainingSession,
  createTrainingSession,
  deleteTrainingSession,
  saveTrainingAnswer,
  setQuestionBookmark,
} from "@/features/training/actions"
import {
  getActiveTrainingSession,
  getAvailableDomains,
  getAvailableObjectifsCMC,
  getTrainingHistory,
  getTrainingSessionById,
  getTrainingSessionResults,
} from "@/features/training/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"
import { objectiveIdFor } from "../helpers/objective"
import { seedAccess } from "../helpers/seed-payments"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const USER_ID = createId()
const DOMAIN = "TRAIN"
const OBJ = "Objectif entraînement"
const qIds = Array.from({ length: 8 }, () => createId())

const asAdmin = () =>
  vi.mocked(getCurrentSession).mockResolvedValue({
    user: { id: USER_ID, role: "admin" },
  } as never)

/**
 * Admin neuf, sans série : la règle « une seule série en cours » ne lie pas un
 * test à un autre.
 */
const asNewAdmin = async () => {
  const id = createId()
  await db
    .insert(user)
    .values({ id, name: "IT training", email: `admin-${id}@test.invalid` })
  vi.mocked(getCurrentSession).mockResolvedValue({
    user: { id, role: "admin" },
  } as never)
  return id
}

/** Session close (abandonnée) avec un item, posée sans passer par l'action. */
const seedClosedSession = async (userId: string) => {
  const id = createId()
  const now = Date.now()
  await db.insert(trainingSessions).values({
    id,
    userId,
    status: "abandoned",
    mode: "test",
    questionCount: 1,
    startedAt: new Date(now - 3600_000),
    completedAt: new Date(now - 1000),
    expiresAt: new Date(now + 3600_000),
  })
  await db
    .insert(trainingSessionItems)
    .values({ sessionId: id, questionId: qIds[0], position: 0 })
  return id
}

beforeAll(async () => {
  await db.insert(user).values({
    id: USER_ID,
    name: "IT training",
    email: "training@test.invalid",
  })
  const objectiveId = await objectiveIdFor(OBJ)
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `Q ${i} ?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectiveId,
      domain: DOMAIN,
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
})

beforeEach(() => {
  asAdmin()
})

describe("signets sur la vue de session", () => {
  it("la vue expose les signets de l'utilisateur", async () => {
    await asNewAdmin()
    const created = await createTrainingSession({
      questionCount: 5,
      domain: DOMAIN,
      mode: "test",
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    const before = await getTrainingSessionById(created.sessionId)
    expect(before?.bookmarkedIds).toEqual([])
    const questionId = before!.questions[0]._id

    await setQuestionBookmark({ questionId, isBookmarked: true })

    const after = await getTrainingSessionById(created.sessionId)
    expect(after?.bookmarkedIds).toEqual([questionId])
  })
})

describe("parcours complet", () => {
  it("création → réponses → fin → résultats → historique", async () => {
    await asNewAdmin()

    // Création : la session et ses 5 items.
    const res = await createTrainingSession({
      questionCount: 5,
      domain: DOMAIN,
      mode: "test",
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    const sessionId = res.sessionId

    const created = await getTrainingSessionById(sessionId)
    expect(created?.session.status).toBe("in_progress")
    expect(created?.questions).toHaveLength(5)
    const questionIds = created!.questions.map((q) => q._id)

    // Reprise : la session en cours est proposée.
    const active = await getActiveTrainingSession()
    expect(active?.session.id).toBe(sessionId)
    expect(active?.canResume).toBe(true)
    expect(active?.session.questionCount).toBe(5)

    // En cours : correctAnswer masqué, aucune réponse.
    expect(created?.questions[0]).not.toHaveProperty("correctAnswer")
    expect(created?.answers).toEqual({})

    // Mode test : isCorrect ne voyage pas sur le fil (anti-triche).
    const ok = await saveTrainingAnswer({
      sessionId,
      questionId: questionIds[0],
      selectedAnswer: "A",
    })
    expect(ok).toEqual({ success: true })
    const ko = await saveTrainingAnswer({
      sessionId,
      questionId: questionIds[1],
      selectedAnswer: "B",
    })
    expect(ko).toEqual({ success: true })

    // Mode test en cours : isCorrect masqué dans answers.
    const answered = await getTrainingSessionById(sessionId)
    expect(Object.keys(answered!.answers)).toHaveLength(2)
    expect(answered?.answers[questionIds[0]]).toEqual({ selectedAnswer: "A" })

    // Question hors session, texte qui n'est pas une option : refusés sans
    // rien écrire.
    const outside = await saveTrainingAnswer({
      sessionId,
      questionId: createId(),
      selectedAnswer: "A",
    })
    expect(outside.success).toBe(false)
    const notAnOption = await saveTrainingAnswer({
      sessionId,
      questionId: questionIds[2],
      selectedAnswer: "Z",
    })
    expect(notAnOption.success).toBe(false)
    const unchanged = await getTrainingSessionById(sessionId)
    expect(unchanged?.answers[questionIds[2]]).toBeUndefined()
    expect(Object.keys(unchanged!.answers)).toHaveLength(2)

    // Fin : 1 juste sur 5 = 20 %, lu en base ; le décompte ne repart pas vers
    // le navigateur.
    expect(await completeTrainingSession({ sessionId })).toEqual({
      success: true,
    })
    const [row] = await db
      .select({ score: trainingSessions.score })
      .from(trainingSessions)
      .where(eq(trainingSessions.id, sessionId))
    expect(row?.score).toBe(20)

    // Après complétion : correctAnswer révélé.
    const done = await getTrainingSessionById(sessionId)
    expect(done?.session.status).toBe("completed")
    expect(done?.questions[0]).toHaveProperty("correctAnswer", "A")

    const results = await getTrainingSessionResults(sessionId)
    expect(results && "session" in results).toBe(true)
    if (!results || "error" in results) return
    expect(results.session.score).toBe(20)
    const q0 = results.questions.find((q) => q._id === questionIds[0])
    expect(q0?.correctAnswer).toBe("A")
    expect(q0?.explanation).toContain("Explication")
    expect(results.answers[questionIds[0]]?.isCorrect).toBe(true)

    // Historique : la seule série de l'utilisateur, son mode et le total ;
    // une page hors bornes est vide, le total inchangé.
    const history = await getTrainingHistory({ page: 1 })
    expect(history.items).toHaveLength(1)
    expect(history.items[0]).toMatchObject({
      id: sessionId,
      mode: "test",
      score: 20,
    })
    expect(history.total).toBe(1)
    const beyond = await getTrainingHistory({ page: 99, pageSize: 1 })
    expect(beyond.items).toEqual([])
    expect(beyond.total).toBe(1)
  })

  it("saveTrainingAnswer compare le texte exact, espaces de fin compris", async () => {
    await asNewAdmin()
    // Domaine propre, chaque question y porte l'option « B » à espace final.
    const objectiveId = await objectiveIdFor(OBJ)
    const questionIds = Array.from({ length: 5 }, () => createId())
    await db.insert(questions).values(
      questionIds.map((id, i) => ({
        id,
        question: `Q espaces ${i} ?`,
        correctAnswer: "A",
        options: ["A", "B ", "C", "D"],
        objectiveId,
        domain: "TRAIN-ESPACES",
      })),
    )
    const res = await createTrainingSession({
      questionCount: 5,
      domain: "TRAIN-ESPACES",
      mode: "test",
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    const questionId = questionIds[0]

    const trimmed = await saveTrainingAnswer({
      sessionId: res.sessionId,
      questionId,
      selectedAnswer: "B",
    })
    expect(trimmed.success).toBe(false)
    const exact = await saveTrainingAnswer({
      sessionId: res.sessionId,
      questionId,
      selectedAnswer: "B ",
    })
    expect(exact).toEqual({ success: true })
  })
})

describe("gardes", () => {
  it("refuse une 2e session si une est déjà en cours", async () => {
    await asNewAdmin()
    const s2 = await createTrainingSession({
      questionCount: 5,
      domain: DOMAIN,
      mode: "test",
    })
    expect(s2.success).toBe(true)
    if (!s2.success) throw new Error(s2.error)

    const s3 = await createTrainingSession({
      questionCount: 5,
      domain: DOMAIN,
      mode: "test",
    })
    expect(s3).toEqual({
      success: false,
      error:
        "Vous avez déjà une série en cours. Terminez-la ou abandonnez-la pour en commencer une autre.",
    })
  })

  it("supprime une session terminée (items en cascade)", async () => {
    const sid = await seedClosedSession(USER_ID)
    const res = await deleteTrainingSession({ sessionId: sid })
    expect(res.success).toBe(true)
    expect(await getTrainingSessionResults(sid)).toBeNull()
    expect(
      await db
        .select({ id: trainingSessionItems.id })
        .from(trainingSessionItems)
        .where(eq(trainingSessionItems.sessionId, sid)),
    ).toEqual([])
  })

  it("refuse si pas assez de questions disponibles", async () => {
    const res = await createTrainingSession({
      questionCount: 20,
      domain: DOMAIN,
      mode: "test",
    })
    expect(res).toEqual({
      success: false,
      error:
        "Seulement 8 questions disponibles avec ces filtres. Élargissez la sélection.",
    })
  })

  it("filtre objectif CMC inexistant → 0 disponible", async () => {
    const res = await createTrainingSession({
      questionCount: 5,
      objectiveIds: ["objectif-fantome"],
      mode: "test",
    })
    expect(res).toEqual({
      success: false,
      error:
        "Aucune question ne correspond à ces filtres. Élargissez la sélection.",
    })
  })
})

describe("domaines + objectifs (config form)", () => {
  it("getAvailableDomains inclut le domaine seedé", async () => {
    const { domains } = await getAvailableDomains()
    expect(domains.find((d) => d.domain === DOMAIN)?.count).toBe(8)
  })

  it("getAvailableObjectifsCMC filtre par domaine", async () => {
    const { objectifs } = await getAvailableObjectifsCMC(DOMAIN)
    expect(objectifs.find((o) => o.objectif === OBJ)?.count).toBe(8)
  })
})

describe("IDOR / propriété", () => {
  it("un autre utilisateur ne peut ni lire ni répondre à la session d'autrui", async () => {
    await asNewAdmin()
    const res = await createTrainingSession({
      questionCount: 5,
      domain: DOMAIN,
      mode: "test",
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    const sid = res.sessionId

    // Bascule sur un intrus (non-admin, non-propriétaire).
    vi.mocked(getCurrentSession).mockResolvedValue({
      user: { id: "intrus", role: "user" },
    } as never)

    expect(await getTrainingSessionById(sid)).toBeNull()
    expect(await getTrainingSessionResults(sid)).toBeNull()
    const save = await saveTrainingAnswer({
      sessionId: sid,
      questionId: createId(),
      selectedAnswer: "A",
    })
    expect(save.success).toBe(false)
  })

  it("un autre utilisateur ne supprime pas la session close d'autrui : introuvable, la ligne survit", async () => {
    const sid = await seedClosedSession(USER_ID)

    vi.mocked(getCurrentSession).mockResolvedValue({
      user: { id: "intrus", role: "user" },
    } as never)
    expect(await deleteTrainingSession({ sessionId: sid })).toEqual({
      success: false,
      error: "Série introuvable",
    })
    const [row] = await db
      .select({ id: trainingSessions.id })
      .from(trainingSessions)
      .where(eq(trainingSessions.id, sid))
    expect(row?.id).toBe(sid)
  })
})

describe("anti-triche : correction training masquée pendant un examen ouvert", () => {
  const DAY = 24 * 60 * 60 * 1000
  const STUDENT2_ID = createId()
  const completedSid = createId()
  const tutorSid = createId()
  // q0 : examen OUVERT (participation) → masqué. q1 : examen CLOS → servi.
  // q2 : hors examen → servi.

  const asStudent2 = () =>
    vi.mocked(getCurrentSession).mockResolvedValue({
      user: { id: STUDENT2_ID, role: "user" },
    } as never)

  const seedExam = async (endDate: Date, questionId: string) => {
    const examId = createId()
    await db.insert(exams).values({
      id: examId,
      title: "Examen verrou",
      startDate: new Date(Date.now() - DAY),
      endDate,
      completionTime: 3600,
      createdBy: STUDENT2_ID,
      targetQuestionCount: 10,
      finalizedAt: new Date(),
    })
    await db.insert(examQuestions).values({ examId, questionId, position: 0 })
    await db.insert(examParticipations).values({
      id: createId(),
      examId,
      userId: STUDENT2_ID,
      status: "in_progress",
      startedAt: new Date(),
    })
  }

  const seedSession = async (o: {
    id: string
    mode: "tutor" | "test"
    status: "in_progress" | "completed"
    questionIds: string[]
  }) => {
    const now = Date.now()
    await db.insert(trainingSessions).values({
      id: o.id,
      userId: STUDENT2_ID,
      status: o.status,
      mode: o.mode,
      questionCount: o.questionIds.length,
      startedAt: new Date(now - 3600_000),
      completedAt: o.status === "completed" ? new Date(now - 1000) : null,
      expiresAt: new Date(now + DAY),
      score: o.status === "completed" ? 100 : null,
    })
    await db.insert(trainingSessionItems).values(
      o.questionIds.map((questionId, position) => ({
        id: createId(),
        sessionId: o.id,
        questionId,
        position,
        selectedAnswer: "A",
        isCorrect: true,
      })),
    )
  }

  beforeAll(async () => {
    await db.insert(user).values({
      id: STUDENT2_ID,
      name: "IT training lock",
      email: "training-lock@test.invalid",
    })
    // saveTrainingAnswer exige un accès training pour un non-admin.
    await seedAccess(STUDENT2_ID, "training", new Date(Date.now() + 30 * DAY))
    await seedExam(new Date(Date.now() + DAY), qIds[0])
    await seedExam(new Date(Date.now() - DAY), qIds[1])
    await seedSession({
      id: completedSid,
      mode: "test",
      status: "completed",
      questionIds: [qIds[0], qIds[1], qIds[2]],
    })
    await seedSession({
      id: tutorSid,
      mode: "tutor",
      status: "in_progress",
      questionIds: [qIds[0], qIds[2]],
    })
  })

  const byId = <T extends { _id: string }>(qs: T[], id: string) =>
    qs.find((q) => q._id === id)

  it("getTrainingSessionResults : la question d'un examen ouvert est masquée, les autres servies", async () => {
    asStudent2()
    const r = await getTrainingSessionResults(completedSid)
    expect(r && !("error" in r)).toBe(true)
    if (!r || "error" in r) return

    const locked = byId(r.questions, qIds[0])
    expect(locked?.correctAnswer).toBeUndefined()
    expect(locked?.explanation).toBeUndefined()
    expect(locked?.references).toBeUndefined()

    expect(byId(r.questions, qIds[1])?.correctAnswer).toBe("A")
    expect(byId(r.questions, qIds[2])?.explanation).toContain("Explication")

    // isCorrect + selectedAnswer révèle la clé : masqué pour la question
    // verrouillée, servi pour les autres.
    expect(r.answers[qIds[0]]?.selectedAnswer).toBe("A")
    expect(r.answers[qIds[0]]?.isCorrect).toBeUndefined()
    expect(r.answers[qIds[1]]?.isCorrect).toBe(true)
  })

  it("getTrainingSessionById (complétée) : même masquage", async () => {
    asStudent2()
    const v = await getTrainingSessionById(completedSid)
    expect(v).not.toBeNull()
    if (!v) return

    expect(byId(v.questions, qIds[0])?.correctAnswer).toBeUndefined()
    expect(byId(v.questions, qIds[1])?.correctAnswer).toBe("A")
    expect(byId(v.questions, qIds[2])?.correctAnswer).toBe("A")

    expect(v.answers[qIds[0]]?.selectedAnswer).toBe("A")
    expect(v.answers[qIds[0]]?.isCorrect).toBeUndefined()
    expect(v.answers[qIds[1]]?.isCorrect).toBe(true)
  })

  it("getTrainingSessionById (tuteur, question répondue) : masquage malgré la révélation tuteur", async () => {
    asStudent2()
    const v = await getTrainingSessionById(tutorSid)
    expect(v).not.toBeNull()
    if (!v) return

    expect(byId(v.questions, qIds[0])?.correctAnswer).toBeUndefined()
    expect(byId(v.questions, qIds[0])?.explanation).toBeUndefined()
    expect(byId(v.questions, qIds[2])?.correctAnswer).toBe("A")

    expect(v.answers[qIds[0]]?.selectedAnswer).toBe("A")
    expect(v.answers[qIds[0]]?.isCorrect).toBeUndefined()
    expect(v.answers[qIds[2]]?.isCorrect).toBe(true)
  })

  it("saveTrainingAnswer (tuteur) : clé retenue, pas de correction pour une question d'un examen ouvert", async () => {
    asStudent2()
    const locked = await saveTrainingAnswer({
      sessionId: tutorSid,
      questionId: qIds[0],
      selectedAnswer: "A",
    })
    expect(locked).toEqual({ success: true, reveal: { keyWithheld: true } })

    const served = await saveTrainingAnswer({
      sessionId: tutorSid,
      questionId: qIds[2],
      selectedAnswer: "A",
    })
    expect(served).toMatchObject({
      success: true,
      isCorrect: true,
      reveal: { correctAnswer: "A" },
    })
  })
})
