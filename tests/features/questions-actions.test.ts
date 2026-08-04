import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createQuestion,
  deleteQuestion,
  loadQuestionsForExport,
  loadRandomQuizQuestions,
  scoreQuizAnswers,
  updateQuestion,
} from "@/features/questions/actions"

// Couvre les decisions propres a `actions.ts` : refus silencieux du quiz public
// (aucun oracle sur la raison), arbitrage hard/soft de la suppression, et mapping
// des erreurs metier. Le SQL et les cascades sont verifies sur une vraie base
// dans tests/integration/questions-*.test.ts.
//
// `vi.mock` etant hoiste, le faux `db` vient de `vi.hoisted`.
const { mocks, fakeDb, table } = vi.hoisted(() => {
  const mocks = {
    captureServerError: vi.fn(),
    revalidatePath: vi.fn(),
    transaction:
      vi.fn<(cb: (tx: unknown) => Promise<unknown>) => Promise<unknown>>(),
    rows: { current: {} as Record<string, unknown[]> },
    returning: { current: [] as unknown[] },
    getPgErrorCode: vi.fn<() => string | undefined>(() => undefined),
    getClientIpKey: vi.fn(async () => "ip:1.2.3.4"),
    consumeQuizRateLimit: vi.fn(async () => true),
    getRandomQuizQuestions: vi.fn(async () => [] as { _id: string }[]),
    getQuizAnswerKey: vi.fn(
      async () =>
        new Map<
          string,
          {
            correctAnswer: string
            explanation: string
            references: string[]
            explanationImages: unknown[]
          }
        >(),
    ),
    getQuestionsForExport: vi.fn(async () => []),
    getOpenExamQuestionIds: vi.fn(async () => new Set<string>()),
    signQuizToken: vi.fn(() => "tok"),
    verifyQuizToken: vi.fn<() => Set<string> | null>(() => new Set(["q1"])),
    tryDeleteFromStorage: vi.fn(async () => undefined),
    requireRole: vi.fn(async () => ({ user: { id: "adm", role: "admin" } })),
  }

  const table = (name: string) => ({ __table: name })

  const queryChain = (initialTable?: string) => {
    let target = initialTable
    const chain: Record<string, unknown> = {
      from: (t: { __table?: string }) => {
        target = t?.__table
        return chain
      },
      where: () => chain,
      set: () => chain,
      values: () => chain,
      limit: () => chain,
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
  questionExplanations: table("questionExplanations"),
  questionImages: table("questionImages"),
  questions: table("questions"),
}))
vi.mock("@/features/exams/dal", () => ({
  getOpenExamQuestionIds: mocks.getOpenExamQuestionIds,
}))
vi.mock("@/features/questions/dal", () => ({
  getAllQuestionIds: vi.fn(async () => []),
  getQuestionById: vi.fn(async () => null),
  getQuestionsForExport: mocks.getQuestionsForExport,
  getQuestionsWithFilters: vi.fn(async () => ({ items: [] })),
  getQuizAnswerKey: mocks.getQuizAnswerKey,
  getRandomQuizQuestions: mocks.getRandomQuizQuestions,
  getUniqueObjectifsCMC: vi.fn(async () => []),
}))
vi.mock("@/features/questions/quiz-token", () => ({
  signQuizToken: mocks.signQuizToken,
  verifyQuizToken: mocks.verifyQuizToken,
}))
vi.mock("@/lib/auth-guards", () => ({ requireRole: mocks.requireRole }))
vi.mock("@/lib/aws", () => ({
  copyInS3: vi.fn(async () => undefined),
  createPresignedUpload: vi.fn(async () => ({ url: "", fields: {} })),
}))
vi.mock("@/lib/db-errors", () => ({ getPgErrorCode: mocks.getPgErrorCode }))
vi.mock("@/lib/observability", () => ({
  captureServerError: mocks.captureServerError,
}))
vi.mock("@/lib/quiz-rate-limit", () => ({
  consumeQuizRateLimit: mocks.consumeQuizRateLimit,
  getClientIpKey: mocks.getClientIpKey,
}))
vi.mock("@/lib/storage", () => ({
  assertSafeStoragePath: vi.fn(),
  finalPathFromTmp: (p: string) => p.replace("tmp/", "questions/"),
  generateQuestionImageTmpPath: vi.fn(() => "tmp/x.jpg"),
  getExtensionFromMimeType: vi.fn(() => "jpg"),
  isStorageConfigured: vi.fn(() => true),
  tryDeleteFromStorage: mocks.tryDeleteFromStorage,
  validateImageFile: vi.fn(() => null),
}))
vi.mock("@/lib/upload-rate-limit", () => ({
  consumeUploadRateLimit: vi.fn(async () => true),
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

const SERVER_ERROR = "Erreur serveur. Réessayez."
const EMPTY_SCORE = { score: 0, totalQuestions: 0, questionResults: [] }

const questionInput = {
  question: "Quelle est la reponse ?",
  options: ["A", "B"],
  correctAnswer: "A",
  explanation: "parce que",
  objectifCMC: "1-1",
  domain: "Cardiologie",
}

const answerKey = (correctAnswer: string) => ({
  correctAnswer,
  explanation: "parce que",
  references: [],
  explanationImages: [],
})

beforeEach(() => {
  mocks.rows.current = {}
  mocks.returning.current = [{ id: "q1" }]
  mocks.transaction.mockResolvedValue(undefined)
})

describe("loadRandomQuizQuestions — refus silencieux", () => {
  // zod passe AVANT le rate-limit : une entree malformee ne consomme pas de slot.
  // (Le nombre demande, lui, est borne plus loin par `clamp(count, 1, 10)` dans
  // la DAL — le schema ne valide que le type.)
  it("count non entier → bundle vide, sans consommer de slot de rate-limit", async () => {
    const res = await loadRandomQuizQuestions({ count: 1.5 })
    expect(res).toEqual({ questions: [], token: null })
    expect(mocks.consumeQuizRateLimit).not.toHaveBeenCalled()
  })

  it("rate-limit atteint → bundle vide, aucune requete", async () => {
    mocks.consumeQuizRateLimit.mockResolvedValueOnce(false)
    const res = await loadRandomQuizQuestions({ count: 5 })
    expect(res).toEqual({ questions: [], token: null })
    expect(mocks.getRandomQuizQuestions).not.toHaveBeenCalled()
  })

  it("aucune question disponible → pas de jeton signe", async () => {
    const res = await loadRandomQuizQuestions({ count: 5 })
    expect(res).toEqual({ questions: [], token: null })
    expect(mocks.signQuizToken).not.toHaveBeenCalled()
  })

  it("succes → jeton couvrant exactement les ids servis", async () => {
    mocks.getRandomQuizQuestions.mockResolvedValueOnce([
      { _id: "q1" },
      { _id: "q2" },
    ])
    const res = await loadRandomQuizQuestions({ count: 5 })
    expect(mocks.signQuizToken).toHaveBeenCalledWith(["q1", "q2"])
    expect(res.token).toBe("tok")
  })
})

describe("scoreQuizAnswers — anti-triche", () => {
  const args = {
    answers: [{ questionId: "q1", selectedAnswer: "A" }],
    token: "tok",
  }

  it("entree invalide → score vide", async () => {
    const res = await scoreQuizAnswers({ answers: [], token: "" })
    expect(res).toEqual(EMPTY_SCORE)
  })

  it("rate-limit atteint → score vide, jeton jamais verifie", async () => {
    mocks.consumeQuizRateLimit.mockResolvedValueOnce(false)
    expect(await scoreQuizAnswers(args)).toEqual(EMPTY_SCORE)
    expect(mocks.verifyQuizToken).not.toHaveBeenCalled()
  })

  it("jeton invalide ou expire → score vide", async () => {
    mocks.verifyQuizToken.mockReturnValueOnce(null)
    expect(await scoreQuizAnswers(args)).toEqual(EMPTY_SCORE)
    expect(mocks.getQuizAnswerKey).not.toHaveBeenCalled()
  })

  // Le jeton couvre les ids servis : repondre a une question jamais servie ne
  // doit rien reveler.
  it("question non servie par ce bundle → ignoree", async () => {
    mocks.verifyQuizToken.mockReturnValueOnce(new Set(["q9"]))
    expect(await scoreQuizAnswers(args)).toEqual(EMPTY_SCORE)
    expect(mocks.getQuizAnswerKey).not.toHaveBeenCalled()
  })

  it("doublon dans les reponses → compte une seule fois", async () => {
    mocks.verifyQuizToken.mockReturnValueOnce(new Set(["q1"]))
    mocks.getQuizAnswerKey.mockResolvedValueOnce(
      new Map([["q1", answerKey("A")]]),
    )
    const res = await scoreQuizAnswers({
      answers: [
        { questionId: "q1", selectedAnswer: "A" },
        { questionId: "q1", selectedAnswer: "A" },
      ],
      token: "tok",
    })
    expect(res.totalQuestions).toBe(1)
    expect(res.score).toBe(1)
  })

  // Un examen a pu OUVRIR pendant la vie du jeton : la cle reste verrouillee.
  it("question d'un examen ouvert → exclue de la demande de cle", async () => {
    mocks.verifyQuizToken.mockReturnValueOnce(new Set(["q1", "q2"]))
    mocks.getOpenExamQuestionIds.mockResolvedValueOnce(new Set(["q1"]))
    mocks.getQuizAnswerKey.mockResolvedValueOnce(
      new Map([["q2", answerKey("B")]]),
    )
    const res = await scoreQuizAnswers({
      answers: [
        { questionId: "q1", selectedAnswer: "A" },
        { questionId: "q2", selectedAnswer: "B" },
      ],
      token: "tok",
    })
    expect(mocks.getQuizAnswerKey).toHaveBeenCalledWith(["q2"])
    expect(res.questionResults.map((r) => r.questionId)).toEqual(["q2"])
    expect(res.totalQuestions).toBe(1)
  })

  it("mauvaise reponse → resultat renvoye, score non incremente", async () => {
    mocks.verifyQuizToken.mockReturnValueOnce(new Set(["q1"]))
    mocks.getQuizAnswerKey.mockResolvedValueOnce(
      new Map([["q1", answerKey("B")]]),
    )
    const res = await scoreQuizAnswers(args)
    expect(res.score).toBe(0)
    expect(res.questionResults[0]).toMatchObject({
      questionId: "q1",
      isCorrect: false,
      correctAnswer: "B",
    })
  })
})

describe("createQuestion", () => {
  it("bonne reponse absente des options → refus", async () => {
    const res = await createQuestion({
      ...questionInput,
      correctAnswer: "Z",
    })
    expect(res).toEqual({
      success: false,
      error: "La bonne réponse doit figurer parmi les options",
    })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("succes : revalide la liste admin", async () => {
    const res = await createQuestion(questionInput)
    expect(res).toMatchObject({ success: true })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/questions")
  })

  it("erreur inattendue → capture", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("boom"))
    const res = await createQuestion(questionInput)
    expect(res).toEqual({ success: false, error: SERVER_ERROR })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[createQuestion]",
      expect.any(Error),
    )
  })
})

describe("updateQuestion", () => {
  const input = { id: "q1", ...questionInput }

  it("entree invalide → refus avant transaction", async () => {
    const res = await updateQuestion({ ...input, question: "  " })
    expect(res.success).toBe(false)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("question supprimee ou inexistante → message metier, sans capture", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("Q_NOT_FOUND"))
    const res = await updateQuestion(input)
    expect(res).toEqual({ success: false, error: "Question introuvable" })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("succes : revalide la liste et la page d'edition", async () => {
    const res = await updateQuestion(input)
    expect(res).toEqual({ success: true })
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/admin/questions/q1/modifier",
    )
  })

  it("erreur inattendue → capture", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("boom"))
    const res = await updateQuestion(input)
    expect(res).toEqual({ success: false, error: SERVER_ERROR })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[updateQuestion]",
      expect.any(Error),
    )
  })
})

describe("deleteQuestion — arbitrage hard/soft par les FK", () => {
  it("id vide → refus", async () => {
    expect(await deleteQuestion("")).toEqual({
      success: false,
      error: "Question requise",
    })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("question non referencee → hard delete + purge S3 des images", async () => {
    mocks.transaction.mockResolvedValueOnce(["questions/q1/a.jpg"])
    const res = await deleteQuestion("q1")
    expect(res).toEqual({ success: true, mode: "hard" })
    expect(mocks.tryDeleteFromStorage).toHaveBeenCalledWith(
      "questions/q1/a.jpg",
    )
  })

  it("question inexistante → message metier, aucun soft delete tente", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("Q_NOT_FOUND"))
    expect(await deleteQuestion("q1")).toEqual({
      success: false,
      error: "Question introuvable",
    })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  // Le DELETE echoue sur une FK restrict (question deja passee en examen) :
  // l'action bascule en soft delete, medias CONSERVES.
  it.each(["23001", "23503"])(
    "violation de FK %s → repli en soft delete",
    async (code) => {
      mocks.transaction.mockRejectedValueOnce(new Error("restrict violation"))
      mocks.getPgErrorCode.mockReturnValueOnce(code)
      const res = await deleteQuestion("q1")
      expect(res).toEqual({ success: true, mode: "soft" })
      expect(mocks.tryDeleteFromStorage).not.toHaveBeenCalled()
      expect(mocks.captureServerError).not.toHaveBeenCalled()
    },
  )

  it("soft delete sans ligne touchee (deja supprimee) → message metier", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("restrict violation"))
    mocks.getPgErrorCode.mockReturnValueOnce("23001")
    mocks.returning.current = []
    expect(await deleteQuestion("q1")).toEqual({
      success: false,
      error: "Question introuvable",
    })
  })

  it("erreur non-FK → capture, pas de repli", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("connection terminated"))
    const res = await deleteQuestion("q1")
    expect(res).toEqual({ success: false, error: SERVER_ERROR })
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[deleteQuestion]",
      expect.any(Error),
    )
  })
})

describe("loadQuestionsForExport", () => {
  it("exige le role admin puis delegue les filtres", async () => {
    await loadQuestionsForExport({ domain: "Cardiologie" })
    expect(mocks.requireRole).toHaveBeenCalledWith(["admin"])
    expect(mocks.getQuestionsForExport).toHaveBeenCalledWith({
      domain: "Cardiologie",
    })
  })
})
