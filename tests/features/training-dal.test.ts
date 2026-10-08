import { beforeEach, describe, expect, it, vi } from "vitest"
import { lockFor } from "@/features/questions/answer-key-lock"
import {
  getActiveTrainingSession,
  getAvailableDomains,
  getBookmarkedQuestionIds,
  getTrainingHistory,
  getTrainingSessionById,
  getTrainingSessionResults,
} from "@/features/training/dal"
import {
  fakeDb,
  resetFakeDrizzle,
  setRows,
  state,
} from "../helpers/fake-drizzle"

// Couvre les DECISIONS de la DAL entrainement : gardes de session, propriete des
// sessions (IDOR), bornes de la pagination et role transmis au verrou de cle.
// La semantique SQL (pagination reelle, agregats, masquage par le verrou) est
// verifiee sur une vraie base dans tests/integration/training*.test.ts.
const { mocks } = vi.hoisted(() => ({
  mocks: {
    session: {
      current: { user: { id: "u1", role: "user" } } as {
        user: { id: string; role: string }
      } | null,
    },
    cdnUrl: vi.fn((p: string) => `https://cdn.test/${p}`),
  },
}))

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/db", async () => ({
  db: (await import("../helpers/fake-drizzle")).fakeDb,
}))
vi.mock("@/db/schema", async () => {
  const { table } = await import("../helpers/fake-drizzle")
  return {
    questionBookmarks: table("question_bookmarks"),
    questionExplanations: table("question_explanations"),
    questionImages: table("question_images"),
    questions: table("questions"),
    trainingSessionItems: table("training_session_items"),
    trainingSessions: table("training_sessions"),
  }
})
vi.mock("@/lib/dal", () => ({
  getCurrentSession: vi.fn(async () => mocks.session.current),
}))
// Fidele au vrai garde : `requireSession` REDIRIGE (donc leve) sans session, il
// ne rend jamais de valeur vide (lib/auth-guards.ts:8).
vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(async () => {
    if (!mocks.session.current) throw new Error("NEXT_REDIRECT /connexion")
    return mocks.session.current
  }),
}))
vi.mock("@/lib/cdn", () => ({ cdnUrl: mocks.cdnUrl }))
vi.mock("@/features/questions/answer-key-lock", async (orig) => {
  const actual =
    await orig<typeof import("@/features/questions/answer-key-lock")>()
  return { ...actual, lockFor: vi.fn(async () => actual.AnswerKeyLock.none()) }
})

const anonymous = () => {
  mocks.session.current = null
}
const asUser = (id = "u1") => {
  mocks.session.current = { user: { id, role: "user" } }
}
const asAdmin = () => {
  mocks.session.current = { user: { id: "adm", role: "admin" } }
}

const sessionRow = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  userId: "u1",
  questionCount: 2,
  status: "in_progress",
  mode: "practice",
  domain: "CARDIO",
  startedAt: new Date(),
  completedAt: null,
  expiresAt: new Date(Date.now() + 3600_000),
  score: null,
  ...over,
})

beforeEach(() => {
  resetFakeDrizzle()
  asUser()
})

const itemRow = (questionId: string, over: Record<string, unknown> = {}) => ({
  questionId,
  selectedAnswer: "A",
  isCorrect: true,
  qCreatedAt: new Date(),
  question: `Q ${questionId}`,
  options: ["A", "B"],
  correctAnswer: "A",
  objectifCMC: "Obj",
  domain: "CARDIO",
  explanation: "Parce que.",
  references: ["Ref"],
  ...over,
})

describe("verrou de clé de réponse", () => {
  it("le verrou est évalué pour le lecteur de la session, sur les questions de la session", async () => {
    setRows({
      training_sessions: [sessionRow({ status: "completed", score: 50 })],
      training_session_items: [itemRow("q1"), itemRow("q2")],
    })
    asAdmin()
    await getTrainingSessionById("s1")
    expect(vi.mocked(lockFor)).toHaveBeenCalledWith(
      { id: "adm", role: "admin" },
      ["q1", "q2"],
    )
  })
})

