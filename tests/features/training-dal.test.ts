import { beforeEach, describe, expect, it, vi } from "vitest"
import { lockFor } from "@/features/questions/answer-key-lock"
import {
  getActiveTrainingSession,
  getAvailableDomains,
  getBookmarkedQuestionIds,
  getMyTrainingScoreHistory,
  getTrainingHistory,
  getTrainingSessionById,
  getTrainingSessionResults,
  getTrainingStats,
} from "@/features/training/dal"

// Couvre les DECISIONS de la DAL entrainement : gardes de session, propriete des
// sessions (IDOR), robustesse du curseur keyset et anti-triche de la forme-pont.
// La semantique SQL (pagination reelle, agregats) est verifiee sur une vraie base
// dans tests/integration/training*.test.ts.
const { mocks, fakeDb, table } = vi.hoisted(() => {
  const mocks = {
    rows: { current: {} as Record<string, unknown[]> },
    session: {
      current: { user: { id: "u1", role: "user" } } as {
        user: { id: string; role: string }
      } | null,
    },
    cdnUrl: vi.fn((p: string) => `https://cdn.test/${p}`),
    lockedIds: { current: new Set<string>() },
  }

  const table = (name: string) => ({ __table: name })

  const queryChain = (initialTable?: string) => {
    let target = initialTable
    const chain: Record<string, unknown> = {
      from: (t: { __table?: string }) => {
        target = t?.__table
        return chain
      },
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      groupBy: () => chain,
      orderBy: () => chain,
      offset: () => chain,
      limit: () => chain,
      then: (onOk: (v: unknown) => unknown, onErr: (e: unknown) => unknown) =>
        Promise.resolve(
          (target ? mocks.rows.current[target] : undefined) ?? [],
        ).then(onOk, onErr),
    }
    return chain
  }

  const fakeDb = {
    select: () => queryChain(),
    selectDistinct: () => queryChain(),
  }

  return { mocks, fakeDb, table }
})

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/db", () => ({ db: fakeDb }))
vi.mock("@/db/schema", () => ({
  questionBookmarks: table("question_bookmarks"),
  questionExplanations: table("question_explanations"),
  questionImages: table("question_images"),
  questions: table("questions"),
  trainingSessionItems: table("training_session_items"),
  trainingSessions: table("training_sessions"),
}))
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
// Seule la requête du verrou est doublée : le blanchiment testé est le vrai.
vi.mock("@/features/questions/answer-key-lock", async (orig) => {
  const actual =
    await orig<typeof import("@/features/questions/answer-key-lock")>()
  return {
    ...actual,
    lockFor: vi.fn(async () =>
      actual.AnswerKeyLock.fromIds(mocks.lockedIds.current),
    ),
  }
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
  mocks.rows.current = {}
  mocks.lockedIds.current = new Set()
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

describe("verrou de clé de réponse (examen ouvert)", () => {
  beforeEach(() => {
    mocks.lockedIds.current = new Set(["q1"])
    mocks.rows.current = {
      training_sessions: [sessionRow({ status: "completed", score: 50 })],
      training_session_items: [itemRow("q1"), itemRow("q2")],
    }
  })

  it("le verrou est évalué pour le lecteur de la session, sur les questions de la session", async () => {
    asAdmin()
    await getTrainingSessionById("s1")
    expect(vi.mocked(lockFor)).toHaveBeenCalledWith(
      { id: "adm", role: "admin" },
      ["q1", "q2"],
    )
  })

  it("getTrainingSessionById retient la correction d'une question verrouillée", async () => {
    const view = await getTrainingSessionById("s1")
    const [q1, q2] = view!.questions
    expect(q1).not.toHaveProperty("correctAnswer")
    expect(q1).not.toHaveProperty("explanation")
    expect(q1).toMatchObject({ keyWithheld: true })
    expect(q2).toMatchObject({ correctAnswer: "A", explanation: "Parce que." })
    expect(q2).not.toHaveProperty("keyWithheld")
    expect(view!.answers.q1).toEqual({ selectedAnswer: "A" })
    expect(view!.answers.q2).toEqual({ selectedAnswer: "A", isCorrect: true })
  })

  it("getTrainingSessionResults retient la correction d'une question verrouillée", async () => {
    const view = await getTrainingSessionResults("s1")
    if (!view || "error" in view) throw new Error("vue attendue")
    const [q1, q2] = view.questions
    expect(q1).not.toHaveProperty("correctAnswer")
    expect(q1).not.toHaveProperty("explanationImages")
    expect(q1).toMatchObject({ keyWithheld: true })
    expect(q2).toMatchObject({ correctAnswer: "A", explanationImages: [] })
    expect(view.answers.q1).toEqual({ selectedAnswer: "A" })
    expect(view.answers.q2).toEqual({ selectedAnswer: "A", isCorrect: true })
  })
})

describe("gardes de session", () => {
  it("chaque lecture rend sa valeur vide sans session", async () => {
    anonymous()
    expect(await getActiveTrainingSession()).toBeNull()
    expect(await getTrainingSessionById("s1")).toBeNull()
    expect(await getTrainingSessionResults("s1")).toBeNull()
    expect(await getTrainingStats()).toBeNull()
    expect(await getMyTrainingScoreHistory()).toEqual({
      sessions: [],
      domainPerformance: [],
    })
    expect(await getBookmarkedQuestionIds(["q1"])).toEqual([])
    expect(await getTrainingHistory()).toEqual({
      items: [],
      nextCursor: null,
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
    spy.mockRestore()
  })
})

describe("propriete des sessions (IDOR)", () => {
  beforeEach(() => {
    mocks.rows.current = {
      training_sessions: [sessionRow({ userId: "autre" })],
      training_session_items: [],
    }
  })

  it("getTrainingSessionById refuse la session d'un tiers", async () => {
    asUser("u1")
    expect(await getTrainingSessionById("s1")).toBeNull()
  })

  it("getTrainingSessionById laisse passer l'admin", async () => {
    asAdmin()
    expect(await getTrainingSessionById("s1")).not.toBeNull()
  })

  it("getTrainingSessionResults refuse la session d'un tiers", async () => {
    asUser("u1")
    expect(await getTrainingSessionResults("s1")).toBeNull()
  })

  it("renvoie null quand la session n'existe pas", async () => {
    mocks.rows.current = { training_sessions: [] }
    expect(await getTrainingSessionById("inconnue")).toBeNull()
    expect(await getTrainingSessionResults("inconnue")).toBeNull()
  })

  it("getTrainingSessionResults refuse une session non terminee", async () => {
    mocks.rows.current = {
      training_sessions: [sessionRow({ status: "in_progress" })],
    }
    expect(await getTrainingSessionResults("s1")).toEqual({
      error: "SESSION_NOT_COMPLETED",
    })
  })
})

describe("curseur keyset — entree arbitraire", () => {
  const encode = (s: string) => Buffer.from(s, "utf8").toString("base64")

  beforeEach(() => {
    mocks.rows.current = { training_sessions: [] }
  })

  it.each([
    ["sans separateur", encode("pas-de-separateur")],
    ["date invalide", encode("pas-une-date|s1")],
    ["identifiant vide", encode(`${new Date().toISOString()}|`)],
    ["base64 arbitraire", "@@@ pas du base64 @@@"],
  ])("un curseur %s est traite comme une premiere page", async (_, cursor) => {
    await expect(getTrainingHistory({ cursor })).resolves.toEqual({
      items: [],
      nextCursor: null,
    })
  })

  it("rend un curseur seulement quand une page suivante existe", async () => {
    const completedAt = new Date("2026-01-01T00:00:00.000Z")
    mocks.rows.current = {
      training_sessions: Array.from({ length: 3 }, (_, i) => ({
        id: `s${i}`,
        questionCount: 2,
        score: 50,
        domain: "CARDIO",
        completedAt,
        startedAt: completedAt,
      })),
    }
    const page = await getTrainingHistory({ limit: 2 })
    expect(page.items).toHaveLength(2)
    expect(page.nextCursor).not.toBeNull()

    const last = await getTrainingHistory({ limit: 5 })
    expect(last.nextCursor).toBeNull()
  })

  it("une session sans date de fin ne produit pas de curseur", async () => {
    mocks.rows.current = {
      training_sessions: Array.from({ length: 2 }, (_, i) => ({
        id: `s${i}`,
        questionCount: 2,
        score: null,
        domain: null,
        completedAt: null,
        startedAt: new Date(),
      })),
    }
    const page = await getTrainingHistory({ limit: 1 })
    expect(page.nextCursor).toBeNull()
    expect(page.items[0]).toMatchObject({ completedAt: null })
  })
})
