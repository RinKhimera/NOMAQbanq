import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { RefusalCode } from "@/features/attempts/guard"
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
import {
  fakeDb,
  fakeTx,
  rejectWith,
  resetFakeDrizzle,
  setRows,
  state,
} from "../helpers/fake-drizzle"

// Couvre les decisions propres a `actions.ts` : validation zod, ce que l'action
// demande a la garde de tentative (`requireAttempt`, doublee ici — sa politique
// est testee dans tests/attempts/guard.test.ts), le succes et le mapping des
// refus vers un message. Le SQL et la concurrence sont verifies sur une vraie
// base dans tests/integration/training-*.test.ts.
const { mocks } = vi.hoisted(() => ({
  mocks: {
    captureServerError: vi.fn(),
    revalidatePath: vi.fn(),
    session: {
      current: { user: { id: "u1", role: "user" } } as {
        user: { id: string; role: string }
      },
    },
    hasAccess: vi.fn(async () => true),
    requireAttempt: vi.fn(),
    closeAttempts: vi.fn(async () => ["old"]),
    getPgErrorCode: vi.fn<() => string | undefined>(() => undefined),
    lockedIds: { current: new Set<string>() },
    lockFor: vi.fn(),
    getTrainingHistory: vi.fn(async () => ({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    })),
    getAvailableObjectifsCMC: vi.fn(async () => ({ objectifs: [] })),
    getRevisionCounts: vi.fn(async () => ({
      failed: 3,
      unseen: 2,
      bookmarked: 1,
      bookmarkedFailed: 1,
      bookmarkedUnseen: 0,
    })),
    pickRevisionQuestionIds: vi.fn(async () => ["q1"]),
  },
}))

