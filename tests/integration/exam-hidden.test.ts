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
import { getMyDashboard } from "@/features/analytics/dal"
import { saveExam, setExamHidden } from "@/features/exams/actions"
import {
  getExamRanking,
  getExamReopeningSource,
  getExamWithQuestions,
  getExamsWithParticipation,
} from "@/features/exams/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"
import { TEST_OBJECTIVE_ID } from "../helpers/objective"
import { seedAccess } from "../helpers/seed-payments"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()

const ADMIN_ID = createId()
const SUBSCRIBER_ID = createId()
// Ni accès Examens ni participation.
const OUTSIDER_ID = createId()
// Accès Examens expiré, participation soumise à l'examen masqué clos.
const FORMER_ID = createId()
// Membre de l'audience restreinte, sans abonnement.
const MEMBER_ID = createId()
const qIds = [createId(), createId()]

const HIDDEN_ID = createId()
const PLAIN_ID = createId()
const HIDDEN_CLOSED_ID = createId()
const RESTRICTED_HIDDEN_ID = createId()

const asUser = (id: string, role: "user" | "admin" = "user") =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue({ user: { id, role } } as never)

const seedExam = async (
  id: string,
  {
    hidden,
    closed = false,
    audienceType = "subscribers",
  }: {
    hidden: boolean
    closed?: boolean
    audienceType?: "subscribers" | "restricted"
  },
) => {
  await db.insert(exams).values({
    id,
    title: `Masquage ${id}`,
    startDate: new Date(NOW - 10 * DAY),
    endDate: closed ? new Date(NOW - DAY) : new Date(NOW + DAY),
    completionTime: 3600,
    audienceType,
    isHidden: hidden,
    createdBy: ADMIN_ID,
    targetQuestionCount: qIds.length,
    finalizedAt: new Date(NOW - 10 * DAY),
  })
  await db.insert(examQuestions).values(
    qIds.map((questionId, position) => ({
      examId: id,
      questionId,
      position,
    })),
  )
}

const listedIds = async () =>
  (await getExamsWithParticipation()).map((e) => e.id)

beforeAll(async () => {
  await db.insert(user).values(
    [
      [ADMIN_ID, "admin"],
      [SUBSCRIBER_ID, "abo"],
      [OUTSIDER_ID, "dehors"],
      [FORMER_ID, "ancien"],
      [MEMBER_ID, "membre"],
    ].map(([id, tag]) => ({
      id,
      name: `Masq ${tag}`,
      email: `masq-${tag}@test.invalid`,
    })),
  )
  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `Q masquage ${i}`,
      correctAnswer: "A",
      options: ["A", "B"],
      objectiveId: TEST_OBJECTIVE_ID,
      domain: "Cardiologie",
    })),
  )
  await seedExam(HIDDEN_ID, { hidden: true })
  await seedExam(PLAIN_ID, { hidden: false })
  await seedExam(HIDDEN_CLOSED_ID, { hidden: true, closed: true })
  await seedExam(RESTRICTED_HIDDEN_ID, {
    hidden: true,
    audienceType: "restricted",
  })
  await db
    .insert(examAudience)
    .values({ examId: RESTRICTED_HIDDEN_ID, userId: MEMBER_ID })
  await db.insert(examParticipations).values({
    examId: HIDDEN_CLOSED_ID,
    userId: FORMER_ID,
    status: "completed",
    score: 50,
    startedAt: new Date(NOW - 5 * DAY),
    completedAt: new Date(NOW - 5 * DAY + 1000),
  })
  await seedAccess(SUBSCRIBER_ID, "exam", new Date(NOW + 20 * DAY))
  await seedAccess(FORMER_ID, "exam", new Date(NOW - 2 * DAY))
})

