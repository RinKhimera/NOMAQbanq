import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  abandonTrainingSession,
  completeTrainingSession,
  createTrainingSession,
  deleteTrainingSession,
  loadAvailableObjectifsCMC,
  loadRevisionCounts,
  loadTrainingHistory,
  saveTrainingAnswer,
  setQuestionBookmark,
} from "@/features/training/actions"

// Couvre les decisions propres a `actions.ts` : gardes de propriete (IDOR),
// statut, expiration, acces payant, et le mapping des erreurs metier. Le SQL, le
// tirage aleatoire et la concurrence sont verifies sur une vraie base dans
// tests/integration/training-*.test.ts.
//
// `vi.mock` etant hoiste, tout ce que ses fabriques utilisent vient de
// `vi.hoisted`. Les lignes sont indexees par table pour ne pas dependre de
// l'ORDRE des requetes dans l'action.
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
    getPgErrorCode: vi.fn<() => string | undefined>(() => undefined),
    getOpenExamLockedQuestionIds: vi.fn(async () => new Set<string>()),
    getTrainingHistory: vi.fn(async () => ({ items: [], nextCursor: null })),
    getAvailableObjectifsCMC: vi.fn(async () => ({ objectifs: [] })),
    getRevisionCounts: vi.fn(async () => ({
      failed: 3,
      unseen: 2,
      bookmarked: 1,
    })),
    pickRevisionQuestionIds: vi.fn(async () => ["q1"]),
    resolveRevisionLock: vi.fn(async () => new Set<string>()),
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
      where: () => chain,
      orderBy: () => chain,
      for: () => chain,
      limit: () => chain,
      set: () => chain,
      values: () => chain,
      onConflictDoNothing: () => chain,
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
  questionBookmarks: table("questionBookmarks"),
  questionExplanations: table("questionExplanations"),
  questions: table("questions"),
  trainingSessionItems: table("trainingSessionItems"),
  trainingSessions: table("trainingSessions"),
  user: table("user"),
}))
vi.mock("@/features/exams/dal", () => ({
  getOpenExamLockedQuestionIds: mocks.getOpenExamLockedQuestionIds,
}))
vi.mock("@/features/payments/dal", () => ({ hasAccess: mocks.hasAccess }))
vi.mock("@/features/training/dal", () => ({
  getAvailableObjectifsCMC: mocks.getAvailableObjectifsCMC,
  getTrainingHistory: mocks.getTrainingHistory,
}))
vi.mock("@/features/training/revision", () => ({
  getRevisionCounts: mocks.getRevisionCounts,
  pickRevisionQuestionIds: mocks.pickRevisionQuestionIds,
  resolveRevisionLock: mocks.resolveRevisionLock,
}))
vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(async () => mocks.session.current),
}))
vi.mock("@/lib/db-errors", () => ({ getPgErrorCode: mocks.getPgErrorCode }))
vi.mock("@/lib/observability", () => ({
  captureServerError: mocks.captureServerError,
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

const SERVER_ERROR = "Erreur serveur. Réessayez."
const NOW = 1_000_000

const setRows = (rows: Record<string, unknown[]>) => {
  mocks.rows.current = rows
}

const openSession = (extra: Record<string, unknown> = {}) => ({
  userId: "u1",
  status: "in_progress",
  questionCount: 10,
  expiresAt: new Date(NOW + 60_000),
  mode: "test",
  ...extra,
})

const runCallback = () =>
  mocks.transaction.mockImplementationOnce(async (cb) => cb(fakeDb))

beforeEach(() => {
  mocks.session.current = { user: { id: "u1", role: "user" } }
  mocks.rows.current = {}
  mocks.returning.current = [{ id: "s1" }]
  mocks.transaction.mockResolvedValue(5)
  // Aucune option de config ne restaure les faux timers — d'ou l'afterEach.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("lectures gardees", () => {
  it("loadTrainingHistory delegue au DAL apres la garde", async () => {
    await loadTrainingHistory({ cursor: "c1" })
    expect(mocks.getTrainingHistory).toHaveBeenCalledWith({ cursor: "c1" })
  })

  it("loadRevisionCounts : portee invalide → compteurs a zero, pas de requete", async () => {
    const res = await loadRevisionCounts({ domain: "" })
    expect(res).toEqual({ failed: 0, unseen: 0, bookmarked: 0 })
    expect(mocks.getRevisionCounts).not.toHaveBeenCalled()
  })

  it("loadRevisionCounts : portee valide → compteurs de l'utilisateur courant", async () => {
    const res = await loadRevisionCounts({ domain: "Cardiologie" })
    expect(mocks.getRevisionCounts).toHaveBeenCalledWith("u1", {
      domain: "Cardiologie",
    })
    expect(res).toEqual({ failed: 3, unseen: 2, bookmarked: 1 })
  })

  it("loadAvailableObjectifsCMC delegue au DAL", async () => {
    await loadAvailableObjectifsCMC("Cardiologie")
    expect(mocks.getAvailableObjectifsCMC).toHaveBeenCalledWith("Cardiologie")
  })
})

describe("createTrainingSession", () => {
  // `mode` est requis par le type d'entree (z.infer, pas z.input).
  const input = { questionCount: 10, mode: "test" as const }

  it("refuse moins de 5 questions hors revision", async () => {
    const res = await createTrainingSession({ ...input, questionCount: 3 })
    expect(res).toEqual({ success: false, error: "Au moins 5 questions" })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("accepte moins de 5 questions en revision (corpus court legitime)", async () => {
    const res = await createTrainingSession({
      ...input,
      questionCount: 3,
      revisionFilters: ["failed"],
    })
    expect(res).toMatchObject({ success: true })
  })

  it("acces entrainement expire → refus avant toute ecriture", async () => {
    mocks.hasAccess.mockResolvedValueOnce(false)
    const res = await createTrainingSession(input)
    expect(res).toEqual({
      success: false,
      error: "Votre accès à l'entraînement a expiré.",
    })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("admin : pas de garde d'acces payant", async () => {
    mocks.session.current = { user: { id: "adm", role: "admin" } }
    const res = await createTrainingSession(input)
    expect(res).toMatchObject({ success: true })
    expect(mocks.hasAccess).not.toHaveBeenCalled()
  })

  it("revision : verrouille les questions d'examen ouvert avant la transaction", async () => {
    await createTrainingSession({ ...input, revisionFilters: ["failed"] })
    expect(mocks.resolveRevisionLock).toHaveBeenCalledWith("u1")
  })

  it("hors revision : aucun verrou d'examen a resoudre", async () => {
    await createTrainingSession(input)
    expect(mocks.resolveRevisionLock).not.toHaveBeenCalled()
  })

  it("succes : renvoie le nombre REELLEMENT retenu", async () => {
    mocks.transaction.mockResolvedValueOnce(7)
    const res = await createTrainingSession(input)
    expect(res).toMatchObject({ success: true, questionCount: 7 })
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/tableau-de-bord/entrainement",
    )
  })

  it.each([
    [
      "RATE_LIMIT",
      "Trop de sessions créées récemment. Réessayez dans une heure.",
    ],
    [
      "ACTIVE_EXISTS",
      "Vous avez déjà une session en cours. Terminez-la ou attendez son expiration.",
    ],
    [
      "EMPTY_REVISION",
      "Aucune question ne correspond à ces critères de révision. Élargissez la sélection.",
    ],
    [
      "NOT_ENOUGH:4",
      "Seulement 4 questions disponibles. Réduisez le nombre demandé.",
    ],
  ])("%s → message dedie, sans capture", async (thrown, error) => {
    mocks.transaction.mockRejectedValueOnce(new Error(thrown))
    const res = await createTrainingSession(input)
    expect(res).toEqual({ success: false, error })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("erreur inattendue → capture avec l'utilisateur", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("pool exhausted"))
    const res = await createTrainingSession(input)
    expect(res).toEqual({ success: false, error: SERVER_ERROR })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[createTrainingSession]",
      expect.any(Error),
      { userId: "u1" },
    )
  })

  it("revision sans question disponible → message dedie", async () => {
    runCallback()
    mocks.pickRevisionQuestionIds.mockResolvedValueOnce([])
    setRows({ trainingSessions: [], user: [{ id: "u1" }] })
    const res = await createTrainingSession({
      ...input,
      revisionFilters: ["bookmarked"],
    })
    expect(res).toEqual({
      success: false,
      error:
        "Aucune question ne correspond à ces critères de révision. Élargissez la sélection.",
    })
  })
})

describe("saveTrainingAnswer", () => {
  const input = { sessionId: "s1", questionId: "q1", selectedAnswer: "A" }

  it("entree invalide → refus avant lecture", async () => {
    const res = await saveTrainingAnswer({ ...input, selectedAnswer: "" })
    expect(res.success).toBe(false)
  })

  it("session introuvable", async () => {
    setRows({ trainingSessions: [] })
    expect(await saveTrainingAnswer(input)).toEqual({
      success: false,
      error: "Session introuvable",
    })
  })

  // IDOR : la session appartient a quelqu'un d'autre.
  it("session d'un autre utilisateur → refus", async () => {
    setRows({ trainingSessions: [openSession({ userId: "autre" })] })
    expect(await saveTrainingAnswer(input)).toEqual({
      success: false,
      error: "Cette session ne vous appartient pas",
    })
  })

  it("session terminee", async () => {
    setRows({ trainingSessions: [openSession({ status: "completed" })] })
    expect(await saveTrainingAnswer(input)).toEqual({
      success: false,
      error: "Cette session n'est plus active",
    })
  })

  it("session expiree → bascule abandonnee et refuse", async () => {
    setRows({
      trainingSessions: [openSession({ expiresAt: new Date(NOW - 1) })],
    })
    expect(await saveTrainingAnswer(input)).toEqual({
      success: false,
      error: "Cette session a expiré",
    })
  })

  it("acces entrainement expire", async () => {
    mocks.hasAccess.mockResolvedValueOnce(false)
    setRows({ trainingSessions: [openSession()] })
    expect(await saveTrainingAnswer(input)).toEqual({
      success: false,
      error: "Votre accès à l'entraînement a expiré.",
    })
  })

  it("question hors session", async () => {
    setRows({
      trainingSessions: [openSession()],
      trainingSessionItems: [],
    })
    expect(await saveTrainingAnswer(input)).toEqual({
      success: false,
      error: "Cette question ne fait pas partie de la session",
    })
  })

  it("mode test : n'expose jamais isCorrect (anti-triche)", async () => {
    setRows({
      trainingSessions: [openSession()],
      trainingSessionItems: [{ itemId: "i1", correctAnswer: "A" }],
    })
    expect(await saveTrainingAnswer(input)).toEqual({ success: true })
  })

  it("mode tuteur : revele la correction et l'explication", async () => {
    setRows({
      trainingSessions: [openSession({ mode: "tutor" })],
      trainingSessionItems: [{ itemId: "i1", correctAnswer: "A" }],
      questionExplanations: [{ explanation: "parce que", references: ["r1"] }],
    })
    expect(await saveTrainingAnswer(input)).toEqual({
      success: true,
      isCorrect: true,
      reveal: {
        correctAnswer: "A",
        explanation: "parce que",
        references: ["r1"],
      },
    })
  })

  it("mode tuteur sans explication enregistree → champs omis", async () => {
    setRows({
      trainingSessions: [openSession({ mode: "tutor" })],
      trainingSessionItems: [{ itemId: "i1", correctAnswer: "B" }],
      questionExplanations: [],
    })
    expect(await saveTrainingAnswer(input)).toEqual({
      success: true,
      isCorrect: false,
      reveal: {
        correctAnswer: "B",
        explanation: undefined,
        references: undefined,
      },
    })
  })

  // Anti-triche : la reponse est enregistree, mais la correction est retenue
  // tant que l'examen qui porte cette question est ouvert.
  it("mode tuteur, question verrouillee par un examen ouvert → aucune revelation", async () => {
    mocks.getOpenExamLockedQuestionIds.mockResolvedValueOnce(new Set(["q1"]))
    setRows({
      trainingSessions: [openSession({ mode: "tutor" })],
      trainingSessionItems: [{ itemId: "i1", correctAnswer: "A" }],
    })
    expect(await saveTrainingAnswer(input)).toEqual({ success: true })
  })

  it("admin : pas de verrou d'examen applique", async () => {
    mocks.session.current = { user: { id: "u1", role: "admin" } }
    setRows({
      trainingSessions: [openSession({ mode: "tutor" })],
      trainingSessionItems: [{ itemId: "i1", correctAnswer: "A" }],
      questionExplanations: [],
    })
    const res = await saveTrainingAnswer(input)
    expect(res).toMatchObject({ success: true, isCorrect: true })
    expect(mocks.getOpenExamLockedQuestionIds).not.toHaveBeenCalled()
  })
})

describe("setQuestionBookmark", () => {
  it("entree invalide → refus", async () => {
    const res = await setQuestionBookmark({
      questionId: "",
      isBookmarked: true,
    })
    expect(res.success).toBe(false)
  })

  it("pose et retire le signet", async () => {
    expect(
      await setQuestionBookmark({ questionId: "q1", isBookmarked: true }),
    ).toEqual({ success: true })
    expect(
      await setQuestionBookmark({ questionId: "q1", isBookmarked: false }),
    ).toEqual({ success: true })
  })

  it("question inexistante (violation de cle etrangere) → message metier", async () => {
    mocks.getPgErrorCode.mockReturnValueOnce("23503")
    vi.spyOn(fakeDb, "insert").mockImplementationOnce(() => {
      throw new Error("insert violates foreign key")
    })
    const res = await setQuestionBookmark({
      questionId: "q1",
      isBookmarked: true,
    })
    expect(res).toEqual({ success: false, error: "Question introuvable." })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("erreur inattendue → capture", async () => {
    const boom = new Error("boom")
    vi.spyOn(fakeDb, "insert").mockImplementationOnce(() => {
      throw boom
    })
    const res = await setQuestionBookmark({
      questionId: "q1",
      isBookmarked: true,
    })
    expect(res).toEqual({ success: false, error: SERVER_ERROR })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[setQuestionBookmark]",
      boom,
      { userId: "u1" },
    )
  })
})

describe("completeTrainingSession", () => {
  it("id vide → refus", async () => {
    expect(await completeTrainingSession({ sessionId: "" })).toEqual({
      success: false,
      error: "Session requise",
    })
  })

  it.each([
    [{ trainingSessions: [] }, "Session introuvable"],
    [
      { trainingSessions: [openSession({ userId: "autre" })] },
      "Cette session ne vous appartient pas",
    ],
    [
      { trainingSessions: [openSession({ status: "abandoned" })] },
      "Cette session n'est plus active",
    ],
    [
      { trainingSessions: [openSession({ expiresAt: new Date(NOW - 1) })] },
      "Cette session a expiré",
    ],
  ])("refus : %#", async (rows, error) => {
    setRows(rows)
    expect(await completeTrainingSession({ sessionId: "s1" })).toEqual({
      success: false,
      error,
    })
  })

  it("acces expire → refus avant calcul du score", async () => {
    mocks.hasAccess.mockResolvedValueOnce(false)
    setRows({ trainingSessions: [openSession()] })
    expect(await completeTrainingSession({ sessionId: "s1" })).toEqual({
      success: false,
      error: "Votre accès à l'entraînement a expiré.",
    })
  })

  it("calcule le score sur le nombre de questions de la session", async () => {
    setRows({
      trainingSessions: [openSession({ questionCount: 10 })],
      trainingSessionItems: [{ correct: 7 }],
    })
    expect(await completeTrainingSession({ sessionId: "s1" })).toEqual({
      success: true,
      score: 70,
      correctCount: 7,
      totalQuestions: 10,
    })
  })

  // Garde de statut : le cron d'expiration a pu clore la session entre-temps.
  it("cloture concurrente → aucune ligne mise a jour, refus", async () => {
    mocks.returning.current = []
    setRows({
      trainingSessions: [openSession()],
      trainingSessionItems: [{ correct: 1 }],
    })
    expect(await completeTrainingSession({ sessionId: "s1" })).toEqual({
      success: false,
      error: "Cette session n'est plus active",
    })
  })
})

describe("abandonTrainingSession", () => {
  it("id vide → refus", async () => {
    expect(await abandonTrainingSession({ sessionId: "" })).toEqual({
      success: false,
      error: "Session requise",
    })
  })

  it.each([
    [{ trainingSessions: [] }, "Session introuvable"],
    [
      { trainingSessions: [openSession({ userId: "autre" })] },
      "Cette session ne vous appartient pas",
    ],
    [
      { trainingSessions: [openSession({ status: "completed" })] },
      "Cette session n'est pas en cours",
    ],
  ])("refus : %#", async (rows, error) => {
    setRows(rows)
    expect(await abandonTrainingSession({ sessionId: "s1" })).toEqual({
      success: false,
      error,
    })
  })

  it("cloture concurrente → refus plutot qu'ecrasement", async () => {
    mocks.returning.current = []
    setRows({ trainingSessions: [openSession()] })
    expect(await abandonTrainingSession({ sessionId: "s1" })).toEqual({
      success: false,
      error: "Cette session n'est pas en cours",
    })
  })

  it("succes", async () => {
    setRows({ trainingSessions: [openSession()] })
    expect(await abandonTrainingSession({ sessionId: "s1" })).toEqual({
      success: true,
    })
  })
})

describe("deleteTrainingSession", () => {
  it("id vide → refus", async () => {
    expect(await deleteTrainingSession({ sessionId: "" })).toEqual({
      success: false,
      error: "Session requise",
    })
  })

  it.each([
    [{ trainingSessions: [] }, "Session introuvable"],
    [
      { trainingSessions: [openSession({ userId: "autre" })] },
      "Cette session ne vous appartient pas",
    ],
    [
      { trainingSessions: [openSession({ status: "in_progress" })] },
      "Impossible de supprimer une session en cours. Terminez-la ou abandonnez-la d'abord.",
    ],
  ])("refus : %#", async (rows, error) => {
    setRows(rows)
    expect(await deleteTrainingSession({ sessionId: "s1" })).toEqual({
      success: false,
      error,
    })
  })

  it("succes sur une session terminee", async () => {
    setRows({ trainingSessions: [openSession({ status: "completed" })] })
    expect(await deleteTrainingSession({ sessionId: "s1" })).toEqual({
      success: true,
    })
  })
})
