import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createQuestion,
  deleteQuestion,
  loadQuestionsForExport,
  loadRandomQuizQuestions,
  scoreQuizAnswers,
  updateQuestion,
} from "@/features/questions/actions"
import { resetFakeDrizzle, state } from "../helpers/fake-drizzle"

// Couvre les decisions propres a `actions.ts` : refus silencieux du quiz public
// (aucun oracle sur la raison), arbitrage hard/soft de la suppression, et mapping
// des erreurs metier. Le SQL et les cascades sont verifies sur une vraie base
// dans tests/integration/questions-*.test.ts, delete-question.test.ts.
const { mocks } = vi.hoisted(() => ({
  mocks: {
    captureServerError: vi.fn(),
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
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
    signQuizToken: vi.fn(() => "tok"),
    verifyQuizToken: vi.fn<() => Set<string> | null>(() => new Set(["q1"])),
    tryDeleteFromStorage: vi.fn(async () => undefined),
    requireRole: vi.fn(async () => ({ user: { id: "adm", role: "admin" } })),
  },
}))

vi.mock("@/db", async () => ({
  db: (await import("../helpers/fake-drizzle")).fakeDb,
}))
vi.mock("@/db/schema", async () => {
  const { table } = await import("../helpers/fake-drizzle")
  return {
    examQuestions: table("examQuestions"),
    exams: table("exams"),
    questionExplanations: table("questionExplanations"),
    questionImages: table("questionImages"),
    questions: table("questions"),
  }
})
vi.mock("@/features/analytics/dal", () => ({
  getQuestionAnswerBreakdown: vi.fn(),
}))
// Seule la requête du verrou est doublée : le blanchiment testé est le vrai.
vi.mock("@/features/questions/answer-key-lock", async (orig) => {
  const actual =
    await orig<typeof import("@/features/questions/answer-key-lock")>()
  return { ...actual, lockFor: vi.fn(async () => actual.AnswerKeyLock.none()) }
})
vi.mock("@/features/questions/dal", () => ({
  getQuestionById: vi.fn(async () => null),
  getQuestionsForExport: mocks.getQuestionsForExport,
  getQuestionsWithFilters: vi.fn(async () => ({ items: [] })),
  getQuizAnswerKey: mocks.getQuizAnswerKey,
  getRandomQuizQuestions: mocks.getRandomQuizQuestions,
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
vi.mock("@/lib/db-errors", () => ({
  getPgErrorCode: mocks.getPgErrorCode,
  isPgUniqueViolation: () => mocks.getPgErrorCode() === "23505",
}))
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
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
}))

const SERVER_ERROR = "Erreur serveur. Réessayez."
const EMPTY_SCORE = { score: 0, totalQuestions: 0, questionResults: [] }

const questionInput = {
  question: "Quelle est la reponse ?",
  options: ["A", "B", "C", "D"],
  correctAnswer: "A",
  explanation: "parce que",
  objectiveId: "obj-1",
  domain: "Cardiologie",
}

const answerKey = (correctAnswer: string) => ({
  correctAnswer,
  explanation: "parce que",
  references: [],
  explanationImages: [],
})

