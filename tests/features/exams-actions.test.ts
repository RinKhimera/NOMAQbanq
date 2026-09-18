import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type RefusalCode, refusalMessage } from "@/features/attempts/guard"
import {
  createExam,
  deactivateExam,
  deleteExam,
  deleteParticipation,
  finalizeExam,
  loadExamAudience,
  loadExamQuestionExplanations,
  loadSearchSelectableUsers,
  pauseExam,
  reactivateExam,
  resumeExam,
  saveExamAnswer,
  saveExamFlag,
  startExam,
  updateExam,
} from "@/features/exams/actions"
import {
  fakeTx,
  rejectWith,
  resetFakeDrizzle,
  setRows,
  state,
} from "../helpers/fake-drizzle"

// Couvre les decisions propres a `actions.ts` : gardes admin, validation zod,
// mapping des erreurs metier vers un message, et — pour la passation — ce que
// chaque action demande a la garde de tentative (`requireAttempt`, doublee ici ;
// sa politique est testee dans tests/attempts/guard.test.ts), le succes et le
// mapping des refus. Le SQL et la concurrence (verrous FOR UPDATE, cascades)
// sont verifies sur une vraie base dans tests/integration/exam-*.test.ts.
const { mocks } = vi.hoisted(() => ({
  mocks: {
    captureServerError: vi.fn(),
    revalidatePath: vi.fn(),
    session: {
      current: { user: { id: "u1", role: "user" } } as {
        user: { id: string; role: string }
      },
    },
    hasActiveAccess: vi.fn(async () => true),
    requireAttempt: vi.fn(),
    searchSelectableUsers: vi.fn(async () => []),
    getExamAudience: vi.fn(async () => []),
    getExamQuestionExplanations: vi.fn(async () => []),
  },
}))

