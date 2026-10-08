import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  getExamAnswersForParticipation,
  getExamQuestionExplanations,
  getExamSession,
  getExamWithQuestions,
  getParticipantExamResults,
} from "@/features/exams/dal.student"
import { fakeDb, resetFakeDrizzle, setRows } from "../helpers/fake-drizzle"

// Couvre les DECISIONS de la DAL etudiant : gardes de session, frontiere
// admin/proprietaire, et la fenetre anti-fuite des resultats. La semantique SQL
// (audience, agregats) reste verifiee sur une vraie base dans
// tests/integration/exam-audience.test.ts et exams.test.ts.
const { mocks } = vi.hoisted(() => ({
  mocks: {
    session: {
      current: { user: { id: "u1", role: "user" } } as {
        user: { id: string; role: string }
      } | null,
    },
    hasAccess: vi.fn(async () => true),
    fetchImages: vi.fn(async () => new Map<string, unknown[]>()),
    lockedIds: { current: new Set<string>() },
    countQuestionsByExam: vi.fn(async () => new Map<string, number>()),
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
  }
})
vi.mock("@/lib/dal", () => ({
  getCurrentSession: vi.fn(async () => mocks.session.current),
}))
vi.mock("@/features/payments/dal", () => ({ hasAccess: mocks.hasAccess }))
vi.mock("@/features/exams/dal.shared", async (orig) => ({
  ...(await orig<typeof import("@/features/exams/dal.shared")>()),
  countQuestionsByExam: mocks.countQuestionsByExam,
}))
// Seule la lecture des images est doublée : le mappeur testé est le vrai.
vi.mock("@/features/questions/quiz-bridge", async (orig) => {
  const actual = await orig<typeof import("@/features/questions/quiz-bridge")>()
  return { ...actual, fetchImages: mocks.fetchImages }
})
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
  resetFakeDrizzle()
  mocks.lockedIds.current = new Set()
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
})

describe("getExamSession", () => {
  it("isPaused est faux et les dates nulles restent nulles", async () => {
    setRows({
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
    })
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

  it("renvoie null si l'examen n'existe pas", async () => {
    setRows({ exams: [] })
    expect(await getParticipantExamResults("e1", "u1")).toBeNull()
  })

  // Participation terminee : sans elle, la fonction rendrait `null` faute de
  // participation et les cas d'acces ci-dessous ne prouveraient rien.
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

  it("rend ses propres resultats une fois l'examen termine", async () => {
    asUser("u1")
    setRows({
      exams: [closedExam],
      user: [{ id: "u1", name: "Etu", email: "e@x.test", image: null }],
      exam_participations: completedParticipation,
    })
    expect(await getParticipantExamResults("e1", "u1")).not.toBeNull()
  })

  // Jumeaux : même participation terminée, seul l'accès change. Le score reste
  // lisible dans la liste ; la correction est le service payant.
  it("sans accès Examens, la correction d'un examen `subscribers` est refusée", async () => {
    asUser("u1")
    mocks.hasAccess.mockResolvedValue(false)
    setRows({
      exams: [{ ...closedExam, audienceType: "subscribers" }],
      user: [{ id: "u1", name: "Etu", email: "e@x.test", image: null }],
      exam_participations: completedParticipation,
    })
    expect(await getParticipantExamResults("e1", "u1")).toMatchObject({
      error: "ACCESS_REQUIRED",
    })
  })

  it("sans accès Examens, un examen sur invitation reste corrigé (l'audience vaut accès)", async () => {
    asUser("u1")
    mocks.hasAccess.mockResolvedValue(false)
    setRows({
      exams: [{ ...closedExam, audienceType: "restricted" }],
      user: [{ id: "u1", name: "Etu", email: "e@x.test", image: null }],
      exam_participations: completedParticipation,
      exam_questions: [],
      exam_answers: [],
    })
    const view = await getParticipantExamResults("e1", "u1")
    expect(view).not.toBeNull()
    expect(view && "error" in view).toBe(false)
  })

  it("distingue l'utilisateur introuvable du participant qui n'a pas commence", async () => {
    asAdmin()
    setRows({ exams: [closedExam], user: [] })
    expect(await getParticipantExamResults("e1", "disparu")).toMatchObject({
      error: "NO_PARTICIPATION",
      message: "Utilisateur introuvable",
      participantUser: null,
    })

    setRows({
      exams: [closedExam],
      user: [{ id: "u1", name: "Etu", email: "e@x.test", image: null }],
    })
    expect(await getParticipantExamResults("e1", "u1")).toMatchObject({
      error: "NO_PARTICIPATION",
      message: "Ce participant n'a pas encore commencé cet examen",
    })
  })

  it("refuse a un non-admin dont la participation n'existe pas", async () => {
    asUser("u1")
    setRows({ exams: [closedExam], user: [] })
    expect(await getParticipantExamResults("e1", "u1")).toBeNull()
  })
})

describe("getExamQuestionExplanations", () => {
  it("renvoie [] sur une liste vide sans interroger la base", async () => {
    const spy = vi.spyOn(fakeDb, "selectDistinct")
    expect(await getExamQuestionExplanations([])).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  it("sert directement les explications demandees a un admin", async () => {
    asAdmin()
    setRows({
      question_explanations: [
        { questionId: "q1", explanation: "parce que", references: [] },
      ],
    })
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
    mocks.lockedIds.current = new Set(["q1"])
    setRows({
      exam_questions: [{ questionId: "q1" }],
      training_session_items: [],
      question_explanations: [
        { questionId: "q1", explanation: "verrouillee", references: [] },
      ],
    })
    expect(await getExamQuestionExplanations(["q1"])).toEqual([])
  })
})

describe("getExamWithQuestions — clé de réponse", () => {
  // Trois cas JUMEAUX sur la même ligne de question : seule la combinaison
  // (rôle, revealKey) change. Retirer `&& isAdmin` ou `opts?.revealKey` de la
  // garde fait rougir l'un d'eux.
  const exam = {
    id: "e1",
    title: "E",
    description: null,
    startDate: new Date(Date.now() - HOUR),
    endDate: new Date(Date.now() + HOUR),
    completionTime: 60,
    finalizedAt: new Date(Date.now() - 2 * HOUR),
    isActive: true,
    enablePause: false,
    pauseDurationMinutes: null,
    audienceType: "subscribers",
  }
  const item = {
    questionId: "q1",
    question: "?",
    options: ["A", "B"],
    correctAnswer: "A",
    objectifCMC: "Obj",
    domain: "Cardio",
  }

  it("étudiant avec revealKey : jamais la clé", async () => {
    asUser()
    setRows({ exams: [exam], exam_questions: [item] })
    const view = await getExamWithQuestions("e1", { revealKey: true })
    expect(view?.questions[0]).not.toHaveProperty("correctAnswer")
  })

  it("admin sans revealKey : pas la clé non plus", async () => {
    asAdmin()
    setRows({ exams: [exam], exam_questions: [item] })
    const view = await getExamWithQuestions("e1")
    expect(view?.questions[0]).not.toHaveProperty("correctAnswer")
  })

  it("admin avec revealKey : la clé, sans explication", async () => {
    asAdmin()
    setRows({ exams: [exam], exam_questions: [item] })
    const view = await getExamWithQuestions("e1", { revealKey: true })
    expect(view?.questions[0]).toMatchObject({ correctAnswer: "A" })
    expect(view?.questions[0]).not.toHaveProperty("explanation")
  })
})