describe("examen « abonnés » masqué", () => {
  it("n'est ni listé ni lisible sans accès Examens ni participation", async () => {
    asUser(OUTSIDER_ID)

    const ids = await listedIds()
    expect(ids).not.toContain(HIDDEN_ID)
    expect(ids).not.toContain(HIDDEN_CLOSED_ID)
    expect(await getExamWithQuestions(HIDDEN_ID)).toBeNull()
    // « Ni compté » tient par construction : sans accès Examens, le compteur
    // du tableau de bord vaut 0 avant tout filtre (`countAvailableExams`).
  })

  it("non masqué, reste listé pour un non-abonné (verrouillé)", async () => {
    asUser(OUTSIDER_ID)

    expect(await listedIds()).toContain(PLAIN_ID)
    expect(await getExamWithQuestions(PLAIN_ID)).toBeNull()
  })

  it("est listé, compté et lisible pour un abonné", async () => {
    asUser(SUBSCRIBER_ID)

    expect(await listedIds()).toEqual(
      expect.arrayContaining([HIDDEN_ID, HIDDEN_CLOSED_ID]),
    )
    expect(await getExamWithQuestions(HIDDEN_ID)).not.toBeNull()
    // Les deux masqués et le non masqué ; pas le restreint dont il n'est pas membre.
    expect(await getMyDashboard("tout")).toMatchObject({
      exams: { availableCount: 3 },
    })
  })

  it("reste dans l'historique d'un ancien participant dont l'accès a expiré", async () => {
    asUser(FORMER_ID)

    const ids = await listedIds()
    expect(ids).toContain(HIDDEN_CLOSED_ID)
    expect(ids).not.toContain(HIDDEN_ID)
    expect(await getExamRanking(HIDDEN_CLOSED_ID)).not.toBeNull()
  })

  it("est listé et lisible pour un admin", async () => {
    asUser(ADMIN_ID, "admin")

    expect(await listedIds()).toEqual(
      expect.arrayContaining([
        HIDDEN_ID,
        HIDDEN_CLOSED_ID,
        RESTRICTED_HIDDEN_ID,
      ]),
    )
    expect(await getExamWithQuestions(HIDDEN_ID)).not.toBeNull()
  })
})

describe("masquage d'une audience restreinte", () => {
  it("posé en base, ne change rien : vu de ses membres, de personne d'autre", async () => {
    asUser(MEMBER_ID)
    expect(await listedIds()).toContain(RESTRICTED_HIDDEN_ID)
    expect(await getExamWithQuestions(RESTRICTED_HIDDEN_ID)).not.toBeNull()

    asUser(SUBSCRIBER_ID)
    expect(await listedIds()).not.toContain(RESTRICTED_HIDDEN_ID)
  })

  it("setExamHidden le refuse", async () => {
    asUser(ADMIN_ID, "admin")

    expect(await setExamHidden({ examId: createId(), hidden: true })).toEqual({
      success: false,
      error: "Examen introuvable.",
    })
    expect(
      await setExamHidden({ examId: RESTRICTED_HIDDEN_ID, hidden: false }),
    ).toEqual({
      success: false,
      error:
        "Une audience restreinte est déjà réservée à ses membres : elle ne se masque pas.",
    })
  })

  it("saveExam ne l'enregistre pas pour une audience restreinte", async () => {
    asUser(ADMIN_ID, "admin")
    const saved = await saveExam({
      title: "Restreint masqué",
      targetQuestionCount: 10,
      startDate: null,
      endDate: null,
      enablePause: false,
      audienceType: "restricted",
      audienceUserIds: [MEMBER_ID],
      isHidden: true,
    })
    expect(saved.success).toBe(true)
    if (!saved.success) return

    const [row] = await db
      .select({ isHidden: exams.isHidden })
      .from(exams)
      .where(eq(exams.id, saved.examId))
    expect(row?.isHidden).toBe(false)
  })
})

describe("basculer le masquage", () => {
  it("setExamHidden masque puis affiche un examen d'abonnés", async () => {
    try {
      asUser(ADMIN_ID, "admin")
      expect(await setExamHidden({ examId: PLAIN_ID, hidden: true })).toEqual({
        success: true,
      })
      asUser(OUTSIDER_ID)
      expect(await listedIds()).not.toContain(PLAIN_ID)

      asUser(ADMIN_ID, "admin")
      expect(await setExamHidden({ examId: PLAIN_ID, hidden: false })).toEqual({
        success: true,
      })
      asUser(OUTSIDER_ID)
      expect(await listedIds()).toContain(PLAIN_ID)
    } finally {
      await db
        .update(exams)
        .set({ isHidden: false })
        .where(eq(exams.id, PLAIN_ID))
    }
  })

  it("est réservé aux admins", async () => {
    asUser(OUTSIDER_ID)
    await expect(
      setExamHidden({ examId: PLAIN_ID, hidden: true }),
    ).rejects.toThrow()
  })
})

describe("réouverture", () => {
  it("la source porte le réglage de masquage, que la copie enregistre", async () => {
    asUser(ADMIN_ID, "admin")
    const source = await getExamReopeningSource(HIDDEN_CLOSED_ID)
    expect(source?.exam.isHidden).toBe(true)

    const saved = await saveExam({
      title: "Copie masquée",
      targetQuestionCount: 10,
      startDate: null,
      endDate: null,
      questionIds: source!.questionIds,
      enablePause: false,
      audienceType: "subscribers",
      audienceUserIds: [],
      isHidden: source!.exam.isHidden,
    })
    expect(saved.success).toBe(true)
    if (!saved.success) return
    const [row] = await db
      .select({ isHidden: exams.isHidden })
      .from(exams)
      .where(eq(exams.id, saved.examId))
    expect(row?.isHidden).toBe(true)
  })
})
