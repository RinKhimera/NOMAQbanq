import { eq, inArray } from "drizzle-orm"
import { headers } from "next/headers"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examQuestions,
  exams,
  questionExplanations,
  questionImages,
  questions,
  quizRateLimits,
  user,
} from "@/db/schema"
import { getOpenExamQuestionIds } from "@/features/exams/dal"
import {
  loadRandomQuizQuestions,
  scoreQuizAnswers,
} from "@/features/questions/actions"
import {
  getQuizAnswerKey,
  getRandomQuizQuestions,
} from "@/features/questions/dal"
import { signQuizToken, verifyQuizToken } from "@/features/questions/quiz-token"
import { createId } from "@/lib/ids"
import { getClientIpKey } from "@/lib/quiz-rate-limit"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/headers", () => ({ headers: vi.fn() }))

// Chaque test prend une "IP" unique (chaîne arbitraire : elle est HMAC-ée) →
// compteurs indépendants entre tests. Les IPs utilisées sont tracées pour le
// cleanup (les clés stockées sont des HMAC, non corrélables sans re-calcul).
// `setIpHeader` (mock seul, ne mute PAS usedIps) est ce que le cleanup
// utilise — itérer usedIps avec une fonction qui y push serait une boucle
// infinie (revue design 2026-07-09, constat #3).
const usedIps: string[] = []
const setIpHeader = (ip: string) =>
  vi
    .mocked(headers)
    .mockResolvedValue(new Headers({ "x-forwarded-for": ip }) as never)
const withIp = (ip: string) => {
  usedIps.push(ip)
  setIpHeader(ip)
}

const suffix = createId().slice(0, 8)
const DOMAIN = `QUIZ-${suffix}`

// qImg : 2 images, bonne réponse "A". q2 : aucune image, bonne réponse "B".
const qImg = createId()
const q2 = createId()
const ids = [qImg, q2, createId(), createId(), createId()] // 5 au total

// qOpen appartient à un examen OUVERT (endDate future) → verrouillée pour le
// canal public ; qClosed appartient à un examen CLOS uniquement → témoin
// (l'examen clos ne verrouille pas, pattern q10 de exams.test.ts).
const qOpen = ids[2]
const qClosed = ids[3]
const examCreatorId = createId()
const examOpenId = createId()
const examClosedId = createId()

const mkQuestion = (id: string, correct: string) =>
  db.insert(questions).values({
    id,
    question: `Question ${id.slice(0, 6)} ${suffix} ?`,
    correctAnswer: correct,
    options: ["A", "B", "C", "D"],
    objectifCmc: `OBJ-${suffix}`,
    domain: DOMAIN,
  })

