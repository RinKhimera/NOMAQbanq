import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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

// Couvre les decisions propres a `actions.ts` : gardes, validation zod, mapping
// des erreurs metier vers un message, et les refus de passation (statut, pause,
// budget-temps). Le SQL et la concurrence (verrous FOR UPDATE, cascades) sont
// verifies sur une vraie base dans tests/integration/exam-*.test.ts.
//
// Le faux `db` sert des lignes indexees par nom de table, ce qui rend les tests
// independants de l'ORDRE des requetes dans l'action — un simple tableau
// consomme en file casserait au moindre refactor.
// `vi.mock` est hoiste au-dessus des declarations du module : tout ce que ses
// fabriques utilisent doit venir de `vi.hoisted`, sinon `Cannot access … before
// initialization`.
const { mocks, fakeDb, table } = vi.hoisted(() => {
  const mocks = {
    captureServerError: vi.fn(),
    revalidatePath: vi.fn(),
    transaction:
      vi.fn<(cb: (tx: unknown) => Promise<unknown>) => Promise<unknown>>(),
    rows: { current: {} as Record<string, unknown[]> },
    returning: { current: [] as unknown[] },
    session: {
      current: { user: { id: "u1", role: "user" } } as {
        user: { id: string; role: string }
      },
    },
    hasAccess: vi.fn(async () => true),
    searchSelectableUsers: vi.fn(async () => []),
    getExamAudience: vi.fn(async () => []),
    getExamQuestionExplanations: vi.fn(async () => []),
  }

  const table = (name: string) => ({ __table: name })

  /**
   * Chaine de requete Drizzle simulee : chaque methode se renvoie elle-meme et
   * l'objet est « thenable », donc `await` fonctionne quel que soit le maillon
   * terminal (`.limit()`, `.where()`, `.values()`…).
   */
  const queryChain = (initialTable?: string) => {
    let target = initialTable
    const chain: Record<string, unknown> = {
      from: (t: { __table?: string }) => {
        target = t?.__table
        return chain
      },
      innerJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      for: () => chain,
      limit: () => chain,
      set: () => chain,
      values: () => chain,
      onConflictDoUpdate: () => chain,
      returning: () => Promise.resolve(mocks.returning.current),
      then: (onOk: (v: unknown) => unknown, onErr: (e: unknown) => unknown) =>
        Promise.resolve(
          (target ? mocks.rows.current[target] : undefined) ?? [],
        ).then(onOk, onErr),
    }
    return chain
  }

  const fakeDb = {
    transaction: (cb: (tx: unknown) => Promise<unknown>) =>
      mocks.transaction(cb),
    select: () => queryChain(),
    insert: (t: { __table?: string }) => queryChain(t?.__table),
    update: (t: { __table?: string }) => queryChain(t?.__table),
    delete: (t: { __table?: string }) => queryChain(t?.__table),
  }

  return { mocks, fakeDb, table }
})

vi.mock("@/db", () => ({ db: fakeDb }))
vi.mock("@/db/schema", () => ({
  examAnswers: table("examAnswers"),
  examAudience: table("examAudience"),
  examParticipations: table("examParticipations"),
  examQuestions: table("examQuestions"),
  exams: table("exams"),
  questions: table("questions"),
  user: table("user"),
  userAccess: table("userAccess"),
}))
vi.mock("@/features/payments/dal", () => ({ hasAccess: mocks.hasAccess }))
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

const examInput = {
  title: "Examen blanc",
  startDate: 1_000,
  endDate: 2_000,
  questionIds: ["q1", "q2"],
}

/** Fait echouer le corps de la transaction avec un code metier. */
const rejectWith = (message: string) =>
  mocks.transaction.mockRejectedValueOnce(new Error(message))

/** Execute reellement le callback de transaction contre le faux `db`. */
const runCallback = () =>
  mocks.transaction.mockImplementationOnce(async (cb) => cb(fakeDb))

