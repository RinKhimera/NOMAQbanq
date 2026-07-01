/**
 * Tests d'intégration : images d'explication (Feature 3).
 *
 * Couvre :
 *  - `setQuestionImages` scopé par `kind` (sauver un jeu ne touche pas l'autre) ;
 *  - les lectures d'ÉNONCÉ ne remontent QUE `kind='statement'`
 *    (`getRandomQuizQuestions`, `getQuestionById.images`) — anti-fuite ;
 *  - les compteurs/filtres ADMIN ne comptent QUE les images d'énoncé
 *    (`getQuestionsWithFilters.imageCount`, `getQuestionStatsEnriched`) ;
 *  - le canal d'EXPLICATION est peuplé à la correction
 *    (`getQuestionById.explanationImages`, `getQuizAnswerKey`,
 *    `getExamQuestionExplanations`, `getTrainingSessionResults`).
 *
 * Astuce S3 : on passe à `setQuestionImages` des `storagePath` déjà FINAUX
 * (`questions/{id}/{kind}/…`, sans préfixe `tmp/`) → aucune I/O S3 réelle
 * (la copie tmp→final est réservée aux `tmp/`, et `tryDeleteFromStorage` est un
 * no-op quand S3 n'est pas configuré).
 */
import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examAnswers,
  examParticipations,
  exams,
  questionExplanations,
  questionImages,
  questions,
  trainingSessionItems,
  trainingSessions,
  user,
} from "@/db/schema"
import { createExam } from "@/features/exams/actions"
import { getExamQuestionExplanations } from "@/features/exams/dal"
import { setQuestionImages } from "@/features/questions/actions"
import {
  getQuestionById,
  getQuestionStatsEnriched,
  getQuestionsWithFilters,
  getQuizAnswerKey,
  getRandomQuizQuestions,
} from "@/features/questions/dal"
import { getTrainingSessionResults } from "@/features/training/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const DAY = 24 * 60 * 60 * 1000
const suffix = createId().slice(0, 8)
const ADMIN_ID = createId()
const STUDENT_ID = createId()
const DOMAIN = `EXPL-${suffix}`
const OBJ = `Obj EXPL ${suffix}`

// qBoth : statement + explanation ; qStmtOnly : statement seul ;
// qExplOnly : explanation seul ; qExam : pour la participation examen complétée ;
// qTrain : pour la session training complétée.
const qBoth = createId()
const qStmtOnly = createId()
const qExplOnly = createId()
const qExam = createId()
const qTrain = createId()
const qIds = [qBoth, qStmtOnly, qExplOnly, qExam, qTrain]

const setSession = (id: string, role: "user" | "admin") =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue({ user: { id, role } } as never)
const asAdmin = () => setSession(ADMIN_ID, "admin")
const asStudent = () => setSession(STUDENT_ID, "user")

const stmtPath = (id: string, i: number) => `questions/${id}/statement/${i}.jpg`
const explPath = (id: string, i: number) =>
  `questions/${id}/explanation/${i}.jpg`

let examId: string
let trainingSessionId: string

