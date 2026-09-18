import type { SQL } from "drizzle-orm"
import { PgDialect } from "drizzle-orm/pg-core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type RefusalCode, refusalMessage } from "@/features/attempts/guard"
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
    expireTrainingSessions: vi.fn(async () => ({ closedCount: 1 })),
    getPgErrorCode: vi.fn<() => string | undefined>(() => undefined),
    lockedIds: { current: new Set<string>() },
    lockFor: vi.fn(),
    getTrainingHistory: vi.fn(async () => ({ items: [], nextCursor: null })),
    getAvailableObjectifsCMC: vi.fn(async () => ({ objectifs: [] })),
    getRevisionCounts: vi.fn(async () => ({
      failed: 3,
      unseen: 2,
      bookmarked: 1,
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
vi.mock("@/features/training/cron", () => ({
  expireTrainingSessions: mocks.expireTrainingSessions,
}))
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
const REFUSALS: RefusalCode[] = [
  "NOT_FOUND",
  "NOT_IN_PROGRESS",
  "EXPIRED",
  "ACCESS_EXPIRED",
]

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
    expect(mocks.getRevisionCounts).toHaveBeenCalledWith(
      { id: "u1", role: "user" },
      { domain: "Cardiologie" },
    )
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

  // La session expiree qui barre la place est close par L'ECRIVAIN DU CRON
  // (scoree, `completedAt` pose), sous le verrou de la transaction courante.
  it("session en cours expiree → cloture scoree par l'ecrivain du cron, puis creation", async () => {
    setRows({
      trainingSessions: [{ id: "old", expiresAt: new Date(NOW - 1) }],
      user: [{ id: "u1" }],
      questions: [{ n: 50 }],
    })
    const res = await createTrainingSession(input)
    expect(res).toMatchObject({ success: true })
    expect(mocks.expireTrainingSessions).toHaveBeenCalledWith(fakeTx, {
      now: new Date(NOW),
      sessionId: "old",
    })
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
        "Vous avez déjà une session en cours. Terminez-la ou attendez son expiration.",
    })
    expect(mocks.expireTrainingSessions).not.toHaveBeenCalled()
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
  const item = { itemId: "i1", correctAnswer: "A" }

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

  it.each(REFUSALS)("refus %s → message, aucune ecriture", async (code) => {
    refuse(code)
    expect(await saveTrainingAnswer(input)).toEqual({
      success: false,
      error: refusalMessage(code, "training"),
    })
    expect(state.set).toBeUndefined()
  })

  it("question hors session", async () => {
    setRows({ trainingSessionItems: [] })
    expect(await saveTrainingAnswer(input)).toEqual({
      success: false,
      error: "Cette question ne fait pas partie de la session",
    })
  })

  it("mode test : enregistre la reponse sans jamais exposer isCorrect (anti-triche)", async () => {
    setRows({ trainingSessionItems: [item] })
    expect(await saveTrainingAnswer(input)).toEqual({ success: true })
    expect(state.set).toMatchObject({ selectedAnswer: "A", isCorrect: true })
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
  it("mode tuteur, question verrouillee par un examen ouvert → cle retenue, pas de correction", async () => {
    mocks.requireAttempt.mockResolvedValueOnce(openAttempt({ mode: "tutor" }))
    mocks.lockedIds.current = new Set(["q1"])
    setRows({ trainingSessionItems: [item] })
    expect(await saveTrainingAnswer(input)).toEqual({
      success: true,
      reveal: { keyWithheld: true },
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
    expect(mocks.requireAttempt).not.toHaveBeenCalled()
  })

  it("demande la garde `close`", async () => {
    setRows({ trainingSessionItems: [{ correct: 7 }] })
    await completeTrainingSession({ sessionId: "s1" })
    expect(mocks.requireAttempt).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({ ref: "s1", verb: "close" }),
    )
  })

  it.each(REFUSALS)("refus %s → message, aucune ecriture", async (code) => {
    refuse(code)
    expect(await completeTrainingSession({ sessionId: "s1" })).toEqual({
      success: false,
      error: refusalMessage(code, "training"),
    })
    expect(state.set).toBeUndefined()
  })

  it("calcule le score sur le nombre de questions de la session", async () => {
    setRows({ trainingSessionItems: [{ correct: 7 }] })
    expect(await completeTrainingSession({ sessionId: "s1" })).toEqual({
      success: true,
    })
    // Le décompte ne repart pas vers le navigateur : le score se lit en base.
    expect(state.set).toMatchObject({
      status: "completed",
      score: 70,
      completedAt: new Date(NOW),
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
      error: "Session requise",
    })
  })

  it("demande la garde `abandon`", async () => {
    await abandonTrainingSession({ sessionId: "s1" })
    expect(mocks.requireAttempt).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({ ref: "s1", verb: "abandon" }),
    )
  })

  it.each(["NOT_FOUND", "NOT_IN_PROGRESS"] as const)(
    "refus %s → message, aucune ecriture",
    async (code) => {
      refuse(code)
      expect(await abandonTrainingSession({ sessionId: "s1" })).toEqual({
        success: false,
        error: refusalMessage(code, "training"),
      })
      expect(state.set).toBeUndefined()
    },
  )

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
      error: "Session requise",
    })
  })

  // La propriété vit dans le WHERE (id, userId) : la ligne d'autrui est
  // invisible à la lecture comme à la suppression, donc `Session introuvable`
  // — jamais « ne vous appartient pas », qui confirmerait son existence.
  it.each([
    [{ trainingSessions: [] }, "Session introuvable"],
    [
      { trainingSessions: [session({ status: "in_progress" })] },
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
    setRows({ trainingSessions: [session()] })
    expect(await deleteTrainingSession({ sessionId: "s1" })).toEqual({
      success: true,
    })
  })

  it("le DELETE porte la propriété dans son WHERE (id ET utilisateur)", async () => {
    setRows({ trainingSessions: [session()] })
    await deleteTrainingSession({ sessionId: "s1" })
    const { params } = new PgDialect().sqlToQuery(state.deleteWhere as SQL)
    expect(params).toEqual(expect.arrayContaining(["s1", "u1"]))
  })
})