describe("session active", () => {
  it("remonte le mode et le nombre de réponses données", async () => {
    setRows({
      training_sessions: [
        sessionRow({ mode: "tutor", questionCount: 20, answeredCount: 12 }),
      ],
    })
    const active = await getActiveTrainingSession()
    expect(active?.session).toMatchObject({
      mode: "tutor",
      questionCount: 20,
      answeredCount: 12,
    })
    expect(active?.canResume).toBe(true)
  })

  it("une session dont le TTL est passé ne se reprend pas", async () => {
    setRows({
      training_sessions: [
        sessionRow({ expiresAt: new Date(Date.now() - 1), answeredCount: 0 }),
      ],
    })
    const active = await getActiveTrainingSession()
    expect(active).toMatchObject({
      isExpired: true,
      canResume: false,
      remainingTimeMs: 0,
    })
  })
})

describe("gardes de session", () => {
  it("chaque lecture rend sa valeur vide sans session", async () => {
    anonymous()
    expect(await getActiveTrainingSession()).toBeNull()
    expect(await getTrainingSessionById("s1")).toBeNull()
    expect(await getTrainingSessionResults("s1")).toBeNull()
    expect(await getBookmarkedQuestionIds(["q1"])).toEqual([])
    expect(await getTrainingHistory()).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    })
  })

  it("getAvailableDomains redirige au lieu de rendre une vue vide", async () => {
    anonymous()
    // Contrat different des lectures ci-dessus : cette DAL passe par
    // `requireSession`, qui redirige vers /connexion — aucune valeur n'est rendue.
    await expect(getAvailableDomains()).rejects.toThrow("NEXT_REDIRECT")
  })

  it("getBookmarkedQuestionIds court-circuite sur une liste vide", async () => {
    const spy = vi.spyOn(fakeDb, "select")
    expect(await getBookmarkedQuestionIds([])).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })
})

describe("propriete des sessions (IDOR)", () => {
  it("getTrainingSessionById laisse passer l'admin sur la session d'un tiers", async () => {
    setRows({
      training_sessions: [sessionRow({ userId: "autre" })],
      training_session_items: [],
    })
    asAdmin()
    expect(await getTrainingSessionById("s1")).not.toBeNull()
  })

  it("renvoie null quand la session n'existe pas", async () => {
    setRows({ training_sessions: [] })
    expect(await getTrainingSessionById("inconnue")).toBeNull()
    expect(await getTrainingSessionResults("inconnue")).toBeNull()
  })

  it("getTrainingSessionResults refuse une session non terminee", async () => {
    setRows({ training_sessions: [sessionRow({ status: "in_progress" })] })
    expect(await getTrainingSessionResults("s1")).toEqual({
      error: "SESSION_NOT_COMPLETED",
    })
  })
})

describe("historique paginé", () => {
  const completedAt = new Date("2026-01-01T00:00:00.000Z")
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `s${i}`,
      questionCount: 2,
      score: 50,
      domain: "CARDIO",
      mode: "tutor",
      completedAt,
      startedAt: completedAt,
    }))

  it("rend la page demandée avec le total, le mode et le score de chaque ligne", async () => {
    setRows({ training_sessions: rows(2) })
    // Le compte et la page lisent la même table : le faux-db sert les lignes
    // aux deux ; seul le total est lu sur la première (`count` absent → 0).
    const page = await getTrainingHistory({ page: 3, pageSize: 10 })
    expect(page).toMatchObject({ page: 3, pageSize: 10 })
    expect(page.items).toHaveLength(2)
    expect(page.items[0]).toMatchObject({ id: "s0", mode: "tutor", score: 50 })
    expect(state.offsets).toEqual([20])
  })

  it.each([
    ["page nulle", 0, 1],
    ["page négative", -4, 1],
    ["page non entière", 2.7, 2],
    ["page infinie", Number.NaN, 1],
    ["au-delà de la borne", 10_000, 100],
  ])("une %s est ramenée dans les bornes", async (_, page, expected) => {
    const res = await getTrainingHistory({ page })
    expect(res.page).toBe(expected)
    expect(state.offsets).toEqual([(expected - 1) * 10])
  })

  it("une taille de page hors bornes est ramenée entre 1 et 50", async () => {
    expect((await getTrainingHistory({ pageSize: 500 })).pageSize).toBe(50)
    expect((await getTrainingHistory({ pageSize: 0 })).pageSize).toBe(1)
  })

  it("une session sans date de fin garde `completedAt` nul", async () => {
    setRows({
      training_sessions: [{ ...rows(1)[0], completedAt: null, score: null }],
    })
    const page = await getTrainingHistory()
    expect(page.items[0]).toMatchObject({ completedAt: null, score: null })
  })
})
