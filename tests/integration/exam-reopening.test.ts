import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examAudience,
  examParticipations,
  examQuestions,
  exams,
  questions,
  user,
} from "@/db/schema"
import { startExam } from "@/features/exams/actions"
import {
  getExamReopeningSource,
  getParticipantExamResults,
} from "@/features/exams/dal"
import { lockFor } from "@/features/questions/answer-key-lock"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"
import { createFinalizedExam, saveAndFinalize } from "../helpers/exam-form"
import { TEST_OBJECTIVE_ID } from "../helpers/objective"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const DAY = 24 * 60 * 60 * 1000
const ADMIN_ID = createId()
// Membre de l'audience restreinte : aucun abonnement requis pour passer.
const STUDENT_ID = createId()
const qIds = Array.from({ length: 11 }, () => createId())
// Jeu des examens de la fixture ; la 11ᵉ question sert à le changer.
const examQIds = qIds.slice(0, 10)

// Clos, avec une participation close (l'examen « rouvert par les dates » du bug).
const CLOSED_TAKEN_ID = createId()
// Clos, sans participation.
const CLOSED_EMPTY_ID = createId()
// Ouvert, avec une participation.
const OPEN_TAKEN_ID = createId()
// Source d'une réouverture : une question et un membre d'audience supprimés.
const SOURCE_ID = createId()
const DELETED_QUESTION_ID = createId()
const DELETED_USER_ID = createId()

const setSession = (id: string, role: "user" | "admin") =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue({ user: { id, role } } as never)
const asAdmin = () => setSession(ADMIN_ID, "admin")
const asStudent = () => setSession(STUDENT_ID, "user")

const CLOSED_START = new Date("2026-03-01T00:00:00Z")
const CLOSED_END = new Date("2026-03-08T00:00:00Z")

const examRow = async (id: string) => {
  const [row] = await db
    .select({
      title: exams.title,
      startDate: exams.startDate,
      endDate: exams.endDate,
      audienceType: exams.audienceType,
    })
    .from(exams)
    .where(eq(exams.id, id))
  return row
}