vi.mock("@/db", async () => ({
  db: (await import("../helpers/fake-drizzle")).fakeDb,
}))
vi.mock("@/db/schema", async () => {
  const { table } = await import("../helpers/fake-drizzle")
  return {
    questionBookmarks: table("questionBookmarks"),
    questionExplanations: table("questionExplanations"),
    questions: table("questions"),
    trainingSessionItems: table("trainingSessionItems"),
    trainingSessions: table("trainingSessions"),
    user: table("user"),
  }
})
vi.mock("@/features/attempts/close", () => ({
  closeAttempts: mocks.closeAttempts,
}))
vi.mock("@/features/attempts/guard", async (orig) => {
  const actual = await orig<typeof import("@/features/attempts/guard")>()
  return { ...actual, requireAttempt: mocks.requireAttempt }
})
// Seule la requête du verrou est doublée : le blanchiment testé est le vrai.
vi.mock("@/features/questions/answer-key-lock", async (orig) => {
  const actual =
    await orig<typeof import("@/features/questions/answer-key-lock")>()
  mocks.lockFor.mockImplementation(async () =>
    actual.AnswerKeyLock.fromIds(mocks.lockedIds.current),
  )
  return { ...actual, lockFor: mocks.lockFor }
})
vi.mock("@/features/payments/dal", () => ({ hasAccess: mocks.hasAccess }))
vi.mock("@/features/training/dal", () => ({
  getAvailableObjectifsCMC: mocks.getAvailableObjectifsCMC,
  getTrainingHistory: mocks.getTrainingHistory,
}))
vi.mock("@/features/training/revision", () => ({
  getRevisionCounts: mocks.getRevisionCounts,
  pickRevisionQuestionIds: mocks.pickRevisionQuestionIds,
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

const openAttempt = (extra: Record<string, unknown> = {}) => ({
  ok: true as const,
  attempt: {
    kind: "training" as const,
    id: "s1",
    mode: "test" as const,
    questionCount: 10,
    expiresAt: NOW + 60_000,
    ...extra,
  },
})

const refuse = (code: RefusalCode) =>
  mocks.requireAttempt.mockResolvedValueOnce({ ok: false, code })

beforeEach(() => {
  mocks.session.current = { user: { id: "u1", role: "user" } }
  mocks.lockedIds.current = new Set()
  mocks.requireAttempt.mockReset().mockResolvedValue(openAttempt())
  resetFakeDrizzle([{ id: "s1" }])
  // Aucune option de config ne restaure les faux timers — d'ou l'afterEach.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("lectures gardees", () => {
  it("loadTrainingHistory delegue au DAL apres la garde", async () => {
    await loadTrainingHistory({ page: 3 })
    expect(mocks.getTrainingHistory).toHaveBeenCalledWith({ page: 3 })
  })

  it("loadRevisionCounts : portee invalide → compteurs a zero, pas de requete", async () => {
    const res = await loadRevisionCounts({ domain: "" })
    expect(res).toEqual({
      failed: 0,
      unseen: 0,
      bookmarked: 0,
      bookmarkedFailed: 0,
      bookmarkedUnseen: 0,
    })
    expect(mocks.getRevisionCounts).not.toHaveBeenCalled()
  })

  it("loadRevisionCounts : portee valide → compteurs de l'utilisateur courant", async () => {
    const res = await loadRevisionCounts({ domain: "Cardiologie" })
    expect(mocks.getRevisionCounts).toHaveBeenCalledWith(
      { id: "u1", role: "user" },
      { domain: "Cardiologie" },
    )
    expect(res).toEqual({
      failed: 3,
      unseen: 2,
      bookmarked: 1,
      bookmarkedFailed: 1,
      bookmarkedUnseen: 0,
    })
  })

  it("loadAvailableObjectifsCMC delegue au DAL", async () => {
    await loadAvailableObjectifsCMC("Cardiologie")
    expect(mocks.getAvailableObjectifsCMC).toHaveBeenCalledWith("Cardiologie")
  })
})

describe("createTrainingSession", () => {
  // `mode` est requis par le type d'entree (z.infer, pas z.input).
  const input = { questionCount: 10, mode: "test" as const }
  const freshUser = () =>
    setRows({
      trainingSessions: [],
      user: [{ id: "u1" }],
      questions: [{ n: 50 }],
    })

  it("refuse moins de 5 questions hors revision", async () => {
    const res = await createTrainingSession({ ...input, questionCount: 3 })
    expect(res).toEqual({ success: false, error: "Au moins 5 questions" })
    expect(state.transaction).not.toHaveBeenCalled()
  })

  it("accepte moins de 5 questions en revision (corpus court legitime)", async () => {
    freshUser()
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
    expect(state.transaction).not.toHaveBeenCalled()
  })

  it("admin : pas de garde d'acces payant", async () => {
    mocks.session.current = { user: { id: "adm", role: "admin" } }
    state.transaction.mockResolvedValueOnce(5)
    const res = await createTrainingSession(input)
    expect(res).toMatchObject({ success: true })
    expect(mocks.hasAccess).not.toHaveBeenCalled()
  })

  // Le verrou anti-triche vit dans le tirage lui-meme (excludeLocked) : l'action
  // doit transmettre le lecteur, role compris, sans rien resoudre avant.
  it("revision : transmet le lecteur au tirage", async () => {
    freshUser()
    await createTrainingSession({ ...input, revisionFilters: ["failed"] })
    expect(mocks.pickRevisionQuestionIds).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({
        viewer: { id: "u1", role: "user" },
        criteria: ["failed"],
      }),
    )
  })

  it("succes : renvoie le nombre REELLEMENT retenu", async () => {
    state.transaction.mockResolvedValueOnce(7)
    const res = await createTrainingSession(input)
    expect(res).toMatchObject({ success: true, questionCount: 7 })
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/tableau-de-bord/entrainement",
    )
  })

  it("session en cours non expiree → refus, rien n'est clos", async () => {
    setRows({
      trainingSessions: [{ id: "old", expiresAt: new Date(NOW) }],
      user: [{ id: "u1" }],
    })
    const res = await createTrainingSession(input)
    expect(res).toEqual({
      success: false,
      error:
        "Vous avez déjà une série en cours. Terminez-la ou abandonnez-la pour en commencer une autre.",
    })
    expect(mocks.closeAttempts).not.toHaveBeenCalled()
  })

  it.each([
    [
      "RATE_LIMIT",
      "Trop de séries créées récemment. Réessayez dans une heure.",
    ],
    [
      "NOT_ENOUGH:4",
      "Seulement 4 questions disponibles avec ces filtres. Élargissez la sélection.",
    ],
    [
      "NOT_ENOUGH:1",
      "Seulement 1 question disponible avec ces filtres. Élargissez la sélection.",
    ],
    [
      "NOT_ENOUGH:0",
      "Aucune question ne correspond à ces filtres. Élargissez la sélection.",
    ],
  ])("%s → message dedie, sans capture", async (thrown, error) => {
    rejectWith(thrown)
    const res = await createTrainingSession(input)
    expect(res).toEqual({ success: false, error })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("erreur inattendue → capture avec l'utilisateur", async () => {
    rejectWith("pool exhausted")
    const res = await createTrainingSession(input)
    expect(res).toEqual({ success: false, error: SERVER_ERROR })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[createTrainingSession]",
      expect.any(Error),
      { userId: "u1" },
    )
  })

  it("revision sans question disponible → message dedie", async () => {
    freshUser()
    mocks.pickRevisionQuestionIds.mockResolvedValueOnce([])
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
  const item = { itemId: "i1", correctAnswer: "A", options: ["A", "B"] }

  it("entree invalide → refus avant lecture", async () => {
    const res = await saveTrainingAnswer({ ...input, selectedAnswer: "" })
    expect(res.success).toBe(false)
    expect(mocks.requireAttempt).not.toHaveBeenCalled()
  })

  it("demande la garde `answer` sur la session, pour l'acteur courant, dans la transaction", async () => {
    setRows({ trainingSessionItems: [item] })
    await saveTrainingAnswer(input)
    expect(mocks.requireAttempt).toHaveBeenCalledWith(fakeTx, {
      kind: "training",
      ref: "s1",
      actor: { id: "u1", role: "user" },
      now: NOW,
      verb: "answer",
    })
  })

  it("refus de la garde → message, aucune ecriture", async () => {
    refuse("EXPIRED")
    expect(await saveTrainingAnswer(input)).toEqual({
      success: false,
      error: "Cette série a expiré",
    })
    expect(state.set).toBeUndefined()
  })

  it("question hors session", async () => {
    setRows({ trainingSessionItems: [] })
    expect(await saveTrainingAnswer(input)).toEqual({
      success: false,
      error: "Cette question ne fait pas partie de la série",
    })
  })

  it("texte hors options → refus OPTION_CHANGED, aucune ecriture", async () => {
    setRows({ trainingSessionItems: [item] })
    expect(
      await saveTrainingAnswer({ ...input, selectedAnswer: "A " }),
    ).toMatchObject({
      success: false,
      code: "OPTION_CHANGED",
      error: expect.stringContaining("Rechargez"),
    })
    expect(state.set).toBeUndefined()
  })

  it("mode tuteur : revele la correction et l'explication", async () => {
    mocks.requireAttempt.mockResolvedValueOnce(openAttempt({ mode: "tutor" }))
    setRows({
      trainingSessionItems: [item],
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
    mocks.requireAttempt.mockResolvedValueOnce(openAttempt({ mode: "tutor" }))
    setRows({
      trainingSessionItems: [
        { itemId: "i1", correctAnswer: "B", options: ["A", "B"] },
      ],
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

  // Le bypass admin est la decision du verrou (tests/questions/answer-key-lock)
  // et de la garde ; l'action doit seulement leur transmettre le role.
  it("admin : le role est transmis au verrou et a la garde", async () => {
    mocks.session.current = { user: { id: "u1", role: "admin" } }
    mocks.requireAttempt.mockResolvedValueOnce(openAttempt({ mode: "tutor" }))
    setRows({ trainingSessionItems: [item], questionExplanations: [] })
    const res = await saveTrainingAnswer(input)
    expect(res).toMatchObject({ success: true, isCorrect: true })
    expect(mocks.lockFor).toHaveBeenCalledWith({ id: "u1", role: "admin" }, [
      "q1",
    ])
    expect(mocks.requireAttempt).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({ actor: { id: "u1", role: "admin" } }),
    )
  })

  it("panne base → capture", async () => {
    rejectWith("boom")
    expect(await saveTrainingAnswer(input)).toEqual({
      success: false,
      error: SERVER_ERROR,
    })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[saveTrainingAnswer]",
      expect.any(Error),
      { userId: "u1" },
    )
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
      error: "Série requise",
    })
    expect(mocks.requireAttempt).not.toHaveBeenCalled()
  })

  it("demande la garde `close`", async () => {
    await completeTrainingSession({ sessionId: "s1" })
    expect(mocks.requireAttempt).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({ ref: "s1", verb: "close" }),
    )
  })

  it("refus de la garde → message, aucune cloture", async () => {
    refuse("ACCESS_EXPIRED")
    expect(await completeTrainingSession({ sessionId: "s1" })).toEqual({
      success: false,
      error: "Votre accès à l'entraînement a expiré.",
    })
    expect(mocks.closeAttempts).not.toHaveBeenCalled()
  })

  // La clôture (score sur le nombre de questions tiré) appartient à
  // `closeAttempts`, prouvé dans tests/integration/attempt-close : l'action ne
  // porte que le mapping vers la tentative verrouillée.
  it("clôt la tentative verrouillée en completed, sous la transaction", async () => {
    expect(await completeTrainingSession({ sessionId: "s1" })).toEqual({
      success: true,
    })
    // Le décompte ne repart pas vers le navigateur : le score se lit en base.
    expect(mocks.closeAttempts).toHaveBeenCalledWith(fakeTx, {
      kind: "training",
      status: "completed",
      now: new Date(NOW),
      where: { id: "s1" },
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/tableau-de-bord/entrainement",
    )
  })
})

describe("abandonTrainingSession", () => {
  it("id vide → refus", async () => {
    expect(await abandonTrainingSession({ sessionId: "" })).toEqual({
      success: false,
      error: "Série requise",
    })
  })

  it("demande la garde `abandon`", async () => {
    await abandonTrainingSession({ sessionId: "s1" })
    expect(mocks.requireAttempt).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({ ref: "s1", verb: "abandon" }),
    )
  })

  it("refus de la garde → message, aucune ecriture", async () => {
    refuse("NOT_IN_PROGRESS")
    expect(await abandonTrainingSession({ sessionId: "s1" })).toEqual({
      success: false,
      error: "Cette série n'est plus active",
    })
    expect(state.set).toBeUndefined()
  })

  it("succes", async () => {
    expect(await abandonTrainingSession({ sessionId: "s1" })).toEqual({
      success: true,
    })
    expect(state.set).toEqual({ status: "abandoned" })
  })
})

describe("deleteTrainingSession", () => {
  const session = (extra: Record<string, unknown> = {}) => ({
    userId: "u1",
    status: "completed",
    ...extra,
  })

  it("id vide → refus", async () => {
    expect(await deleteTrainingSession({ sessionId: "" })).toEqual({
      success: false,
      error: "Série requise",
    })
  })

  // La propriété vit dans le WHERE (id, userId) : la ligne d'autrui est
  // invisible à la lecture comme à la suppression, donc `Série introuvable`
  // — jamais « ne vous appartient pas », qui confirmerait son existence.
  it.each([
    [{ trainingSessions: [] }, "Série introuvable"],
    [
      { trainingSessions: [session({ status: "in_progress" })] },
      "Impossible de supprimer une série en cours. Terminez-la ou abandonnez-la d'abord.",
    ],
  ])("refus : %#", async (rows, error) => {
    setRows(rows)
    expect(await deleteTrainingSession({ sessionId: "s1" })).toEqual({
      success: false,
      error,
    })
  })

  it("succes sur une session terminee", async () => {
    setRows({ trainingSessions: [session()] })
    expect(await deleteTrainingSession({ sessionId: "s1" })).toEqual({
      success: true,
    })
  })
})