vi.mock("@/db", async () => ({
  db: (await import("../helpers/fake-drizzle")).fakeDb,
}))
vi.mock("@/db/schema", async () => {
  const { table } = await import("../helpers/fake-drizzle")
  return {
    examAnswers: table("examAnswers"),
    examAudience: table("examAudience"),
    examParticipations: table("examParticipations"),
    examQuestions: table("examQuestions"),
    exams: table("exams"),
    questions: table("questions"),
    user: table("user"),
  }
})
vi.mock("@/features/attempts/guard", async (orig) => {
  const actual = await orig<typeof import("@/features/attempts/guard")>()
  return { ...actual, requireAttempt: mocks.requireAttempt }
})
vi.mock("@/features/payments/dal", () => ({
  hasActiveAccess: mocks.hasActiveAccess,
}))
vi.mock("@/features/users/dal", () => ({
  searchSelectableUsers: mocks.searchSelectableUsers,
}))
vi.mock("@/features/exams/dal", () => ({
  getExamAudience: mocks.getExamAudience,
  getExamQuestionExplanations: mocks.getExamQuestionExplanations,
}))
vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(async () => mocks.session.current),
  requireRole: vi.fn(async () => mocks.session.current),
}))
vi.mock("@/lib/observability", () => ({
  captureServerError: mocks.captureServerError,
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

const SERVER_ERROR = "Erreur serveur. Réessayez."
const NOW = 1_500

const examInput = {
  title: "Examen blanc",
  startDate: 1_000,
  endDate: 2_000,
  questionIds: ["q1", "q2"],
}

const ALL_REFUSALS: RefusalCode[] = [
  "NOT_FOUND",
  "NOT_IN_PROGRESS",
  "NOT_STARTED",
  "OUTSIDE_WINDOW",
  "ACCESS_EXPIRED",
  "PAUSED",
  "TIME_UP",
]

// Budget 100 s démarré à t = 0 ; aucune pause.
const openAttempt = (extra: Record<string, unknown> = {}) => ({
  ok: true as const,
  attempt: {
    kind: "exam" as const,
    id: "p1",
    timing: {
      startedAt: 0,
      budgetSeconds: 100,
      pauseCreditMs: 0,
      pauseInProgress: null,
    },
    exam: {
      enablePause: true,
      pauseDurationMinutes: 20,
      audienceType: "subscribers" as const,
    },
    ...extra,
  },
})

const refuse = (code: RefusalCode) =>
  mocks.requireAttempt.mockResolvedValueOnce({ ok: false, code })

beforeEach(() => {
  mocks.session.current = { user: { id: "u1", role: "user" } }
  mocks.requireAttempt.mockReset().mockResolvedValue(openAttempt())
  resetFakeDrizzle([{ id: "a1" }])
  // Seul `Date` est simule : les actions lisent `Date.now()`, aucune n'attend de
  // minuterie. Aucune option de config ne restaure les faux timers (restoreMocks
  // ne parcourt que le registre des espions) — d'ou l'afterEach explicite.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("lectures gardees", () => {
  it("loadExamQuestionExplanations : liste vide refusee par zod → []", async () => {
    const res = await loadExamQuestionExplanations([])
    expect(res).toEqual([])
    expect(mocks.getExamQuestionExplanations).not.toHaveBeenCalled()
  })

  it("loadExamQuestionExplanations : ids valides → delegue au DAL", async () => {
    await loadExamQuestionExplanations(["q1"])
    expect(mocks.getExamQuestionExplanations).toHaveBeenCalledWith(["q1"])
  })

  it("loadSearchSelectableUsers et loadExamAudience deleguent au DAL", async () => {
    await loadSearchSelectableUsers({ query: "ali" })
    await loadExamAudience("e1")
    expect(mocks.searchSelectableUsers).toHaveBeenCalledWith({ query: "ali" })
    expect(mocks.getExamAudience).toHaveBeenCalledWith("e1")
  })
})

describe("createExam", () => {
  it.each([
    [{ ...examInput, title: "  " }, "Le titre est requis"],
    [{ ...examInput, questionIds: [] }, "Au moins une question"],
    [
      { ...examInput, questionIds: ["q1", "q1"] },
      "Des questions sont sélectionnées en double",
    ],
    [
      { ...examInput, endDate: 500 },
      "La date de fin doit être postérieure à la date de début",
    ],
    [
      { ...examInput, audienceType: "restricted" as const },
      "Sélectionnez au moins un utilisateur",
    ],
  ])("refuse une entree invalide : %#", async (input, error) => {
    const res = await createExam(input)
    expect(res).toEqual({ success: false, error })
    expect(state.transaction).not.toHaveBeenCalled()
  })

  it("succes : renvoie l'id et revalide la liste", async () => {
    setRows({ questions: [{ n: 2 }] })
    const res = await createExam(examInput)
    expect(res).toMatchObject({ success: true })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/examens")
  })

  it.each([
    [
      "INVALID_QUESTIONS",
      "Certaines questions sélectionnées sont introuvables.",
    ],
    ["INVALID_USERS", "Certains utilisateurs sélectionnés sont introuvables."],
  ])("%s → %s, sans capture", async (thrown, error) => {
    rejectWith(thrown)
    const res = await createExam(examInput)
    expect(res).toEqual({ success: false, error })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("erreur inattendue → capture avec l'admin", async () => {
    rejectWith("connection terminated")
    const res = await createExam(examInput)
    expect(res).toEqual({ success: false, error: SERVER_ERROR })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[createExam]",
      expect.any(Error),
      { userId: "u1" },
    )
  })
})

describe("updateExam", () => {
  const input = { id: "e1", ...examInput }

  it("refuse un id vide sans ouvrir la transaction", async () => {
    const res = await updateExam({ ...input, id: "" })
    expect(res.success).toBe(false)
    expect(state.transaction).not.toHaveBeenCalled()
  })

  it("succes : revalide la liste et la fiche", async () => {
    setRows({ exams: [{ id: "e1" }], questions: [{ n: 2 }] })
    const res = await updateExam(input)
    expect(res).toEqual({ success: true })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/examens/e1")
  })

  it.each([
    ["NOT_FOUND", "Examen introuvable."],
    [
      "HAS_PARTICIPATIONS",
      "Cet examen a déjà des participations ; ses questions ne peuvent plus être modifiées.",
    ],
    [
      "INVALID_QUESTIONS",
      "Certaines questions sélectionnées sont introuvables.",
    ],
    ["INVALID_USERS", "Certains utilisateurs sélectionnés sont introuvables."],
  ])("%s → %s, sans capture", async (thrown, error) => {
    rejectWith(thrown)
    const res = await updateExam(input)
    expect(res).toEqual({ success: false, error })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("erreur inattendue → capture sans userId", async () => {
    rejectWith("deadlock detected")
    const res = await updateExam(input)
    expect(res).toEqual({ success: false, error: SERVER_ERROR })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[updateExam]",
      expect.any(Error),
    )
  })
})

describe("mutations admin simples", () => {
  it.each([
    ["deleteExam", deleteExam, "Examen requis"],
    ["deactivateExam", deactivateExam, "Examen requis"],
    ["reactivateExam", reactivateExam, "Examen requis"],
  ])("%s : id vide → refus", async (_name, action, error) => {
    const res = await action({ examId: "" })
    expect(res).toEqual({ success: false, error })
  })

  it("deleteParticipation : id vide → refus", async () => {
    const res = await deleteParticipation({ participationId: "" })
    expect(res).toEqual({ success: false, error: "Participation requise" })
  })

  it("deleteParticipation : introuvable → message metier, pas de capture", async () => {
    setRows({ examParticipations: [] })
    const res = await deleteParticipation({ participationId: "p1" })
    expect(res).toEqual({
      success: false,
      error: "Participation introuvable",
    })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("deleteParticipation : succes → revalide la fiche de l'examen", async () => {
    setRows({ examParticipations: [{ examId: "e1" }] })
    const res = await deleteParticipation({ participationId: "p1" })
    expect(res).toEqual({ success: true })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/examens/e1")
  })
})

describe("startExam", () => {
  it("id vide → refus avant transaction", async () => {
    const res = await startExam({ examId: "" })
    expect(res).toEqual({ success: false, error: "Examen requis" })
    expect(state.transaction).not.toHaveBeenCalled()
  })

  it.each([
    ["NOT_FOUND", "Examen introuvable."],
    ["OUTSIDE_WINDOW", "L'examen n'est pas disponible à cette période."],
    ["ALREADY_TAKEN", "Vous avez déjà passé cet examen."],
    ["NOT_IN_AUDIENCE", "Cet examen ne vous est pas destiné."],
    ["ACCESS_EXPIRED", "Votre accès aux examens a expiré."],
  ])("%s → %s, sans capture", async (thrown, error) => {
    rejectWith(thrown)
    const res = await startExam({ examId: "e1" })
    expect(res).toEqual({ success: false, error })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  // L'abonnement se lit par la transaction (`hasActiveAccess(tx, …)`), jamais
  // par `hasAccess` qui emprunterait une 2e connexion du pool.
  it("audience abonnés : l'abonnement se vérifie dans la transaction, à l'instant courant", async () => {
    mocks.hasActiveAccess.mockResolvedValueOnce(false)
    setRows({
      user: [{ id: "u1" }],
      exams: [
        {
          startDate: new Date(0),
          endDate: new Date(10_000),
          audienceType: "subscribers",
        },
      ],
    })
    const res = await startExam({ examId: "e1" })
    expect(res).toEqual({
      success: false,
      error: "Votre accès aux examens a expiré.",
    })
    expect(mocks.hasActiveAccess).toHaveBeenCalledWith(fakeTx, {
      userId: "u1",
      type: "exam",
      now: NOW,
    })
  })

  it("succes : renvoie la participation et son instant de démarrage", async () => {
    setRows({
      user: [{ id: "u1" }],
      exams: [
        {
          startDate: new Date(0),
          endDate: new Date(10_000),
          audienceType: "restricted",
        },
      ],
      examAudience: [{ userId: "u1" }],
      examParticipations: [],
      examQuestions: [{ questionId: "q1" }],
    })
    const res = await startExam({ examId: "e1" })
    expect(res).toMatchObject({ success: true, startedAt: NOW })
  })

  // Borne du glossaire (« examen ouvert » = date de fin non passée) : cas
  // jumeaux à 1 ms près, comme la garde answer/close.
  it.each([
    [
      NOW,
      {
        success: false,
        error: "L'examen n'est pas disponible à cette période.",
      },
    ],
    [NOW + 1, { success: true }],
  ])("fenêtre : endDate = %d → %o", async (endDate, expected) => {
    setRows({
      user: [{ id: "u1" }],
      exams: [
        {
          startDate: new Date(0),
          endDate: new Date(endDate),
          audienceType: "restricted",
        },
      ],
      examAudience: [{ userId: "u1" }],
      examParticipations: [],
      examQuestions: [],
    })
    expect(await startExam({ examId: "e1" })).toMatchObject(expected)
  })

  it("erreur inattendue → capture avec l'utilisateur", async () => {
    rejectWith("pool exhausted")
    const res = await startExam({ examId: "e1" })
    expect(res).toEqual({ success: false, error: SERVER_ERROR })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[startExam]",
      expect.any(Error),
      { userId: "u1" },
    )
  })
})

describe("saveExamAnswer", () => {
  const input = { examId: "e1", questionId: "q1", selectedAnswer: "A" }
  const question = { examQuestions: [{ correctAnswer: "A" }] }

  it("entree invalide → refus avant lecture", async () => {
    const res = await saveExamAnswer({ ...input, selectedAnswer: "" })
    expect(res.success).toBe(false)
    expect(mocks.requireAttempt).not.toHaveBeenCalled()
  })

  // Lue APRES la garde : sinon le message distinguerait une question de
  // l'examen d'une question etrangere pour un examen a venir ou un non-abonne.
  it("question etrangere a l'examen → refus, apres la garde", async () => {
    setRows({ examQuestions: [] })
    expect(await saveExamAnswer(input)).toEqual({
      success: false,
      error: "Cette question ne fait pas partie de l'examen.",
    })
    expect(mocks.requireAttempt).toHaveBeenCalled()
  })

  it("garde refusee : la question n'est pas lue, le refus porte son code", async () => {
    refuse("OUTSIDE_WINDOW")
    setRows({ examQuestions: [] })
    expect(await saveExamAnswer(input)).toEqual({
      success: false,
      error: refusalMessage("OUTSIDE_WINDOW", "exam"),
      code: "OUTSIDE_WINDOW",
    })
  })

  it("temps ecoule : le refus porte TIME_UP, pour que le client soumette au lieu de faire reessayer", async () => {
    refuse("TIME_UP")
    expect(await saveExamAnswer(input)).toEqual({
      success: false,
      error: refusalMessage("TIME_UP", "exam"),
      code: "TIME_UP",
    })
  })

  it("demande la garde `answer` sur l'examen, pour l'acteur courant, dans la transaction", async () => {
    setRows(question)
    await saveExamAnswer(input)
    expect(mocks.requireAttempt).toHaveBeenCalledWith(fakeTx, {
      kind: "exam",
      ref: "e1",
      actor: { id: "u1", role: "user" },
      now: NOW,
      verb: "answer",
    })
  })

  it.each(ALL_REFUSALS)("refus %s → message, aucune ecriture", async (code) => {
    refuse(code)
    setRows(question)
    expect(await saveExamAnswer(input)).toEqual({
      success: false,
      error: refusalMessage(code, "exam"),
      code,
    })
    expect(state.set).toBeUndefined()
  })

  it("aucune ligne mise a jour → session incoherente", async () => {
    state.returning = []
    setRows(question)
    expect(await saveExamAnswer(input)).toEqual({
      success: false,
      error: "Réponse non enregistrée (session incohérente).",
    })
  })

  it("succes : ecrit la reponse et son verdict, ne renvoie jamais isCorrect (anti-triche)", async () => {
    setRows(question)
    const res = await saveExamAnswer(input)
    // `serverNow` ré-ancre le chrono client ; jamais isCorrect.
    expect(res).toEqual({ success: true, serverNow: Date.now() })
    expect(state.set).toEqual({ selectedAnswer: "A", isCorrect: true })
  })

  it("panne base → capture", async () => {
    rejectWith("boom")
    setRows(question)
    expect(await saveExamAnswer(input)).toEqual({
      success: false,
      error: SERVER_ERROR,
    })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[saveExamAnswer]",
      expect.any(Error),
      { userId: "u1" },
    )
  })
})

describe("saveExamFlag", () => {
  const input = { examId: "e1", questionId: "q1", isFlagged: true }

  it("entree invalide → refus", async () => {
    const res = await saveExamFlag({ ...input, examId: "" })
    expect(res.success).toBe(false)
  })

  it("demande la garde `flag`", async () => {
    await saveExamFlag(input)
    expect(mocks.requireAttempt).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({ ref: "e1", verb: "flag" }),
    )
  })

  it.each(["NOT_FOUND", "NOT_IN_PROGRESS"] as const)(
    "refus %s → message",
    async (code) => {
      refuse(code)
      expect(await saveExamFlag(input)).toEqual({
        success: false,
        error: refusalMessage(code, "exam"),
        code,
      })
    },
  )

  it("aucune ligne marquee → session incoherente", async () => {
    state.returning = []
    expect(await saveExamFlag(input)).toEqual({
      success: false,
      error: "Marquage non enregistré (session incohérente).",
    })
  })

  it("succes", async () => {
    expect(await saveExamFlag(input)).toEqual({ success: true })
    expect(state.set).toEqual({ isFlagged: true })
  })
})

describe("finalizeExam", () => {
  const agg = { examAnswers: [{ correct: 1, total: 2 }] }

  it("entree invalide → refus avant transaction", async () => {
    const res = await finalizeExam({ examId: "" })
    expect(res.success).toBe(false)
    expect(state.transaction).not.toHaveBeenCalled()
  })

  // `isAutoSubmit` (client) n'a qu'un effet : l'exemption du budget que la
  // garde `close` applique — il transite tel quel.
  it("demande la garde `close` et lui transmet isAutoSubmit", async () => {
    setRows(agg)
    await finalizeExam({ examId: "e1", isAutoSubmit: true })
    expect(mocks.requireAttempt).toHaveBeenCalledWith(fakeTx, {
      kind: "exam",
      ref: "e1",
      actor: { id: "u1", role: "user" },
      now: NOW,
      verb: "close",
      isAutoSubmit: true,
    })
  })

  it.each(ALL_REFUSALS)("refus %s → message, aucune ecriture", async (code) => {
    refuse(code)
    setRows(agg)
    expect(await finalizeExam({ examId: "e1" })).toEqual({
      success: false,
      error: refusalMessage(code, "exam"),
      code,
    })
    expect(state.set).toBeUndefined()
  })

  it("succes manuel : score depuis les lignes en base, statut completed", async () => {
    setRows(agg)
    expect(await finalizeExam({ examId: "e1" })).toEqual({ success: true })
    expect(state.set).toEqual({
      status: "completed",
      score: 50,
      completedAt: new Date(NOW),
      pauseStartedAt: null,
      totalPauseDurationMs: 0,
    })
  })

  it("auto-soumission : statut auto_submitted", async () => {
    setRows(agg)
    await finalizeExam({ examId: "e1", isAutoSubmit: true })
    expect(state.set).toMatchObject({ status: "auto_submitted" })
  })

  // Une pause en cours à la clôture est créditée, plafonnée à la durée de
  // l'examen, et refermée.
  it("pause en cours : creditee (plafonnee) et refermee", async () => {
    vi.setSystemTime(10 * 60_000)
    mocks.requireAttempt.mockResolvedValueOnce(
      openAttempt({
        timing: {
          startedAt: 0,
          budgetSeconds: 3600,
          pauseCreditMs: 1_000,
          pauseInProgress: { startedAt: 0, capMinutes: 5 },
        },
      }),
    )
    setRows(agg)
    await finalizeExam({ examId: "e1" })
    expect(state.set).toMatchObject({
      pauseStartedAt: null,
      totalPauseDurationMs: 1_000 + 5 * 60_000,
    })
  })

  it("erreur inattendue → capture", async () => {
    rejectWith("boom")
    const res = await finalizeExam({ examId: "e1" })
    expect(res).toEqual({ success: false, error: SERVER_ERROR })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[finalizeExam]",
      expect.any(Error),
      { userId: "u1" },
    )
  })
})

describe("pauseExam", () => {
  it("id vide → refus avant transaction", async () => {
    expect(await pauseExam({ examId: "" })).toEqual({
      success: false,
      error: "Examen requis",
    })
    expect(state.transaction).not.toHaveBeenCalled()
  })

  it("demande la garde `pause`", async () => {
    await pauseExam({ examId: "e1" })
    expect(mocks.requireAttempt).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({ ref: "e1", verb: "pause" }),
    )
  })

  it.each(["NOT_FOUND", "NOT_IN_PROGRESS"] as const)(
    "refus %s → message",
    async (code) => {
      refuse(code)
      expect(await pauseExam({ examId: "e1" })).toEqual({
        success: false,
        error: refusalMessage(code, "exam"),
        code,
      })
    },
  )

  // Les refus propres à la pause restent locaux à l'action.
  it.each([
    [
      openAttempt({ exam: { enablePause: false, pauseDurationMinutes: null } }),
      "La pause n'est pas activée pour cet examen.",
    ],
    [
      openAttempt({
        timing: {
          startedAt: 0,
          budgetSeconds: 100,
          pauseCreditMs: 0,
          pauseInProgress: { startedAt: 1_400, capMinutes: 20 },
        },
      }),
      "Vous êtes déjà en pause.",
    ],
    [
      openAttempt({
        timing: {
          startedAt: 0,
          budgetSeconds: 100,
          pauseCreditMs: 60_000,
          pauseInProgress: null,
        },
      }),
      "La pause a déjà été utilisée.",
    ],
  ])("refus local : %#", async (attempt, error) => {
    mocks.requireAttempt.mockResolvedValueOnce(attempt)
    expect(await pauseExam({ examId: "e1" })).toEqual({
      success: false,
      error,
    })
    expect(state.set).toBeUndefined()
  })

  it("succes : renvoie l'instant et la duree de l'examen", async () => {
    expect(await pauseExam({ examId: "e1" })).toEqual({
      success: true,
      pauseStartedAt: NOW,
      pauseDurationMinutes: 20,
      serverNow: NOW,
    })
    expect(state.set).toEqual({ pauseStartedAt: new Date(NOW) })
  })

  it("duree non renseignee → repli sur la valeur par defaut", async () => {
    mocks.requireAttempt.mockResolvedValueOnce(
      openAttempt({ exam: { enablePause: true, pauseDurationMinutes: null } }),
    )
    expect(await pauseExam({ examId: "e1" })).toMatchObject({
      pauseDurationMinutes: 15,
    })
  })

  it("panne base → capture", async () => {
    rejectWith("boom")
    expect(await pauseExam({ examId: "e1" })).toEqual({
      success: false,
      error: SERVER_ERROR,
    })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[pauseExam]",
      expect.any(Error),
      { userId: "u1" },
    )
  })
})

describe("resumeExam", () => {
  const paused = (pauseStartedAt: number, pauseCreditMs = 0, capMinutes = 20) =>
    openAttempt({
      timing: {
        startedAt: 0,
        budgetSeconds: 3600,
        pauseCreditMs,
        pauseInProgress: { startedAt: pauseStartedAt, capMinutes },
      },
    })

  it("id vide → refus avant transaction", async () => {
    expect(await resumeExam({ examId: "" })).toEqual({
      success: false,
      error: "Examen requis",
    })
  })

  it("demande la garde `resume`", async () => {
    mocks.requireAttempt.mockResolvedValueOnce(paused(1_000))
    await resumeExam({ examId: "e1" })
    expect(mocks.requireAttempt).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({ ref: "e1", verb: "resume" }),
    )
  })

  it.each(["NOT_FOUND", "NOT_IN_PROGRESS"] as const)(
    "refus %s → message",
    async (code) => {
      refuse(code)
      expect(await resumeExam({ examId: "e1" })).toEqual({
        success: false,
        error: refusalMessage(code, "exam"),
        code,
      })
    },
  )

  it("pas en pause → refus local", async () => {
    expect(await resumeExam({ examId: "e1" })).toEqual({
      success: false,
      error: "Vous n'êtes pas en pause.",
    })
    expect(state.set).toBeUndefined()
  })

  it("cumule la duree de pause reellement ecoulee", async () => {
    vi.setSystemTime(100_000)
    mocks.requireAttempt.mockResolvedValueOnce(paused(40_000, 5_000))
    expect(await resumeExam({ examId: "e1" })).toEqual({
      success: true,
      totalPauseDurationMs: 65_000,
      serverNow: 100_000,
    })
    expect(state.set).toEqual({
      pauseStartedAt: null,
      totalPauseDurationMs: 65_000,
    })
  })

  // Sans plafond, une pause « oubliee » offrirait un budget-temps illimite.
  it("plafonne la pause a la duree autorisee de l'examen", async () => {
    vi.setSystemTime(60 * 60 * 1000)
    mocks.requireAttempt.mockResolvedValueOnce(paused(0, 0, 1))
    expect(await resumeExam({ examId: "e1" })).toEqual({
      success: true,
      totalPauseDurationMs: 60_000,
      serverNow: 60 * 60 * 1000,
    })
  })

  it("panne base → capture", async () => {
    rejectWith("boom")
    expect(await resumeExam({ examId: "e1" })).toEqual({
      success: false,
      error: SERVER_ERROR,
    })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[resumeExam]",
      expect.any(Error),
      { userId: "u1" },
    )
  })
})
