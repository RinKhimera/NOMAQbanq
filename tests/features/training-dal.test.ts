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
    /** `offset()` reçus, dans l'ordre : la page demandée se lit là. */
    offsets: { current: [] as number[] },
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
      offset: (n: number) => {
        mocks.offsets.current.push(n)
        return chain
      },
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
  mocks.offsets.current = []
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

describe("session active", () => {
  it("remonte le mode et le nombre de réponses données", async () => {
    mocks.rows.current = {
      training_sessions: [
        sessionRow({ mode: "tutor", questionCount: 20, answeredCount: 12 }),
      ],
    }
    const active = await getActiveTrainingSession()
    expect(active?.session).toMatchObject({
      mode: "tutor",
      questionCount: 20,
      answeredCount: 12,
    })
    expect(active?.canResume).toBe(true)
  })

  it("une session dont le TTL est passé ne se reprend pas", async () => {
    mocks.rows.current = {
      training_sessions: [
        sessionRow({ expiresAt: new Date(Date.now() - 1), answeredCount: 0 }),
      ],
    }
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
    mocks.rows.current = { training_sessions: rows(2) }
    // Le compte et la page lisent la même table : le faux-db sert les lignes
    // aux deux ; seul le total est lu sur la première (`count` absent → 0).
    const page = await getTrainingHistory({ page: 3, pageSize: 10 })
    expect(page).toMatchObject({ page: 3, pageSize: 10 })
    expect(page.items).toHaveLength(2)
    expect(page.items[0]).toMatchObject({ id: "s0", mode: "tutor", score: 50 })
    expect(mocks.offsets.current).toEqual([20])
  })

  it.each([
    ["page nulle", 0, 1],
    ["page négative", -4, 1],
    ["page non entière", 2.7, 2],
    ["page infinie", Number.NaN, 1],
    ["au-delà de la borne", 10_000, 100],
  ])("une %s est ramenée dans les bornes", async (_, page, expected) => {
    mocks.rows.current = { training_sessions: [] }
    const res = await getTrainingHistory({ page })
    expect(res.page).toBe(expected)
    expect(mocks.offsets.current).toEqual([(expected - 1) * 10])
  })

  it("une taille de page hors bornes est ramenée entre 1 et 50", async () => {
    mocks.rows.current = { training_sessions: [] }
    expect((await getTrainingHistory({ pageSize: 500 })).pageSize).toBe(50)
    expect((await getTrainingHistory({ pageSize: 0 })).pageSize).toBe(1)
  })

  it("une session sans date de fin garde `completedAt` nul", async () => {
    mocks.rows.current = {
      training_sessions: [{ ...rows(1)[0], completedAt: null, score: null }],
    }
    const page = await getTrainingHistory()
    expect(page.items[0]).toMatchObject({ completedAt: null, score: null })
  })
})
