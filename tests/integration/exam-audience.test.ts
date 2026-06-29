import { and, eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examParticipations,
  exams,
  products,
  questions,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import {
  createExam,
  finalizeExam,
  saveExamAnswer,
  startExam,
  updateExam,
} from "@/features/exams/actions"
import {
  getExamAudience,
  getExamLeaderboard,
  getExamWithQuestions,
  getExamsWithParticipation,
  getMyAvailableExams,
  getMyRecentExams,
} from "@/features/exams/dal"
import { searchSelectableUsers } from "@/features/users/dal"
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
// member : pas d'abonnement examen — la sélection octroie l'accès.
const MEMBER_ID = createId()
const MEMBER2_ID = createId()
// outsider : abonné examen actif, mais hors audience restreinte.
const OUTSIDER_ID = createId()
// subscriber : abonné examen actif (examens `subscribers`).
const SUBSCRIBER_ID = createId()
// nosub : aucun abonnement.
const NOSUB_ID = createId()
const PID = createId()

// q0..q3 : questions d'examen.
const qIds = Array.from({ length: 4 }, () => createId())

const setSession = (id: string, role: "user" | "admin") =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue({ user: { id, role } } as never)
const asAdmin = () => setSession(ADMIN_ID, "admin")
const asMember = () => setSession(MEMBER_ID, "user")
const asOutsider = () => setSession(OUTSIDER_ID, "user")
const asSubscriber = () => setSession(SUBSCRIBER_ID, "user")
const asNoSub = () => setSession(NOSUB_ID, "user")

const grantExamAccess = async (userId: string) => {
  const txId = createId()
  await db.insert(transactions).values({
    id: txId,
    userId,
    productId: PID,
    type: "manual",
    status: "completed",
    amountPaid: 5000,
    currency: "CAD",
    accessType: "exam",
    durationDays: 90,
    accessExpiresAt: new Date(Date.now() + 90 * DAY),
  })
  await db.insert(userAccess).values({
    userId,
    accessType: "exam",
    expiresAt: new Date(Date.now() + 10 * DAY),
    lastTransactionId: txId,
  })
}

const allUserIds = [
  ADMIN_ID,
  MEMBER_ID,
  MEMBER2_ID,
  OUTSIDER_ID,
  SUBSCRIBER_ID,
  NOSUB_ID,
]

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: ADMIN_ID,
      name: "ZAud admin",
      email: `aud-adm-${suffix}@test.invalid`,
    },
    {
      id: MEMBER_ID,
      name: "AAud Alice Dupont",
      email: `aud-alice-${suffix}@test.invalid`,
    },
    {
      id: MEMBER2_ID,
      name: "BAud Bob Martin",
      email: `aud-bob-${suffix}@test.invalid`,
    },
    {
      id: OUTSIDER_ID,
      name: "CAud outsider",
      email: `aud-out-${suffix}@test.invalid`,
    },
    {
      id: SUBSCRIBER_ID,
      name: "DAud subscriber",
      email: `aud-sub-${suffix}@test.invalid`,
    },
    {
      id: NOSUB_ID,
      name: "EAud nosub",
      email: `aud-nosub-${suffix}@test.invalid`,
    },
  ])
  await db.insert(products).values({
    id: PID,
    code: "exam_access",
    name: "Exam",
    description: "desc",
    priceCad: 5000,
    durationDays: 90,
    accessType: "exam",
    stripeProductId: `prod_aud_${suffix}`,
    stripePriceId: `price_aud_${suffix}`,
  })
  // outsider + subscriber ont un abonnement examen actif ; member/member2/nosub n'en ont pas.
  await grantExamAccess(OUTSIDER_ID)
  await grantExamAccess(SUBSCRIBER_ID)

  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `AudQ ${i} ${suffix} ?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectifCmc: `Obj ${suffix}`,
      domain: `AUD-${suffix}`,
    })),
  )
})

afterAll(async () => {
  // delete exams cascade : participations, réponses, examQuestions, examAudience.
  await db.delete(exams).where(eq(exams.createdBy, ADMIN_ID))
  await db.delete(userAccess).where(inArray(userAccess.userId, allUserIds))
  await db.delete(transactions).where(inArray(transactions.userId, allUserIds))
  await db.delete(questions).where(inArray(questions.id, qIds))
  await db.delete(products).where(eq(products.id, PID))
  await db.delete(user).where(inArray(user.id, allUserIds))
})

const now = () => Date.now()

const makeRestrictedExam = async (
  userIds: string[],
  opts?: { startDate?: number; endDate?: number },
): Promise<string> => {
  asAdmin()
  const t = now()
  const res = await createExam({
    title: `Restreint ${suffix} ${createId().slice(0, 4)}`,
    startDate: opts?.startDate ?? t - 3600_000,
    endDate: opts?.endDate ?? t + 3600_000,
    questionIds: qIds,
    enablePause: false,
    audienceType: "restricted",
    audienceUserIds: userIds,
  })
  if (!res.success) throw new Error(res.error)
  return res.examId
}

const makeSubscribersExam = async (): Promise<string> => {
  asAdmin()
  const t = now()
  const res = await createExam({
    title: `Abonnes ${suffix} ${createId().slice(0, 4)}`,
    startDate: t - 3600_000,
    endDate: t + 3600_000,
    questionIds: qIds,
    enablePause: false,
    audienceType: "subscribers",
    audienceUserIds: [],
  })
  if (!res.success) throw new Error(res.error)
  return res.examId
}

describe("searchSelectableUsers", () => {
  it("recherche par nom, exclut admins", async () => {
    asAdmin()
    const rows = await searchSelectableUsers({
      query: "Alice Dupont",
      limit: 10,
    })
    expect(rows.some((u) => u.id === MEMBER_ID)).toBe(true)
    expect(rows.every((u) => u.id !== ADMIN_ID)).toBe(true)
  })

  it("recherche par email", async () => {
    asAdmin()
    const rows = await searchSelectableUsers({
      query: `aud-bob-${suffix}`,
      limit: 10,
    })
    expect(rows.some((u) => u.id === MEMBER2_ID)).toBe(true)
  })
})

describe("createExam — audience restreinte", () => {
  it("insère examAudience dédupliqué (doublon volontaire → length 2)", async () => {
    asAdmin()
    const t = now()
    const res = await createExam({
      title: `Dedup ${suffix}`,
      startDate: t,
      endDate: t + DAY,
      questionIds: qIds,
      enablePause: false,
      audienceType: "restricted",
      audienceUserIds: [MEMBER_ID, MEMBER2_ID, MEMBER_ID], // doublon volontaire
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    const audience = await getExamAudience(res.examId)
    expect(audience).toHaveLength(2)
  })

  it("refuse une audience restreinte avec un userId inexistant (INVALID_USERS)", async () => {
    asAdmin()
    const t = now()
    const res = await createExam({
      title: `BadUsers ${suffix}`,
      startDate: t,
      endDate: t + DAY,
      questionIds: qIds,
      enablePause: false,
      audienceType: "restricted",
      audienceUserIds: [MEMBER_ID, createId()],
    })
    expect(res.success).toBe(false)
  })

  it("refuse une audience restreinte vide (validation zod)", async () => {
    asAdmin()
    const t = now()
    const res = await createExam({
      title: `Empty ${suffix}`,
      startDate: t,
      endDate: t + DAY,
      questionIds: qIds,
      enablePause: false,
      audienceType: "restricted",
      audienceUserIds: [],
    })
    expect(res.success).toBe(false)
  })
})

describe("updateExam — édition de l'audience", () => {
  it("réécrit l'audience ([member]→[member2]) puis vide en bascule subscribers, participations conservées", async () => {
    const examId = await makeRestrictedExam([MEMBER_ID])
    expect((await getExamAudience(examId)).map((u) => u.id)).toEqual([
      MEMBER_ID,
    ])

    // member démarre → crée une participation.
    asMember()
    const started = await startExam({ examId })
    expect(started.success).toBe(true)

    // update → restreint [member2].
    asAdmin()
    const t = now()
    const up1 = await updateExam({
      id: examId,
      title: `Restreint maj ${suffix}`,
      startDate: t - 1000,
      endDate: t + DAY,
      questionIds: qIds,
      enablePause: false,
      audienceType: "restricted",
      audienceUserIds: [MEMBER2_ID],
    })
    expect(up1.success).toBe(true)
    expect((await getExamAudience(examId)).map((u) => u.id)).toEqual([
      MEMBER2_ID,
    ])

    // Participation de member conservée malgré son retrait de l'audience.
    const [part] = await db
      .select({ id: examParticipations.id })
      .from(examParticipations)
      .where(
        and(
          eq(examParticipations.examId, examId),
          eq(examParticipations.userId, MEMBER_ID),
        ),
      )
      .limit(1)
    expect(part).toBeTruthy()

    // update → subscribers → audience vidée.
    const up2 = await updateExam({
      id: examId,
      title: `Bascule ${suffix}`,
      startDate: t - 1000,
      endDate: t + DAY,
      questionIds: qIds,
      enablePause: false,
      audienceType: "subscribers",
      audienceUserIds: [],
    })
    expect(up2.success).toBe(true)
    expect(await getExamAudience(examId)).toHaveLength(0)

    // Participation toujours là après la bascule.
    const [part2] = await db
      .select({ id: examParticipations.id })
      .from(examParticipations)
      .where(
        and(
          eq(examParticipations.examId, examId),
          eq(examParticipations.userId, MEMBER_ID),
        ),
      )
      .limit(1)
    expect(part2).toBeTruthy()
  })
})

describe("startExam — la sélection octroie l'accès (restreint)", () => {
  it("membre SANS abonnement autorisé ; outsider (abonné non-membre) refusé ; admin autorisé", async () => {
    const examId = await makeRestrictedExam([MEMBER_ID])

    asMember() // pas d'abonnement, mais membre
    expect((await startExam({ examId })).success).toBe(true)

    asOutsider() // abonné, mais hors audience
    expect((await startExam({ examId })).success).toBe(false)

    asAdmin()
    expect((await startExam({ examId })).success).toBe(true)
  })

  it("subscribers : abonné autorisé, non-abonné refusé (inchangé)", async () => {
    const examId = await makeSubscribersExam()

    asSubscriber()
    expect((await startExam({ examId })).success).toBe(true)

    asNoSub()
    expect((await startExam({ examId })).success).toBe(false)
  })
})

describe("finalizeExam — tolérant au retrait d'audience (#6)", () => {
  it("un membre démarre un restreint, est retiré de l'audience, puis finalise quand même", async () => {
    const examId = await makeRestrictedExam([MEMBER_ID])

    asMember()
    const started = await startExam({ examId })
    expect(started.success).toBe(true)

    // Admin retire member de l'audience (réécrit vers member2).
    asAdmin()
    const t = now()
    const up = await updateExam({
      id: examId,
      title: `Retrait ${suffix}`,
      startDate: t - 1000,
      endDate: t + DAY,
      questionIds: qIds,
      enablePause: false,
      audienceType: "restricted",
      audienceUserIds: [MEMBER2_ID],
    })
    expect(up.success).toBe(true)

    // member, retiré de l'audience mais avec participation in_progress, finalise.
    asMember()
    const fin = await finalizeExam({ examId })
    expect(fin.success).toBe(true)
  })
})

describe("getExamsWithParticipation — visibilité restreinte", () => {
  it("restreint visible pour le membre + admin, absent pour l'outsider", async () => {
    const examId = await makeRestrictedExam([MEMBER_ID])

    asMember()
    expect(
      (await getExamsWithParticipation()).some((e) => e.id === examId),
    ).toBe(true)

    asAdmin()
    expect(
      (await getExamsWithParticipation()).some((e) => e.id === examId),
    ).toBe(true)

    asOutsider() // abonné, mais hors audience
    expect(
      (await getExamsWithParticipation()).some((e) => e.id === examId),
    ).toBe(false)
  })
})

describe("getExamLeaderboard — restreint clos masqué aux non-membres (#3)", () => {
  it("restreint clos : [] pour outsider (avec accès actif), non vide pour membre + admin", async () => {
    const t = now()
    // Examen restreint CLOS (endDate passée) avec member dans l'audience.
    const examId = await makeRestrictedExam([MEMBER_ID], {
      startDate: t - 3 * DAY,
      endDate: t - DAY,
    })
    // Participation complétée seedée directement (startExam refuserait hors fenêtre).
    await db.insert(examParticipations).values({
      id: createId(),
      examId,
      userId: MEMBER_ID,
      status: "completed",
      score: 75,
      startedAt: new Date(t - 3 * DAY + 1000),
      completedAt: new Date(t - 2 * DAY),
    })

    asMember()
    expect((await getExamLeaderboard(examId)).length).toBeGreaterThanOrEqual(1)

    asAdmin()
    expect((await getExamLeaderboard(examId)).length).toBeGreaterThanOrEqual(1)

    asOutsider() // accès examen actif mais hors audience → masqué
    expect(await getExamLeaderboard(examId)).toEqual([])
  })
})

describe("getExamWithQuestions — anti-fuite du texte des questions restreintes", () => {
  it("restreint → null pour outsider (avec accès), questions pour membre", async () => {
    const examId = await makeRestrictedExam([MEMBER_ID])

    asOutsider() // abonné mais hors audience
    expect(await getExamWithQuestions(examId)).toBeNull()

    asMember()
    const view = await getExamWithQuestions(examId)
    expect(view?.questions).toHaveLength(qIds.length)
  })

  it("restreint → questions pour un membre RETIRÉ de l'audience mais avec participation in_progress (#6)", async () => {
    const examId = await makeRestrictedExam([MEMBER_ID])

    // member démarre → participation in_progress.
    asMember()
    const started = await startExam({ examId })
    expect(started.success).toBe(true)

    // Admin retire member de l'audience.
    asAdmin()
    const t = now()
    const up = await updateExam({
      id: examId,
      title: `RetraitQ ${suffix}`,
      startDate: t - 1000,
      endDate: t + DAY,
      questionIds: qIds,
      enablePause: false,
      audienceType: "restricted",
      audienceUserIds: [MEMBER2_ID],
    })
    expect(up.success).toBe(true)

    // member n'est plus dans l'audience mais garde l'accès via sa participation.
    asMember()
    const view = await getExamWithQuestions(examId)
    expect(view?.questions).toHaveLength(qIds.length)
  })
})

describe("saveExamAnswer — la sélection octroie l'accès (D1)", () => {
  it("un membre restreint SANS abonnement peut enregistrer une réponse", async () => {
    const examId = await makeRestrictedExam([MEMBER_ID])

    asMember() // pas d'abonnement, mais membre
    const started = await startExam({ examId })
    expect(started.success).toBe(true)

    const view = await getExamWithQuestions(examId)
    const qId = view!.questions[0]._id
    const res = await saveExamAnswer({
      examId,
      questionId: qId,
      selectedAnswer: "A",
    })
    expect(res.success).toBe(true)
  })

  it("un membre retiré de l'audience en cours peut toujours enregistrer (#6)", async () => {
    const examId = await makeRestrictedExam([MEMBER_ID])

    asMember()
    const started = await startExam({ examId })
    expect(started.success).toBe(true)
    const view = await getExamWithQuestions(examId)
    const qId = view!.questions[0]._id

    // Admin retire member de l'audience pendant la passation.
    asAdmin()
    const t = now()
    const up = await updateExam({
      id: examId,
      title: `RetraitSA ${suffix}`,
      startDate: t - 1000,
      endDate: t + DAY,
      questionIds: qIds,
      enablePause: false,
      audienceType: "restricted",
      audienceUserIds: [MEMBER2_ID],
    })
    expect(up.success).toBe(true)

    // La participation in_progress reste l'autorisation.
    asMember()
    const res = await saveExamAnswer({
      examId,
      questionId: qId,
      selectedAnswer: "A",
    })
    expect(res.success).toBe(true)
  })
})

describe("dashboard étudiant — restreint masqué aux non-membres (D3)", () => {
  it("getMyAvailableExams/getMyRecentExams : restreint visible pour un membre abonné, masqué pour un abonné non-membre", async () => {
    // Restreint incluant SUBSCRIBER (qui a un abonnement actif) ; OUTSIDER est
    // abonné mais hors audience → ne doit voir le restreint nulle part sur son
    // dashboard. (getMyAvailableExams borné à 100 → présence/absence fiables.)
    const examId = await makeRestrictedExam([SUBSCRIBER_ID])

    asSubscriber() // abonné ET membre
    expect((await getMyAvailableExams()).some((e) => e.id === examId)).toBe(
      true,
    )

    asOutsider() // abonné mais NON-membre
    expect((await getMyAvailableExams()).some((e) => e.id === examId)).toBe(
      false,
    )
    expect((await getMyRecentExams()).some((e) => e.id === examId)).toBe(false)
  })
})
