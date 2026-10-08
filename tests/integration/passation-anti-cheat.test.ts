/**
 * Tests d'intégration : garde anti-triche de projection.
 *
 * Vérifie qu'aucun champ sensible n'est exposé au client par la couche DAL
 * pendant une passation en cours :
 *   - examen : `getExamWithQuestions` pour un étudiant (non-admin) avec accès actif ;
 *   - entraînement mode test : `getTrainingSessionById` in_progress (questions +
 *     entrée `answers` après une réponse).
 *
 * Garde paramétrée sur SENSITIVE — c'est le seul objet de ce fichier (le flux
 * complet de passation est couvert par exam-runner.test.ts / training-mode.test.ts).
 */
import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { questionExplanations, questions, user } from "@/db/schema"
import { getExamWithQuestions } from "@/features/exams/dal"
import { setQuestionImages } from "@/features/questions/actions"
import {
  createTrainingSession,
  saveTrainingAnswer,
} from "@/features/training/actions"
import { getTrainingSessionById } from "@/features/training/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"
import { TEST_OBJECTIVE_ID } from "../helpers/objective"
import { seedExam } from "../helpers/seed-exam"
import { seedAccess } from "../helpers/seed-payments"

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

/**
 * Champs jamais exposés au client tant qu'une session est en cours (non révélée).
 */
const SENSITIVE = [
  "correctAnswer",
  "explanation",
  "references",
  "isCorrect",
  "explanationImages",
] as const

const DAY = 24 * 60 * 60 * 1000
const ADMIN_ID = createId()
const STUDENT_ID = createId()
const DOMAIN = "AC"
const qIds = Array.from({ length: 6 }, () => createId())

const setSession = (id: string, role: "user" | "admin") =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue({ user: { id, role } } as never)
const asAdmin = () => setSession(ADMIN_ID, "admin")
const asStudent = () => setSession(STUDENT_ID, "user")

const expectNoSensitive = (obj: Record<string, unknown>) => {
  for (const k of SENSITIVE) {
    expect(obj[k]).toBeUndefined()
  }
}

let examId: string

beforeAll(async () => {
  await db.insert(user).values([
    { id: ADMIN_ID, name: "AC admin", email: "ac-adm@test.invalid" },
    {
      id: STUDENT_ID,
      name: "AC student",
      email: "ac-stu@test.invalid",
    },
  ])
  // Accès actif examen ET entraînement pour l'étudiant.
  const expires = new Date(Date.now() + 10 * DAY)
  await seedAccess(STUDENT_ID, "exam", expires)
  await seedAccess(STUDENT_ID, "training", expires)
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `AC Q${i} ?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectiveId: TEST_OBJECTIVE_ID,
      domain: DOMAIN,
    })),
  )
  await db.insert(questionExplanations).values(
    qIds.map((id, i) => ({
      questionId: id,
      explanation: `Explication AC ${i}`,
      references: i === 0 ? ["Ref AC 1"] : null,
    })),
  )

  asAdmin()
  // q0 reçoit À LA FOIS une image d'énoncé ET une image d'explication. En
  // passation, seule l'image d'énoncé (`/statement/`) doit transiter par `images`,
  // et `explanationImages` doit rester absent (couvert par `expectNoSensitive`).
  // On passe des chemins déjà FINAUX → pas de copie S3 réelle (réservée à `tmp/`).
  const stmtRes = await setQuestionImages({
    questionId: qIds[0],
    kind: "statement",
    images: [
      {
        storagePath: `questions/${qIds[0]}/statement/0.jpg`,
        order: 0,
      },
    ],
  })
  if (!stmtRes.success) throw new Error(stmtRes.error)
  const explRes = await setQuestionImages({
    questionId: qIds[0],
    kind: "explanation",
    images: [
      {
        storagePath: `questions/${qIds[0]}/explanation/0.jpg`,
        order: 0,
      },
    ],
  })
  if (!explRes.success) throw new Error(explRes.error)

  const now = Date.now()
  examId = await seedExam({
    createdBy: ADMIN_ID,
    title: "AC Exam",
    startDate: now - 3600_000,
    endDate: now + 3600_000,
    questionIds: qIds,
    enablePause: false,
  })
})

describe("garde anti-triche : projection des champs sensibles", () => {
  it("examen (non-admin) : getExamWithQuestions n'expose aucun champ sensible", async () => {
    asStudent()
    const view = await getExamWithQuestions(examId)
    expect(view!.questions).toHaveLength(qIds.length)

    for (const q of view!.questions) {
      expectNoSensitive(q as Record<string, unknown>)
      // Anti-fuite : aucune image d'explication ne transite par le pont d'énoncé.
      expect(
        q.images.every((img) => !img.storagePath.includes("/explanation/")),
      ).toBe(true)
    }

    // q0 a bien son image d'énoncé (scope statement non vide).
    const q0 = view!.questions.find((q) => q._id === qIds[0])
    expect(
      q0?.images.some((img) => img.storagePath.includes("/statement/")),
    ).toBe(true)
  })

  it("entraînement mode test in_progress : getTrainingSessionById n'expose aucun champ sensible", async () => {
    asStudent()
    // questionCount min = 5 (schéma) ; 6 questions seedées dans ce domaine.
    const c = await createTrainingSession({
      questionCount: 5,
      domain: DOMAIN,
      mode: "test",
    })
    expect(c.success).toBe(true)
    if (!c.success) return
    const sessionId = c.sessionId

    const v0 = await getTrainingSessionById(sessionId)
    expect(v0!.questions).toHaveLength(5)

    // Aucune question ne révèle de champ sensible avant réponse, et aucune
    // image d'explication ne fuit par le pont d'énoncé.
    for (const q of v0!.questions) {
      expectNoSensitive(q as Record<string, unknown>)
      expect(
        q.images.every((img) => !img.storagePath.includes("/explanation/")),
      ).toBe(true)
    }

    // Répondre à une question puis re-fetcher.
    const q = v0!.questions[0]
    await saveTrainingAnswer({
      sessionId,
      questionId: q._id,
      selectedAnswer: q.options[0],
    })

    const v1 = await getTrainingSessionById(sessionId)
    expect(v1).not.toBeNull()

    // Les questions restent sans champ sensible (mode test in_progress).
    for (const qv of v1!.questions) {
      expectNoSensitive(qv as Record<string, unknown>)
      expect(
        qv.images.every((img) => !img.storagePath.includes("/explanation/")),
      ).toBe(true)
    }

    // L'entrée answers contient selectedAnswer mais PAS isCorrect.
    const entry = v1!.answers[q._id]
    expect(entry?.selectedAnswer).toBeDefined()
    expect(
      (entry as Record<string, unknown> | undefined)?.isCorrect,
    ).toBeUndefined()
  })
})
