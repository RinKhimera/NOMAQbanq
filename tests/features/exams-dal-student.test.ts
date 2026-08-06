import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  getExamAnswersForParticipation,
  getExamQuestionExplanations,
  getExamSession,
  getMyAvailableExams,
  getMyDashboardStats,
  getMyRecentExams,
  getMyScoreHistory,
  getParticipantExamResults,
} from "@/features/exams/dal.student"

// Couvre les DECISIONS de la DAL etudiant : gardes de session, frontiere
// admin/proprietaire, et la fenetre anti-fuite des resultats. La semantique SQL
// (audience, agregats) reste verifiee sur une vraie base dans
// tests/integration/exam-audience.test.ts et exams.test.ts.
//
// `vi.mock` etant hoiste, tout ce que ses fabriques utilisent vient de
// `vi.hoisted`. Les lignes sont indexees par table pour ne pas dependre de
// l'ORDRE des requetes.
const { mocks, fakeDb, table } = vi.hoisted(() => {
  const mocks = {
    rows: { current: {} as Record<string, unknown[]> },
    session: {
      current: { user: { id: "u1", role: "user" } } as {
        user: { id: string; role: string }
      } | null,
    },
    hasAccess: vi.fn(async () => true),
    fetchImages: vi.fn(async () => new Map<string, unknown[]>()),
    getOpenExamLockedQuestionIds: vi.fn(async () => new Set<string>()),
    countQuestionsByExam: vi.fn(async () => new Map<string, number>()),
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
      for: () => chain,
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
  examAnswers: table("exam_answers"),
  examAudience: table("exam_audience"),
  examParticipations: table("exam_participations"),
  examQuestions: table("exam_questions"),
  exams: table("exams"),
  questionExplanations: table("question_explanations"),
  questions: table("questions"),
  trainingSessionItems: table("training_session_items"),
  trainingSessions: table("training_sessions"),
  user: table("user"),
}))
vi.mock("@/lib/dal", () => ({
  getCurrentSession: vi.fn(async () => mocks.session.current),
}))
vi.mock("@/features/payments/dal", () => ({ hasAccess: mocks.hasAccess }))
vi.mock("@/features/exams/dal.shared", () => ({
  fetchImages: mocks.fetchImages,
  getOpenExamLockedQuestionIds: mocks.getOpenExamLockedQuestionIds,
  countQuestionsByExam: mocks.countQuestionsByExam,
}))

const HOUR = 3600_000
const anonymous = () => {
  mocks.session.current = null
}
const asUser = (id = "u1") => {
  mocks.session.current = { user: { id, role: "user" } }
}
const asAdmin = () => {
  mocks.session.current = { user: { id: "adm", role: "admin" } }
}

beforeEach(() => {
  mocks.rows.current = {}
  asUser()
  mocks.hasAccess.mockResolvedValue(true)
})

describe("gardes de session", () => {
  it("getExamSession renvoie null", async () => {
    anonymous()
    expect(await getExamSession("e1")).toBeNull()
  })

  it("getExamAnswersForParticipation renvoie []", async () => {
    anonymous()
    expect(await getExamAnswersForParticipation("e1")).toEqual([])
  })

  it("getParticipantExamResults renvoie null", async () => {
    anonymous()
    expect(await getParticipantExamResults("e1", "u1")).toBeNull()
  })

  it("getExamQuestionExplanations renvoie []", async () => {
    anonymous()
    expect(await getExamQuestionExplanations(["q1"])).toEqual([])
  })

  it("les vues du tableau de bord renvoient leur valeur vide", async () => {
    anonymous()
    expect(await getMyRecentExams()).toEqual([])
    expect(await getMyScoreHistory()).toEqual([])
    expect(await getMyAvailableExams()).toEqual([])
    expect(await getMyDashboardStats()).toBeNull()
  })
})

describe("getExamSession", () => {
  it("renvoie null quand l'utilisateur n'a pas de participation", async () => {
    mocks.rows.current = { exam_participations: [] }
    expect(await getExamSession("e1")).toBeNull()
  })

  it("derive isPaused de pauseStartedAt", async () => {
    const pausedAt = new Date()
    mocks.rows.current = {
      exam_participations: [
        {
          id: "p1",
          status: "in_progress",
          startedAt: new Date(),
          completedAt: null,
          score: null,
          pauseStartedAt: pausedAt,
          totalPauseDurationMs: 0,
        },
      ],
    }
    const s = await getExamSession("e1")
    expect(s?.isPaused).toBe(true)
    expect(s?.pauseStartedAt).toBe(pausedAt.getTime())
  })

  it("isPaused est faux et les dates nulles restent nulles", async () => {
    mocks.rows.current = {
      exam_participations: [
        {
          id: "p1",
          status: "completed",
          startedAt: null,
          completedAt: null,
          score: 80,
          pauseStartedAt: null,
          totalPauseDurationMs: 0,
        },
      ],
    }
    const s = await getExamSession("e1")
    expect(s).toMatchObject({
      isPaused: false,
      startedAt: null,
      completedAt: null,
      pauseStartedAt: null,
    })
  })
})