beforeAll(async () => {
  await db.insert(user).values([
    { id: ADMIN_ID, name: "EX admin", email: `ex-adm-${suffix}@test.invalid` },
    {
      id: STUDENT_ID,
      name: "EX student",
      email: `ex-stu-${suffix}@test.invalid`,
    },
  ])
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `EX Q${i} ${suffix}?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: OBJ,
      domain: DOMAIN,
    })),
  )
  await db.insert(questionExplanations).values(
    qIds.map((id, i) => ({
      questionId: id,
      explanation: `Explication EXPL ${i} ${suffix}`,
      references: i === 0 ? ["Ref EXPL 1"] : null,
    })),
  )

  asAdmin()
  // qBoth : un statement + un explanation (chemins finaux → pas d'I/O S3).
  await setQuestionImages({
    questionId: qBoth,
    kind: "statement",
    images: [{ storagePath: stmtPath(qBoth, 0), order: 0 }],
  })
  await setQuestionImages({
    questionId: qBoth,
    kind: "explanation",
    images: [
      { storagePath: explPath(qBoth, 0), order: 0 },
      { storagePath: explPath(qBoth, 1), order: 1 },
    ],
  })
  // qStmtOnly : statement seul.
  await setQuestionImages({
    questionId: qStmtOnly,
    kind: "statement",
    images: [{ storagePath: stmtPath(qStmtOnly, 0), order: 0 }],
  })
  // qExplOnly : explanation seul (ne doit JAMAIS compter comme « avec images »).
  await setQuestionImages({
    questionId: qExplOnly,
    kind: "explanation",
    images: [{ storagePath: explPath(qExplOnly, 0), order: 0 }],
  })
  // qExam : explanation seul (révélée à la correction examen).
  await setQuestionImages({
    questionId: qExam,
    kind: "explanation",
    images: [{ storagePath: explPath(qExam, 0), order: 0 }],
  })
  // qTrain : explanation seul (révélée à la correction training).
  await setQuestionImages({
    questionId: qTrain,
    kind: "explanation",
    images: [{ storagePath: explPath(qTrain, 0), order: 0 }],
  })

  // Examen + participation complétée (qExam) → autorise getExamQuestionExplanations.
  const now = Date.now()
  const r1 = await createExam({
    title: `EX Exam ${suffix}`,
    startDate: now - 3 * DAY,
    endDate: now - DAY,
    questionIds: [qExam],
    enablePause: false,
  })
  if (!r1.success) throw new Error(r1.error)
  examId = r1.examId

  const partId = createId()
  await db.insert(examParticipations).values({
    id: partId,
    examId,
    userId: STUDENT_ID,
    status: "completed",
    score: 100,
    startedAt: new Date(now - 3 * DAY + 1000),
    completedAt: new Date(now - 2 * DAY),
  })
  await db.insert(examAnswers).values({
    id: createId(),
    participationId: partId,
    questionId: qExam,
    selectedAnswer: "A",
    isCorrect: true,
  })

  // Session training complétée (qTrain) → getTrainingSessionResults.
  const tsId = createId()
  await db.insert(trainingSessions).values({
    id: tsId,
    userId: STUDENT_ID,
    status: "completed",
    questionCount: 1,
    score: 100,
    startedAt: new Date(now - DAY),
    completedAt: new Date(now - DAY + 1000),
    expiresAt: new Date(now + DAY),
  })
  await db.insert(trainingSessionItems).values({
    id: createId(),
    sessionId: tsId,
    questionId: qTrain,
    position: 0,
    selectedAnswer: "A",
    isCorrect: true,
  })
  trainingSessionId = tsId
})

afterAll(async () => {
  // Examen cascade participations/réponses/jonctions.
  await db.delete(exams).where(eq(exams.createdBy, ADMIN_ID))
  // Sessions training (cascade items) avant questions (FK restrict sur items).
  await db
    .delete(trainingSessions)
    .where(eq(trainingSessions.userId, STUDENT_ID))
  // questionImages/questionExplanations cascade via questions, mais on nettoie
  // explicitement pour l'ordre/robustesse.
  await db
    .delete(questionImages)
    .where(inArray(questionImages.questionId, qIds))
  await db
    .delete(questionExplanations)
    .where(inArray(questionExplanations.questionId, qIds))
  await db.delete(questions).where(inArray(questions.id, qIds))
  await db.delete(user).where(inArray(user.id, [ADMIN_ID, STUDENT_ID]))
})

describe("setQuestionImages scopé par kind", () => {
  it("sauver statement n'efface pas explanation (et inversement)", async () => {
    asAdmin()
    // qBoth a été seedé avec 1 statement + 2 explanation. Re-sauver le statement
    // ne doit pas toucher les explanation.
    await setQuestionImages({
      questionId: qBoth,
      kind: "statement",
      images: [{ storagePath: stmtPath(qBoth, 0), order: 0 }],
    })
    const rows = await db
      .select({ kind: questionImages.kind })
      .from(questionImages)
      .where(eq(questionImages.questionId, qBoth))
    expect(rows.filter((r) => r.kind === "statement")).toHaveLength(1)
    expect(rows.filter((r) => r.kind === "explanation")).toHaveLength(2)
  })

  it("remplacer explanation n'efface pas statement", async () => {
    asAdmin()
    await setQuestionImages({
      questionId: qBoth,
      kind: "explanation",
      images: [
        { storagePath: explPath(qBoth, 0), order: 0 },
        { storagePath: explPath(qBoth, 1), order: 1 },
      ],
    })
    const rows = await db
      .select({ kind: questionImages.kind })
      .from(questionImages)
      .where(eq(questionImages.questionId, qBoth))
    expect(rows.filter((r) => r.kind === "statement")).toHaveLength(1)
    expect(rows.filter((r) => r.kind === "explanation")).toHaveLength(2)
  })

  it("rejette un storagePath d'une AUTRE question (garde de préfixe)", async () => {
    asAdmin()
    const res = await setQuestionImages({
      questionId: qBoth,
      kind: "statement",
      // chemin appartenant à une autre question → préfixe invalide (anti
      // suppression croisée entre questions).
      images: [
        { storagePath: `questions/${qStmtOnly}/statement/0.jpg`, order: 0 },
      ],
    })
    expect(res.success).toBe(false)
  })
})

describe("lectures d'énoncé scopées kind=statement (anti-fuite)", () => {
  it("getRandomQuizQuestions ne remonte que les images d'énoncé", async () => {
    const list = await getRandomQuizQuestions({ count: 50, domain: DOMAIN })
    const q = list.find((x) => x._id === qBoth)
    expect(q).toBeDefined()
    expect(q!.images).toHaveLength(1)
    expect(q!.images[0].storagePath.includes("/statement/")).toBe(true)
    expect(
      q!.images.every((img) => !img.storagePath.includes("/explanation/")),
    ).toBe(true)

    // Une question explanation-only n'a aucune image d'énoncé.
    const qe = list.find((x) => x._id === qExplOnly)
    expect(qe).toBeDefined()
    expect(qe!.images).toHaveLength(0)
  })

  it("getQuestionById sépare images (statement) et explanationImages", async () => {
    asAdmin()
    const detail = await getQuestionById(qBoth)
    expect(detail).not.toBeNull()
    expect(detail!.images).toHaveLength(1)
    expect(detail!.images[0].storagePath.includes("/statement/")).toBe(true)
    expect(detail!.explanationImages).toHaveLength(2)
    expect(
      detail!.explanationImages.every((img) =>
        img.storagePath.includes("/explanation/"),
      ),
    ).toBe(true)
  })
})

describe("compteurs/filtres admin = images d'énoncé seulement", () => {
  it("imageCount ignore les images d'explication", async () => {
    asAdmin()
    const page = await getQuestionsWithFilters({
      domain: DOMAIN,
      limit: 100,
    })
    const both = page.items.find((i) => i.id === qBoth)
    const stmtOnly = page.items.find((i) => i.id === qStmtOnly)
    const explOnly = page.items.find((i) => i.id === qExplOnly)
    expect(both?.imageCount).toBe(1) // 1 statement (les 2 explanation ignorées)
    expect(stmtOnly?.imageCount).toBe(1)
    expect(explOnly?.imageCount).toBe(0) // explanation-only → 0
  })

  it("filtre hasImages=true exclut les questions explanation-only", async () => {
    asAdmin()
    const withImages = await getQuestionsWithFilters({
      domain: DOMAIN,
      hasImages: true,
      limit: 100,
    })
    const ids = withImages.items.map((i) => i.id)
    expect(ids).toContain(qBoth)
    expect(ids).toContain(qStmtOnly)
    expect(ids).not.toContain(qExplOnly)

    const withoutImages = await getQuestionsWithFilters({
      domain: DOMAIN,
      hasImages: false,
      limit: 100,
    })
    const idsNo = withoutImages.items.map((i) => i.id)
    expect(idsNo).toContain(qExplOnly)
    expect(idsNo).not.toContain(qBoth)
    expect(idsNo).not.toContain(qStmtOnly)
  })

  it("getQuestionStatsEnriched.withImagesCount = questions à images d'énoncé", async () => {
    asAdmin()
    const stats = await getQuestionStatsEnriched()
    // qBoth + qStmtOnly comptent (statement) ; qExplOnly/qExam/qTrain NON.
    // On vérifie via les filtres plutôt que des nombres globaux : la cohérence
    // avec hasImages a déjà été asserée ; ici on s'assure juste que le compteur
    // reste >= 2 (au moins nos 2 questions d'énoncé) et reste numérique fini.
    expect(Number.isFinite(stats.withImagesCount)).toBe(true)
    expect(stats.withImagesCount).toBeGreaterThanOrEqual(2)
  })
})

describe("canal explication présent à la correction", () => {
  it("getQuizAnswerKey expose explanationImages (vitrine)", async () => {
    const keyMap = await getQuizAnswerKey([qBoth, qStmtOnly, qExplOnly])
    expect(keyMap.get(qBoth)?.explanationImages).toHaveLength(2)
    expect(
      keyMap
        .get(qBoth)
        ?.explanationImages.every((img) =>
          img.storagePath.includes("/explanation/"),
        ),
    ).toBe(true)
    expect(keyMap.get(qStmtOnly)?.explanationImages).toHaveLength(0)
    expect(keyMap.get(qExplOnly)?.explanationImages).toHaveLength(1)
  })

  it("getExamQuestionExplanations peuple explanationImages (correction examen)", async () => {
    asStudent()
    const res = await getExamQuestionExplanations([qExam])
    expect(res).toHaveLength(1)
    expect(res[0].explanationImages).toHaveLength(1)
    expect(
      res[0].explanationImages[0].storagePath.includes("/explanation/"),
    ).toBe(true)
  })

  it("getTrainingSessionResults peuple explanationImages (correction training)", async () => {
    asStudent()
    const res = await getTrainingSessionResults(trainingSessionId)
    expect(res).not.toBeNull()
    if (!res || "error" in res) throw new Error("résultats attendus")
    const q = res.questions.find((x) => x._id === qTrain)
    expect(q?.explanationImages).toHaveLength(1)
    expect(
      q?.explanationImages?.[0].storagePath.includes("/explanation/"),
    ).toBe(true)
  })
})