const setRows = (rows: Record<string, unknown[]>) => {
  mocks.rows.current = rows
}

const inProgress = (extra: Record<string, unknown> = {}) => ({
  id: "p1",
  status: "in_progress",
  startedAt: new Date(1_500),
  pauseStartedAt: null,
  totalPauseDurationMs: 0,
  total: 0,
  ...extra,
})

beforeEach(() => {
  mocks.session.current = { user: { id: "u1", role: "user" } }
  mocks.rows.current = {}
  mocks.returning.current = [{ id: "a1" }]
  mocks.transaction.mockResolvedValue(undefined)
  // Seul `Date` est simule : les actions lisent `Date.now()`, aucune n'attend de
  // minuterie. Aucune option de config ne restaure les faux timers (restoreMocks
  // ne parcourt que le registre des espions) — d'ou l'afterEach explicite.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(1_500)
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
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("succes : renvoie l'id et revalide la liste", async () => {
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
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("succes : revalide la liste et la fiche", async () => {
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

describe("startExam — mapping des refus", () => {
  it("id vide → refus avant transaction", async () => {
    const res = await startExam({ examId: "" })
    expect(res).toEqual({ success: false, error: "Examen requis" })
    expect(mocks.transaction).not.toHaveBeenCalled()
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

describe("saveExamAnswer — gardes de passation", () => {
  const input = { examId: "e1", questionId: "q1", selectedAnswer: "A" }
  const openExam = {
    startDate: new Date(0),
    endDate: new Date(10_000),
    audienceType: "subscribers",
    completionTime: 100,
  }

  it("entree invalide → refus avant lecture", async () => {
    const res = await saveExamAnswer({ ...input, selectedAnswer: "" })
    expect(res.success).toBe(false)
  })

  it("examen introuvable", async () => {
    setRows({ exams: [] })
    expect(await saveExamAnswer(input)).toEqual({
      success: false,
      error: "Examen introuvable.",
    })
  })

  it("hors fenetre de dates", async () => {
    setRows({ exams: [{ ...openExam, startDate: new Date(5_000) }] })
    expect(await saveExamAnswer(input)).toEqual({
      success: false,
      error: "L'examen n'est pas disponible à cette période.",
    })
  })

  it("abonnement expire (audience subscribers)", async () => {
    mocks.hasAccess.mockResolvedValueOnce(false)
    setRows({ exams: [openExam] })
    expect(await saveExamAnswer(input)).toEqual({
      success: false,
      error: "Votre accès aux examens a expiré.",
    })
  })

  it("question etrangere a l'examen", async () => {
    setRows({ exams: [openExam], examQuestions: [] })
    expect(await saveExamAnswer(input)).toEqual({
      success: false,
      error: "Cette question ne fait pas partie de l'examen.",
    })
  })

  it("participation absente", async () => {
    runCallback()
    setRows({
      exams: [openExam],
      examQuestions: [{ correctAnswer: "A" }],
      examParticipations: [],
    })
    expect(await saveExamAnswer(input)).toEqual({
      success: false,
      error: "Participation introuvable.",
    })
  })

  it("participation deja terminee", async () => {
    runCallback()
    setRows({
      exams: [openExam],
      examQuestions: [{ correctAnswer: "A" }],
      examParticipations: [inProgress({ status: "completed" })],
    })
    expect(await saveExamAnswer(input)).toEqual({
      success: false,
      error: "Cette session d'examen n'est plus active.",
    })
  })

  it("pause en cours → ecriture refusee", async () => {
    runCallback()
    setRows({
      exams: [openExam],
      examQuestions: [{ correctAnswer: "A" }],
      examParticipations: [inProgress({ pauseStartedAt: new Date(1_400) })],
    })
    expect(await saveExamAnswer(input)).toEqual({
      success: false,
      error: "Réponse impossible pendant la pause.",
    })
  })

  it("budget-temps depasse → refus a l'ecriture (anti-triche)", async () => {
    runCallback()
    vi.setSystemTime(1_000_000)
    setRows({
      exams: [{ ...openExam, endDate: new Date(10_000_000) }],
      examQuestions: [{ correctAnswer: "A" }],
      examParticipations: [inProgress({ startedAt: new Date(0) })],
    })
    expect(await saveExamAnswer(input)).toEqual({
      success: false,
      error: "Temps écoulé.",
    })
  })

  it("admin : le budget-temps ne s'applique pas", async () => {
    mocks.session.current = { user: { id: "adm", role: "admin" } }
    runCallback()
    vi.setSystemTime(1_000_000)
    setRows({
      exams: [{ ...openExam, endDate: new Date(10_000_000) }],
      examQuestions: [{ correctAnswer: "A" }],
      examParticipations: [inProgress({ startedAt: new Date(0) })],
    })
    expect(await saveExamAnswer(input)).toEqual({ success: true })
  })

  it("aucune ligne mise a jour → session incoherente", async () => {
    runCallback()
    mocks.returning.current = []
    setRows({
      exams: [openExam],
      examQuestions: [{ correctAnswer: "A" }],
      examParticipations: [inProgress()],
    })
    expect(await saveExamAnswer(input)).toEqual({
      success: false,
      error: "Réponse non enregistrée (session incohérente).",
    })
  })

  it("succes : ne renvoie jamais isCorrect (anti-triche)", async () => {
    runCallback()
    setRows({
      exams: [openExam],
      examQuestions: [{ correctAnswer: "A" }],
      examParticipations: [inProgress()],
    })
    const res = await saveExamAnswer(input)
    expect(res).toEqual({ success: true })
    expect(res).not.toHaveProperty("isCorrect")
  })

  it("panne base → capture", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("boom"))
    setRows({
      exams: [openExam],
      examQuestions: [{ correctAnswer: "A" }],
    })
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

  it("participation absente", async () => {
    setRows({ examParticipations: [] })
    expect(await saveExamFlag(input)).toEqual({
      success: false,
      error: "Participation introuvable.",
    })
  })

  it("participation terminee", async () => {
    setRows({ examParticipations: [inProgress({ status: "completed" })] })
    expect(await saveExamFlag(input)).toEqual({
      success: false,
      error: "Cette session d'examen n'est plus active.",
    })
  })

  it("aucune ligne marquee → session incoherente", async () => {
    mocks.returning.current = []
    setRows({ examParticipations: [inProgress()] })
    expect(await saveExamFlag(input)).toEqual({
      success: false,
      error: "Marquage non enregistré (session incohérente).",
    })
  })

  it("succes", async () => {
    setRows({ examParticipations: [inProgress()] })
    expect(await saveExamFlag(input)).toEqual({ success: true })
  })
})

describe("finalizeExam — mapping des refus", () => {
  it("entree invalide → refus avant transaction", async () => {
    const res = await finalizeExam({ examId: "" })
    expect(res.success).toBe(false)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it.each([
    ["NOT_FOUND", "Examen introuvable."],
    ["OUTSIDE_WINDOW", "L'examen n'est pas disponible à cette période."],
    ["NOT_FOUND_PART", "Participation introuvable."],
    ["ALREADY_TAKEN", "Vous avez déjà passé cet examen."],
    ["NOT_IN_PROGRESS", "Cette session d'examen n'est plus active."],
    ["ACCESS_EXPIRED", "Votre accès aux examens a expiré."],
    ["NOT_STARTED", "L'examen n'a pas encore été démarré."],
    [
      "TIME_UP",
      "Temps écoulé ! La soumission n'a pas pu être traitée à temps.",
    ],
  ])("%s → %s, sans capture", async (thrown, error) => {
    rejectWith(thrown)
    const res = await finalizeExam({ examId: "e1" })
    expect(res).toEqual({ success: false, error })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
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
  const openExam = { enablePause: true, pauseDurationMinutes: 20 }

  it("id vide → refus avant transaction", async () => {
    expect(await pauseExam({ examId: "" })).toEqual({
      success: false,
      error: "Examen requis",
    })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it.each([
    [{ exams: [] }, "Examen introuvable."],
    [
      { exams: [{ enablePause: false }] },
      "La pause n'est pas activée pour cet examen.",
    ],
    [
      { exams: [openExam], examParticipations: [] },
      "Participation introuvable.",
    ],
    [
      {
        exams: [openExam],
        examParticipations: [inProgress({ status: "completed" })],
      },
      "L'examen n'est pas en cours.",
    ],
    [
      {
        exams: [openExam],
        examParticipations: [inProgress({ pauseStartedAt: new Date(1_400) })],
      },
      "Vous êtes déjà en pause.",
    ],
    [
      {
        exams: [openExam],
        examParticipations: [inProgress({ total: 60_000 })],
      },
      "La pause a déjà été utilisée.",
    ],
  ])("refus : %#", async (rows, error) => {
    runCallback()
    setRows(rows)
    expect(await pauseExam({ examId: "e1" })).toEqual({
      success: false,
      error,
    })
  })

  it("succes : renvoie l'instant et la duree de l'examen", async () => {
    runCallback()
    setRows({ exams: [openExam], examParticipations: [inProgress()] })
    expect(await pauseExam({ examId: "e1" })).toEqual({
      success: true,
      pauseStartedAt: 1_500,
      pauseDurationMinutes: 20,
    })
  })

  it("duree non renseignee → repli sur la valeur par defaut", async () => {
    runCallback()
    setRows({
      exams: [{ enablePause: true, pauseDurationMinutes: null }],
      examParticipations: [inProgress()],
    })
    expect(await pauseExam({ examId: "e1" })).toMatchObject({
      pauseDurationMinutes: 15,
    })
  })

  it("panne base → capture", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("boom"))
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
  it("id vide → refus avant transaction", async () => {
    expect(await resumeExam({ examId: "" })).toEqual({
      success: false,
      error: "Examen requis",
    })
  })

  it.each([
    [{ exams: [] }, "Examen introuvable."],
    [
      { exams: [{ pauseDurationMinutes: 20 }], examParticipations: [] },
      "Participation introuvable.",
    ],
    [
      {
        exams: [{ pauseDurationMinutes: 20 }],
        examParticipations: [inProgress({ status: "auto_submitted" })],
      },
      "L'examen n'est pas en cours.",
    ],
    [
      {
        exams: [{ pauseDurationMinutes: 20 }],
        examParticipations: [inProgress({ pauseStartedAt: null })],
      },
      "Vous n'êtes pas en pause.",
    ],
  ])("refus : %#", async (rows, error) => {
    runCallback()
    setRows(rows)
    expect(await resumeExam({ examId: "e1" })).toEqual({
      success: false,
      error,
    })
  })

  it("cumule la duree de pause reellement ecoulee", async () => {
    runCallback()
    vi.setSystemTime(100_000)
    setRows({
      exams: [{ pauseDurationMinutes: 20 }],
      examParticipations: [
        inProgress({ pauseStartedAt: new Date(40_000), total: 5_000 }),
      ],
    })
    expect(await resumeExam({ examId: "e1" })).toEqual({
      success: true,
      totalPauseDurationMs: 65_000,
    })
  })

  // Sans plafond, une pause « oubliee » offrirait un budget-temps illimite.
  it("plafonne la pause a la duree autorisee de l'examen", async () => {
    runCallback()
    vi.setSystemTime(60 * 60 * 1000)
    setRows({
      exams: [{ pauseDurationMinutes: 1 }],
      examParticipations: [
        inProgress({ pauseStartedAt: new Date(0), total: 0 }),
      ],
    })
    expect(await resumeExam({ examId: "e1" })).toEqual({
      success: true,
      totalPauseDurationMs: 60_000,
    })
  })

  it("panne base → capture", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("boom"))
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