beforeAll(async () => {
  await mkQuestion(qImg, "A")
  await mkQuestion(q2, "B")
  await Promise.all(ids.slice(2).map((id) => mkQuestion(id, "C")))

  await db.insert(questionExplanations).values([
    { questionId: qImg, explanation: "Exp img", references: ["R1", "R2"] },
    { questionId: q2, explanation: "Exp q2", references: null },
  ])

  await db.insert(questionImages).values([
    { questionId: qImg, storagePath: `quiz/${suffix}/1.jpg`, position: 1 },
    { questionId: qImg, storagePath: `quiz/${suffix}/0.jpg`, position: 0 },
  ])

  await db.insert(user).values({
    id: examCreatorId,
    name: "Créateur Examen Quiz",
    email: `quiz91-${suffix}@test.invalid`,
    emailVerified: true,
  })
  await db.insert(exams).values([
    {
      id: examOpenId,
      title: `Examen ouvert ${suffix}`,
      startDate: new Date(Date.now() - 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      completionTime: 3600,
      createdBy: examCreatorId,
    },
    {
      id: examClosedId,
      title: `Examen clos ${suffix}`,
      startDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      completionTime: 3600,
      createdBy: examCreatorId,
    },
  ])
  await db.insert(examQuestions).values([
    { examId: examOpenId, questionId: qOpen, position: 0 },
    { examId: examClosedId, questionId: qClosed, position: 0 },
  ])
})

afterAll(async () => {
  for (const ip of usedIps) {
    setIpHeader(ip)
    await db
      .delete(quizRateLimits)
      .where(eq(quizRateLimits.key, await getClientIpKey()))
  }
  await db.delete(exams).where(inArray(exams.id, [examOpenId, examClosedId]))
  await db.delete(questionImages).where(inArray(questionImages.questionId, ids))
  await db
    .delete(questionExplanations)
    .where(inArray(questionExplanations.questionId, ids))
  await db.delete(questions).where(inArray(questions.id, ids))
  await db.delete(user).where(eq(user.id, examCreatorId))
})

describe("getOpenExamQuestionIds (verrou anonyme)", () => {
  it("verrouille les questions d'un examen ouvert, pas celles d'un examen clos", async () => {
    const locked = await getOpenExamQuestionIds([
      qOpen,
      qClosed,
      q2,
      createId(),
    ])
    expect(locked).toEqual(new Set([qOpen]))
  })

  it("Set vide pour une liste vide", async () => {
    expect((await getOpenExamQuestionIds([])).size).toBe(0)
  })
})

describe("getRandomQuizQuestions", () => {
  it("borne le nombre, filtre par domaine et exclut les examens ouverts", async () => {
    const three = await getRandomQuizQuestions({ domain: DOMAIN, count: 3 })
    expect(three).toHaveLength(3)
    expect(three.every((q) => q.domain === DOMAIN)).toBe(true)

    // qOpen (examen ouvert) n'est jamais servie ; qClosed (examen clos) l'est.
    const servable = ids.filter((id) => id !== qOpen)
    const all = await getRandomQuizQuestions({ domain: DOMAIN, count: 10 })
    expect(new Set(all.map((q) => q._id))).toEqual(new Set(servable))
  })

  it("ne sert jamais une question d'un examen ouvert (tirages répétés)", async () => {
    for (let i = 0; i < 5; i++) {
      const items = await getRandomQuizQuestions({ domain: DOMAIN, count: 10 })
      expect(items.map((q) => q._id)).not.toContain(qOpen)
    }
  })

  it("clampe count à 10", async () => {
    const items = await getRandomQuizQuestions({ count: 50 })
    expect(items.length).toBeLessThanOrEqual(10)
  })

  it("ne fuite jamais correctAnswer ni explanation", async () => {
    const items = await getRandomQuizQuestions({ domain: DOMAIN, count: 10 })
    for (const item of items) {
      expect(item).not.toHaveProperty("correctAnswer")
      expect(item).not.toHaveProperty("explanation")
    }
  })

  it("joint les images (URL CDN, triées par position)", async () => {
    const items = await getRandomQuizQuestions({ domain: DOMAIN, count: 10 })
    const withImg = items.find((q) => q._id === qImg)
    expect(withImg?.images.map((i) => i.order)).toEqual([0, 1])
    expect(withImg?.images[0].url).toContain(`quiz/${suffix}/0.jpg`)
    expect(withImg?.images[0].url.startsWith("https://")).toBe(true)

    const noImg = items.find((q) => q._id === q2)
    expect(noImg?.images).toEqual([])
  })
})

describe("getQuizAnswerKey", () => {
  it("renvoie la clé (réponse + explication + références) pour les ids connus", async () => {
    const key = await getQuizAnswerKey([qImg, q2, createId()])
    expect(key.get(qImg)).toMatchObject({
      correctAnswer: "A",
      explanation: "Exp img",
      references: ["R1", "R2"],
    })
    expect(key.get(q2)?.references).toEqual([]) // null → []
    expect(key.size).toBe(2) // l'id inconnu est absent
  })

  it("Map vide pour une liste vide", async () => {
    expect((await getQuizAnswerKey([])).size).toBe(0)
  })
})

describe("scoreQuizAnswers (action publique)", () => {
  const EMPTY = { score: 0, totalQuestions: 0, questionResults: [] }

  it("score avec un jeton valide ; les ids hors jeton sont omis (anti-moisson)", async () => {
    withIp(`ip-${createId()}`)
    const token = signQuizToken([qImg, q2])
    const result = await scoreQuizAnswers({
      token,
      answers: [
        { questionId: qImg, selectedAnswer: "A" }, // correct
        { questionId: q2, selectedAnswer: "mauvaise" }, // incorrect
        { questionId: ids[4], selectedAnswer: "C" }, // HORS jeton → omis
      ],
    })

    expect(result.score).toBe(1)
    expect(result.totalQuestions).toBe(2)
    expect(result.questionResults.map((r) => r.questionId)).not.toContain(
      ids[4],
    )
    const imgResult = result.questionResults.find((r) => r.questionId === qImg)
    expect(imgResult).toMatchObject({
      isCorrect: true,
      correctAnswer: "A",
      explanation: "Exp img",
      references: ["R1", "R2"],
    })
  })

  it("refuse de servir la clé d'ids arbitraires sans jeton les couvrant", async () => {
    withIp(`ip-${createId()}`)
    const token = signQuizToken([q2])
    const result = await scoreQuizAnswers({
      token,
      answers: [{ questionId: qImg, selectedAnswer: "A" }],
    })
    expect(result).toEqual(EMPTY)
  })

  it("refuse un jeton falsifié ou malformé", async () => {
    withIp(`ip-${createId()}`)
    const valid = signQuizToken([qImg])
    const tampered = valid.endsWith("A")
      ? `${valid.slice(0, -1)}B`
      : `${valid.slice(0, -1)}A`
    for (const bad of [tampered, "abc"]) {
      const result = await scoreQuizAnswers({
        token: bad,
        answers: [{ questionId: qImg, selectedAnswer: "A" }],
      })
      expect(result).toEqual(EMPTY)
    }
  })

  it("refuse un jeton expiré", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() - 2 * 60 * 60 * 1000)
    const stale = signQuizToken([qImg])
    vi.useRealTimers()

    withIp(`ip-${createId()}`)
    const result = await scoreQuizAnswers({
      token: stale,
      answers: [{ questionId: qImg, selectedAnswer: "A" }],
    })
    expect(result).toEqual(EMPTY)
  })

  it("n'expose jamais la clé d'une question d'examen ouvert, même sous jeton valide (examen ouvert après émission)", async () => {
    withIp(`ip-${createId()}`)
    const token = signQuizToken([qOpen, q2])
    const result = await scoreQuizAnswers({
      token,
      answers: [
        { questionId: qOpen, selectedAnswer: "C" },
        { questionId: q2, selectedAnswer: "B" },
      ],
    })
    expect(result.questionResults.map((r) => r.questionId)).toEqual([q2])
    expect(result.totalQuestions).toBe(1)
  })

  it("déduplique un id répété dans answers (compté une seule fois)", async () => {
    withIp(`ip-${createId()}`)
    const token = signQuizToken([q2])
    const result = await scoreQuizAnswers({
      token,
      answers: [
        { questionId: q2, selectedAnswer: "B" },
        { questionId: q2, selectedAnswer: "B" },
      ],
    })
    expect(result.totalQuestions).toBe(1)
    expect(result.score).toBe(1)
  })

  it("refuse une entrée hors bornes zod (> 10 réponses)", async () => {
    withIp(`ip-${createId()}`)
    const token = signQuizToken([qImg])
    const result = await scoreQuizAnswers({
      token,
      answers: Array.from({ length: 11 }, () => ({
        questionId: qImg,
        selectedAnswer: "A",
      })),
    })
    expect(result).toEqual(EMPTY)
  })

  it("refuse au-delà de 30 scorings/h pour la même IP", async () => {
    withIp(`ip-${createId()}`)
    const token = signQuizToken([q2])
    for (let i = 0; i < 30; i++) {
      const r = await scoreQuizAnswers({
        token,
        answers: [{ questionId: q2, selectedAnswer: "B" }],
      })
      expect(r.totalQuestions).toBe(1)
    }
    const refused = await scoreQuizAnswers({
      token,
      answers: [{ questionId: q2, selectedAnswer: "B" }],
    })
    expect(refused).toEqual(EMPTY)
  })
})

