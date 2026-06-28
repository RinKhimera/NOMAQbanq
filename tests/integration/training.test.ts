import { eq, inArray } from "drizzle-orm"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { db } from "@/db"
import {
  questionExplanations,
  questionImages,
  questions,
  trainingSessions,
  user,
} from "@/db/schema"
import {
  abandonTrainingSession,
  completeTrainingSession,
  createTrainingSession,
  deleteTrainingSession,
  saveTrainingAnswer,
} from "@/features/training/actions"
import {
  getActiveTrainingSession,
  getAvailableDomains,
  getAvailableObjectifsCMC,
  getMyTrainingScoreHistory,
  getTrainingHistory,
  getTrainingSessionById,
  getTrainingSessionResults,
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

const suffix = createId().slice(0, 8)
const USER_ID = createId()
const DOMAIN = `TRAIN-${suffix}`
const OBJ = `Obj ${suffix}`
const qIds = Array.from({ length: 8 }, () => createId())

const asAdmin = () =>
  vi.mocked(getCurrentSession).mockResolvedValue({
    user: { id: USER_ID, role: "admin" },
  } as never)

let activeSessionId: string
let sessionQuestionIds: string[] = []

beforeAll(async () => {
  await db.insert(user).values({
    id: USER_ID,
    name: "IT training",
    email: `training-${suffix}@test.invalid`,
  })
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `Q ${i} ${suffix} ?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: OBJ,
      domain: DOMAIN,
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
})

beforeEach(() => {
  asAdmin()
})

afterAll(async () => {
  await db.delete(trainingSessions).where(eq(trainingSessions.userId, USER_ID))
  await db
    .delete(questionImages)
    .where(inArray(questionImages.questionId, qIds))
  await db
    .delete(questionExplanations)
    .where(inArray(questionExplanations.questionId, qIds))
  await db.delete(questions).where(inArray(questions.id, qIds))
  await db.delete(user).where(eq(user.id, USER_ID))
})

describe("parcours complet (création → réponses → fin → résultats)", () => {
  it("createTrainingSession : crée la session + 5 items", async () => {
    const res = await createTrainingSession({
      questionCount: 5,
      domain: DOMAIN,
      mode: "test",
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    activeSessionId = res.sessionId

    const view = await getTrainingSessionById(activeSessionId)
    expect(view?.session.status).toBe("in_progress")
    expect(view?.questions).toHaveLength(5)
    sessionQuestionIds = view!.questions.map((q) => q._id)
  })

  it("getActiveTrainingSession : renvoie la session reprenable", async () => {
    const active = await getActiveTrainingSession()
    expect(active?.session.id).toBe(activeSessionId)
    expect(active?.canResume).toBe(true)
    expect(active?.session.questionCount).toBe(5)
  })

  it("getTrainingSessionById : correctAnswer masqué en cours", async () => {
    const view = await getTrainingSessionById(activeSessionId)
    expect(view?.questions[0]).not.toHaveProperty("correctAnswer")
    expect(view?.answers).toEqual({})
  })

  it("saveTrainingAnswer : calcule isCorrect", async () => {
    const ok = await saveTrainingAnswer({
      sessionId: activeSessionId,
      questionId: sessionQuestionIds[0],
      selectedAnswer: "A",
    })
    expect(ok).toEqual({ success: true, isCorrect: true })

    const ko = await saveTrainingAnswer({
      sessionId: activeSessionId,
      questionId: sessionQuestionIds[1],
      selectedAnswer: "B",
    })
    expect(ko).toEqual({ success: true, isCorrect: false })

    const view = await getTrainingSessionById(activeSessionId)
    expect(Object.keys(view!.answers)).toHaveLength(2)
    // Mode test in_progress : isCorrect masqué dans answers (anti-triche)
    expect(view?.answers[sessionQuestionIds[0]]).toEqual({
      selectedAnswer: "A",
    })
  })

  it("saveTrainingAnswer : refuse une question hors session", async () => {
    const res = await saveTrainingAnswer({
      sessionId: activeSessionId,
      questionId: createId(),
      selectedAnswer: "A",
    })
    expect(res.success).toBe(false)
  })

  it("completeTrainingSession : score = % bonnes réponses", async () => {
    const res = await completeTrainingSession({ sessionId: activeSessionId })
    expect(res).toMatchObject({
      success: true,
      correctCount: 1,
      totalQuestions: 5,
      score: 20,
    })
  })

  it("getTrainingSessionById : correctAnswer révélé après complétion", async () => {
    const view = await getTrainingSessionById(activeSessionId)
    expect(view?.session.status).toBe("completed")
    expect(view?.questions[0]).toHaveProperty("correctAnswer", "A")
  })

  it("getTrainingSessionResults : score + explication + réponses", async () => {
    const results = await getTrainingSessionResults(activeSessionId)
    expect(results && "session" in results).toBe(true)
    if (!results || "error" in results) return
    expect(results.session.score).toBe(20)
    const q0 = results.questions.find((q) => q._id === sessionQuestionIds[0])
    expect(q0?.correctAnswer).toBe("A")
    expect(q0?.explanation).toContain("Explication")
    expect(results.answers[sessionQuestionIds[0]]?.isCorrect).toBe(true)
  })

  it("getTrainingHistory + getTrainingStats : reflètent la session complétée", async () => {
    const history = await getTrainingHistory({ limit: 10 })
    expect(history.items.some((s) => s.id === activeSessionId)).toBe(true)

    const stats = await getTrainingStats()
    expect(stats?.totalSessions).toBeGreaterThanOrEqual(1)
    expect(stats?.averageScore).toBe(20)
  })
})

describe("gardes", () => {
  it("refuse une 2e session si une est déjà en cours", async () => {
    const s2 = await createTrainingSession({ questionCount: 5, mode: "test" })
    expect(s2.success).toBe(true)

    const s3 = await createTrainingSession({ questionCount: 5, mode: "test" })
    expect(s3.success).toBe(false)

    if (s2.success) {
      const abandon = await abandonTrainingSession({ sessionId: s2.sessionId })
      expect(abandon.success).toBe(true)
    }
  })

  it("supprime une session terminée (items en cascade)", async () => {
    const res = await deleteTrainingSession({ sessionId: activeSessionId })
    expect(res.success).toBe(true)
    expect(await getTrainingSessionResults(activeSessionId)).toBeNull()
  })

  it("refuse si pas assez de questions disponibles", async () => {
    const res = await createTrainingSession({
      questionCount: 20,
      domain: DOMAIN,
      mode: "test",
    })
    expect(res.success).toBe(false)
  })

  it("filtre objectif CMC inexistant → 0 disponible", async () => {
    const res = await createTrainingSession({
      questionCount: 5,
      objectifsCMCs: [`ghost-${suffix}`],
      mode: "test",
    })
    expect(res.success).toBe(false)
  })

  it("refuse un utilisateur sans accès training (non-admin)", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      user: { id: `ghost-${suffix}`, role: "user" },
    } as never)
    const res = await createTrainingSession({ questionCount: 5, mode: "test" })
    expect(res.success).toBe(false)
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

describe("getMyTrainingScoreHistory (graphique dashboard)", () => {
  const DASH_DOM = `DASHTRAIN-${suffix}`
  const ts1 = createId()
  const ts2 = createId()
  const ts3 = createId()

  beforeAll(async () => {
    const now = Date.now()
    const at = (days: number) => new Date(now - days * 24 * 3600_000)
    await db.insert(trainingSessions).values([
      {
        id: ts1,
        userId: USER_ID,
        status: "completed",
        domain: DASH_DOM,
        questionCount: 5,
        score: 60,
        startedAt: at(10),
        completedAt: at(10),
        expiresAt: new Date(now),
      },
      {
        id: ts2,
        userId: USER_ID,
        status: "completed",
        domain: DASH_DOM,
        questionCount: 5,
        score: 90,
        startedAt: at(9),
        completedAt: at(9),
        expiresAt: new Date(now),
      },
      {
        id: ts3,
        userId: USER_ID,
        status: "completed",
        domain: null, // → « Tous domaines »
        questionCount: 5,
        score: 30,
        startedAt: at(8),
        completedAt: at(8),
        expiresAt: new Date(now),
      },
    ])
  })

  it("sessions en ordre chronologique ASC + domaine null → « Tous domaines »", async () => {
    asAdmin()
    const { sessions } = await getMyTrainingScoreHistory()
    const i1 = sessions.findIndex((s) => s.sessionId === ts1)
    const i2 = sessions.findIndex((s) => s.sessionId === ts2)
    const i3 = sessions.findIndex((s) => s.sessionId === ts3)
    expect(i1).toBeGreaterThanOrEqual(0)
    expect(i1).toBeLessThan(i2)
    expect(i2).toBeLessThan(i3)
    expect(sessions[i3]).toMatchObject({ domain: "Tous domaines", score: 30 })
  })

  it("domainPerformance : score moyen par domaine", async () => {
    asAdmin()
    const { domainPerformance } = await getMyTrainingScoreHistory()
    const mine = domainPerformance.find((d) => d.domain === DASH_DOM)
    expect(mine).toMatchObject({ averageScore: 75, sessionCount: 2 }) // round((60+90)/2)
  })
})

describe("IDOR / propriété", () => {
  it("un autre utilisateur ne peut ni lire ni répondre à la session d'autrui", async () => {
    // Session créée par USER_ID (admin via beforeEach).
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
      user: { id: `intruder-${suffix}`, role: "user" },
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
})