const audienceOf = async (id: string) =>
  (
    await db
      .select({ userId: examAudience.userId })
      .from(examAudience)
      .where(eq(examAudience.examId, id))
  ).map((r) => r.userId)

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: ADMIN_ID,
      name: "Reo admin",
      email: "reo-adm@test.invalid",
    },
    {
      id: STUDENT_ID,
      name: "Reo étudiant",
      email: "reo-stu@test.invalid",
    },
    {
      id: DELETED_USER_ID,
      name: "Reo supprimé",
      email: "reo-del@test.invalid",
      deletedAt: new Date("2026-05-01T00:00:00Z"),
    },
  ])
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `REO Q${i} ?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectiveId: TEST_OBJECTIVE_ID,
      domain: "REO",
    })),
  )
  await db.insert(questions).values({
    id: DELETED_QUESTION_ID,
    question: "REO supprimée ?",
    correctAnswer: "A",
    options: ["A", "B", "C", "D"],
    objectiveId: TEST_OBJECTIVE_ID,
    domain: "REO",
    deletedAt: new Date("2026-05-01T00:00:00Z"),
  })
  const now = Date.now()
  await db.insert(exams).values([
    {
      id: CLOSED_TAKEN_ID,
      title: "REO clos passé",
      startDate: CLOSED_START,
      endDate: CLOSED_END,
      completionTime: 3 * 83,
      audienceType: "restricted",
      createdBy: ADMIN_ID,
      targetQuestionCount: 10,
      finalizedAt: new Date(),
    },
    {
      id: CLOSED_EMPTY_ID,
      title: "REO clos vide",
      startDate: CLOSED_START,
      endDate: CLOSED_END,
      completionTime: 3 * 83,
      createdBy: ADMIN_ID,
      targetQuestionCount: 10,
      finalizedAt: new Date(),
    },
    {
      id: OPEN_TAKEN_ID,
      title: "REO ouvert",
      startDate: new Date(now - DAY),
      endDate: new Date(now + DAY),
      completionTime: 3 * 83,
      createdBy: ADMIN_ID,
      targetQuestionCount: 10,
      finalizedAt: new Date(),
    },
    {
      id: SOURCE_ID,
      title: "REO source",
      description: "Épreuve source",
      startDate: CLOSED_START,
      endDate: CLOSED_END,
      completionTime: 3 * 83,
      enablePause: true,
      pauseDurationMinutes: 20,
      audienceType: "restricted",
      createdBy: ADMIN_ID,
      targetQuestionCount: 10,
      finalizedAt: new Date(),
    },
  ])
  await db.insert(examQuestions).values([
    ...[CLOSED_TAKEN_ID, CLOSED_EMPTY_ID, OPEN_TAKEN_ID].flatMap((examId) =>
      examQIds.map((questionId, position) => ({
        examId,
        questionId,
        position,
      })),
    ),
    { examId: SOURCE_ID, questionId: qIds[2], position: 0 },
    { examId: SOURCE_ID, questionId: DELETED_QUESTION_ID, position: 1 },
    { examId: SOURCE_ID, questionId: qIds[0], position: 2 },
  ])
  await db.insert(examAudience).values([
    { examId: CLOSED_TAKEN_ID, userId: STUDENT_ID },
    { examId: SOURCE_ID, userId: STUDENT_ID },
    { examId: SOURCE_ID, userId: DELETED_USER_ID },
  ])
  await db.insert(examParticipations).values([
    {
      id: createId(),
      examId: CLOSED_TAKEN_ID,
      userId: STUDENT_ID,
      status: "completed",
      score: 67,
      startedAt: new Date("2026-03-02T10:00:00Z"),
      completedAt: new Date("2026-03-02T11:00:00Z"),
    },
    {
      id: createId(),
      examId: OPEN_TAKEN_ID,
      userId: ADMIN_ID,
      status: "in_progress",
      startedAt: new Date(now - 1000),
    },
  ])
})

describe("modification d'un examen complet — les dates d'un examen clos", () => {
  it("refuse de repousser dans le futur la fin d'un examen clos qui a des participations, sans rien écrire", async () => {
    asAdmin()
    const before = await examRow(CLOSED_TAKEN_ID)
    const now = Date.now()

    const res = await saveAndFinalize({
      id: CLOSED_TAKEN_ID,
      title: "REO renommé",
      startDate: now,
      endDate: now + 7 * DAY,
      questionIds: examQIds,
      enablePause: false,
      audienceType: "subscribers",
      audienceUserIds: [],
    })

    expect(res).toEqual({
      success: false,
      error: expect.stringContaining("Rouvrir"),
    })
    expect(await examRow(CLOSED_TAKEN_ID)).toEqual(before)
    expect(await audienceOf(CLOSED_TAKEN_ID)).toEqual([STUDENT_ID])
  })

  it("renvoie vers « Rouvrir » même quand les questions changent aussi", async () => {
    asAdmin()
    const now = Date.now()
    const res = await saveAndFinalize({
      id: CLOSED_TAKEN_ID,
      title: "REO clos passé",
      startDate: now,
      endDate: now + 7 * DAY,
      questionIds: [...examQIds.slice(1), qIds[10]],
      enablePause: false,
      audienceType: "restricted",
      audienceUserIds: [STUDENT_ID],
    })

    expect(res).toEqual({
      success: false,
      error: expect.stringContaining("Rouvrir"),
    })
  })

  it("permet de corriger la fin d'un examen clos vers une autre date passée", async () => {
    asAdmin()
    const res = await saveAndFinalize({
      id: CLOSED_TAKEN_ID,
      title: "REO clos passé",
      startDate: CLOSED_START.getTime(),
      endDate: CLOSED_END.getTime() + DAY,
      questionIds: examQIds,
      enablePause: false,
      audienceType: "restricted",
      audienceUserIds: [STUDENT_ID],
    })

    expect(res).toEqual({ success: true })
    expect((await examRow(CLOSED_TAKEN_ID))?.endDate?.getTime()).toBe(
      CLOSED_END.getTime() + DAY,
    )
  })

  it("permet de reprogrammer un examen clos sans participation", async () => {
    asAdmin()
    const now = Date.now()
    const res = await saveAndFinalize({
      id: CLOSED_EMPTY_ID,
      title: "REO clos vide",
      startDate: now + DAY,
      endDate: now + 7 * DAY,
      questionIds: examQIds,
      enablePause: false,
    })

    expect(res).toEqual({ success: true })
    expect((await examRow(CLOSED_EMPTY_ID))?.endDate?.getTime()).toBe(
      now + 7 * DAY,
    )
  })

  it("permet de prolonger un examen ouvert qui a des participations", async () => {
    asAdmin()
    const now = Date.now()
    const res = await saveAndFinalize({
      id: OPEN_TAKEN_ID,
      title: "REO ouvert",
      startDate: now - DAY,
      endDate: now + 3 * DAY,
      questionIds: examQIds,
      enablePause: false,
    })

    expect(res).toEqual({ success: true })
    expect((await examRow(OPEN_TAKEN_ID))?.endDate?.getTime()).toBe(
      now + 3 * DAY,
    )
  })
})

describe("getExamReopeningSource — ce qu'une réouverture reprend", () => {
  it("reprend le contenu de la source, questions dans leur ordre, sans question ni membre supprimés", async () => {
    asAdmin()
    const source = await getExamReopeningSource(SOURCE_ID)

    expect(source).toEqual({
      exam: {
        title: "REO source",
        description: "Épreuve source",
        endDate: CLOSED_END.getTime(),
        enablePause: true,
        pauseDurationMinutes: 20,
        questionCount: 3,
        audienceType: "restricted",
      },
      questionIds: [qIds[2], qIds[0]],
      audience: [
        {
          id: STUDENT_ID,
          name: "Reo étudiant",
          email: "reo-stu@test.invalid",
        },
      ],
    })
  })

  it("examen introuvable → null", async () => {
    asAdmin()
    expect(await getExamReopeningSource(createId())).toBeNull()
  })
})

describe("réouverture — une copie créée par le formulaire", () => {
  it("l'ancien participant garde ses résultats, peut passer la copie, et sa correction d'origine est différée le temps de la copie", async () => {
    asAdmin()
    const now = Date.now()
    const created = await createFinalizedExam({
      title: "REO clos passé (réouverture)",
      startDate: now - 60_000,
      endDate: now + 7 * DAY,
      questionIds: examQIds,
      enablePause: false,
      audienceType: "restricted",
      audienceUserIds: [STUDENT_ID],
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    asStudent()
    const source = await getParticipantExamResults(CLOSED_TAKEN_ID, STUDENT_ID)
    expect(source && "participant" in source).toBe(true)
    if (!source || "error" in source) return
    expect(source.participant.score).toBe(67)
    expect(source.questions.every((q) => q.correctAnswer === "A")).toBe(true)

    const lock = await lockFor({ id: STUDENT_ID, role: "user" }, qIds)
    expect(qIds.some((id) => lock.has(id))).toBe(false)

    const started = await startExam({ examId: created.examId })
    expect(started.success).toBe(true)

    // Participer à la copie ouverte verrouille ses questions, donc celles de
    // l'examen d'origine : la correction revient à sa clôture.
    const during = await getParticipantExamResults(CLOSED_TAKEN_ID, STUDENT_ID)
    if (!during || "error" in during) throw new Error("résultats illisibles")
    expect(during.questions.every((q) => q.keyWithheld === true)).toBe(true)
  })
})