describe("getParticipantExamResults — frontiere d'acces", () => {
  const openExam = {
    id: "e1",
    title: "E",
    description: null,
    startDate: new Date(Date.now() - HOUR),
    endDate: new Date(Date.now() + HOUR),
    completionTime: 60,
  }
  const closedExam = { ...openExam, endDate: new Date(Date.now() - HOUR) }

  it("refuse a un tiers non admin (IDOR)", async () => {
    asUser("u1")
    mocks.rows.current = { exams: [closedExam] }
    expect(await getParticipantExamResults("e1", "autre")).toBeNull()
  })

  it("renvoie null si l'examen n'existe pas", async () => {
    mocks.rows.current = { exams: [] }
    expect(await getParticipantExamResults("e1", "u1")).toBeNull()
  })

  // Les deux cas suivants sont JUMEAUX : meme participation terminee, seule la
  // date de fin change. Ils ne prouvent la garde `!isAdmin && now < endDate`
  // (dal.student.ts:488) que parce qu'ils divergent — avec un examen clos, la
  // fonction rend bien un resultat. Sans participation dans le faux-db, les deux
  // tomberaient sur le `return null` de la ligne 548 et ne prouveraient rien.
  const completedParticipation = [
    {
      id: "p1",
      userId: "u1",
      status: "completed",
      score: 75,
      startedAt: new Date(),
      completedAt: new Date(),
    },
  ]

  it("cache ses propres resultats tant que l'examen n'est pas termine", async () => {
    asUser("u1")
    mocks.rows.current = {
      exams: [openExam],
      user: [{ id: "u1", name: "Etu", email: "e@x.test", image: null }],
      exam_participations: completedParticipation,
    }
    expect(await getParticipantExamResults("e1", "u1")).toBeNull()
  })

  it("rend les memes resultats des que l'examen est termine", async () => {
    asUser("u1")
    mocks.rows.current = {
      exams: [closedExam],
      user: [{ id: "u1", name: "Etu", email: "e@x.test", image: null }],
      exam_participations: completedParticipation,
    }
    expect(await getParticipantExamResults("e1", "u1")).not.toBeNull()
  })

  it("laisse l'admin voir les resultats d'un examen encore ouvert", async () => {
    asAdmin()
    mocks.rows.current = { exams: [openExam], user: [], exam_answers: [] }
    expect(await getParticipantExamResults("e1", "u1")).not.toBeNull()
  })

  it("distingue l'utilisateur introuvable du participant qui n'a pas commence", async () => {
    asAdmin()
    mocks.rows.current = { exams: [closedExam], user: [] }
    expect(await getParticipantExamResults("e1", "disparu")).toMatchObject({
      error: "NO_PARTICIPATION",
      message: "Utilisateur introuvable",
      participantUser: null,
    })

    mocks.rows.current = {
      exams: [closedExam],
      user: [{ id: "u1", name: "Etu", email: "e@x.test", image: null }],
    }
    expect(await getParticipantExamResults("e1", "u1")).toMatchObject({
      error: "NO_PARTICIPATION",
      message: "Ce participant n'a pas encore commencé cet examen",
    })
  })

  it("refuse a un non-admin dont la participation n'existe pas", async () => {
    asUser("u1")
    mocks.rows.current = { exams: [closedExam], user: [] }
    expect(await getParticipantExamResults("e1", "u1")).toBeNull()
  })
})

describe("getExamQuestionExplanations", () => {
  it("renvoie [] sur une liste vide sans interroger la base", async () => {
    const spy = vi.spyOn(fakeDb, "selectDistinct")
    expect(await getExamQuestionExplanations([])).toEqual([])
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it("sert directement les explications demandees a un admin", async () => {
    asAdmin()
    mocks.rows.current = {
      question_explanations: [
        { questionId: "q1", explanation: "parce que", references: [] },
      ],
    }
    const res = await getExamQuestionExplanations(["q1", "q1"])
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ questionId: "q1", explanation: "parce que" })
  })

  // Le filtre d'autorisation d'un etudiant vit dans le `inArray` du WHERE, donc
  // hors de portee du faux-db : il est verifie sur une vraie base
  // (tests/integration/exams.test.ts, « etudiant non autorise sur une question
  // temoin »). Ici on couvre ce qui se decide en JS.
  it("retire les questions verrouillees par un examen ouvert", async () => {
    asUser("u1")
    mocks.getOpenExamLockedQuestionIds.mockResolvedValueOnce(new Set(["q1"]))
    mocks.rows.current = {
      exam_questions: [{ questionId: "q1" }],
      training_session_items: [],
      question_explanations: [
        { questionId: "q1", explanation: "verrouillee", references: [] },
      ],
    }
    expect(await getExamQuestionExplanations(["q1"])).toEqual([])
  })
})

describe("acces payant du tableau de bord", () => {
  it("getMyRecentExams renvoie [] sans acces examen", async () => {
    mocks.hasAccess.mockResolvedValueOnce(false)
    expect(await getMyRecentExams()).toEqual([])
  })

  it("getMyRecentExams renvoie [] quand aucun examen actif", async () => {
    mocks.rows.current = { exams: [] }
    expect(await getMyRecentExams()).toEqual([])
  })
})