describe("loadRandomQuizQuestions (action publique)", () => {
  it("renvoie les questions et un jeton couvrant exactement les ids servis", async () => {
    withIp(`ip-${createId()}`)
    const bundle = await loadRandomQuizQuestions({
      count: 3,
      domain: DOMAIN,
    })
    expect(bundle.questions).toHaveLength(3)
    expect(bundle.token).not.toBeNull()
    expect(verifyQuizToken(bundle.token!)).toEqual(
      new Set(bundle.questions.map((q) => q._id)),
    )
  })

  it("refuse au-delà de 30 tirages/h pour la même IP", async () => {
    withIp(`ip-${createId()}`)
    for (let i = 0; i < 30; i++) {
      const bundle = await loadRandomQuizQuestions({
        count: 1,
        domain: DOMAIN,
      })
      expect(bundle.token).not.toBeNull()
    }
    const refused = await loadRandomQuizQuestions({
      count: 1,
      domain: DOMAIN,
    })
    expect(refused).toEqual({ questions: [], token: null })
  })

  it("refuse un count non numérique (zod) sans throw", async () => {
    withIp(`ip-${createId()}`)
    const bundle = await loadRandomQuizQuestions({ count: "abc" as never })
    expect(bundle).toEqual({ questions: [], token: null })
  })
})