beforeEach(() => {
  resetFakeDrizzle([{ id: "q1" }])
  // Le corps des transactions n'est pas exécuté : chaque test pose ce que la
  // transaction rend ou lève.
  state.transaction.mockResolvedValue(undefined)
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

  it("aucune question disponible → pas de jeton signe", async () => {
    const res = await loadRandomQuizQuestions({ count: 5 })
    expect(res).toEqual({ questions: [], token: null })
    expect(mocks.signQuizToken).not.toHaveBeenCalled()
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
      error: "La clé de réponse doit figurer parmi les choix",
    })
    expect(state.transaction).not.toHaveBeenCalled()
  })

  it("succes : revalide la liste admin, les stats publiques et les objectifs de la vitrine", async () => {
    const res = await createQuestion(questionInput)
    expect(res).toMatchObject({ success: true })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/questions")
    expect(mocks.revalidateTag).toHaveBeenCalledWith("marketing-stats", "max")
    expect(mocks.revalidateTag).toHaveBeenCalledWith("objectives", "max")
  })

  it("erreur inattendue → capture", async () => {
    state.transaction.mockRejectedValueOnce(new Error("boom"))
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
    expect(state.transaction).not.toHaveBeenCalled()
  })

  it("question supprimee ou inexistante → message metier, sans capture", async () => {
    state.transaction.mockRejectedValueOnce(new Error("Q_NOT_FOUND"))
    const res = await updateQuestion(input)
    expect(res).toEqual({ success: false, error: "Question introuvable" })
    expect(mocks.captureServerError).not.toHaveBeenCalled()
  })

  it("succes : revalide la liste, le détail et les stats publiques", async () => {
    const res = await updateQuestion(input)
    expect(res).toEqual({ success: true })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/questions/q1")
    expect(mocks.revalidateTag).toHaveBeenCalledWith("marketing-stats", "max")
  })

  // La transaction rend « domaine ou objectif changé » : seule cette
  // modification touche ce qu'affiche une page domaine.
  it("domaine et objectif inchangés : les objectifs de la vitrine gardent leur cache", async () => {
    state.transaction.mockResolvedValueOnce(false)
    await updateQuestion(input)
    expect(mocks.revalidateTag).not.toHaveBeenCalledWith("objectives", "max")
  })

  it("domaine ou objectif changé : les objectifs de la vitrine sont invalidés", async () => {
    state.transaction.mockResolvedValueOnce(true)
    await updateQuestion(input)
    expect(mocks.revalidateTag).toHaveBeenCalledWith("objectives", "max")
  })

  it("erreur inattendue → capture", async () => {
    state.transaction.mockRejectedValueOnce(new Error("boom"))
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
    expect(state.transaction).not.toHaveBeenCalled()
  })

  it("question non referencee → hard delete + purge S3 des images", async () => {
    state.transaction.mockResolvedValueOnce(["questions/q1/a.jpg"])
    const res = await deleteQuestion("q1")
    expect(res).toEqual({ success: true, mode: "hard" })
    expect(mocks.tryDeleteFromStorage).toHaveBeenCalledWith(
      "questions/q1/a.jpg",
    )
    expect(mocks.revalidateTag).toHaveBeenCalledWith("marketing-stats", "max")
    expect(mocks.revalidateTag).toHaveBeenCalledWith("objectives", "max")
  })

  // Le DELETE echoue sur une FK restrict (question deja passee en examen) :
  // l'action bascule en soft delete, medias CONSERVES.
  it.each(["23001", "23503"])(
    "violation de FK %s → repli en soft delete",
    async (code) => {
      state.transaction.mockRejectedValueOnce(new Error("restrict violation"))
      mocks.getPgErrorCode.mockReturnValueOnce(code)
      const res = await deleteQuestion("q1")
      expect(res).toEqual({ success: true, mode: "soft" })
      expect(mocks.tryDeleteFromStorage).not.toHaveBeenCalled()
      expect(mocks.revalidateTag).toHaveBeenCalledWith("marketing-stats", "max")
      expect(mocks.revalidateTag).toHaveBeenCalledWith("objectives", "max")
      expect(mocks.captureServerError).not.toHaveBeenCalled()
    },
  )

  it("soft delete sans ligne touchee (deja supprimee) → message metier", async () => {
    state.transaction.mockRejectedValueOnce(new Error("restrict violation"))
    mocks.getPgErrorCode.mockReturnValueOnce("23001")
    state.returning = []
    expect(await deleteQuestion("q1")).toEqual({
      success: false,
      error: "Question introuvable",
    })
    expect(mocks.revalidateTag).not.toHaveBeenCalled()
  })

  it("erreur non-FK → capture, pas de repli", async () => {
    state.transaction.mockRejectedValueOnce(new Error("connection terminated"))
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
    const filters = {
      domain: "Cardiologie",
      toVerify: true,
      usageFilter: "unused" as const,
      usedInExamId: "exam-1",
    }
    await loadQuestionsForExport(filters)
    expect(mocks.requireRole).toHaveBeenCalledWith(["admin"])
    expect(mocks.getQuestionsForExport).toHaveBeenCalledWith(filters)
  })
})
