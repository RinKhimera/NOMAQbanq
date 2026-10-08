import { and, eq } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { examParticipations, questions, user } from "@/db/schema"
import {
  finalizeExam,
  saveExamAnswer,
  startExam,
} from "@/features/exams/actions"
import {
  getExamAudience,
  getExamWithQuestions,
  getExamsWithParticipation,
} from "@/features/exams/dal"
import { searchSelectableUsers } from "@/features/users/dal"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"
import { createFinalizedExam, saveAndFinalize } from "../helpers/exam-form"
import { TEST_OBJECTIVE_ID } from "../helpers/objective"
import { seedAccess } from "../helpers/seed-payments"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))

const DAY = 24 * 60 * 60 * 1000

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
// Compte supprimé : ni sélectionnable ni admissible dans une audience.
const DELETED_ID = createId()

const qIds = Array.from({ length: 10 }, () => createId())

const setSession = (id: string, role: "user" | "admin") =>
  vi
    .mocked(getCurrentSession)
    .mockResolvedValue({ user: { id, role } } as never)
const asAdmin = () => setSession(ADMIN_ID, "admin")
const asMember = () => setSession(MEMBER_ID, "user")
const asOutsider = () => setSession(OUTSIDER_ID, "user")
const asSubscriber = () => setSession(SUBSCRIBER_ID, "user")
const asNoSub = () => setSession(NOSUB_ID, "user")

beforeAll(async () => {
  // Tous les noms contiennent « Aud » ; l'ordre alphabétique est celui des
  // lettres de tête.
  await db.insert(user).values([
    {
      id: ADMIN_ID,
      name: "ZAud admin",
      email: "aud-adm@test.invalid",
      role: "admin",
    },
    {
      id: MEMBER_ID,
      name: "AAud Alice Dupont",
      email: "aud-alice@test.invalid",
    },
    {
      id: MEMBER2_ID,
      name: "BAud Bob Martin",
      email: "aud-bob@test.invalid",
    },
    {
      id: OUTSIDER_ID,
      name: "CAud outsider",
      email: "aud-out@test.invalid",
    },
    {
      id: SUBSCRIBER_ID,
      name: "DAud subscriber",
      email: "aud-sub@test.invalid",
    },
    {
      id: NOSUB_ID,
      name: "EAud nosub",
      email: "aud-nosub@test.invalid",
    },
    {
      id: DELETED_ID,
      name: "0Aud supprimé",
      email: "aud-del@test.invalid",
      deletedAt: new Date(Date.now() - DAY),
    },
  ])
  // outsider + subscriber ont un abonnement examen actif ; member/member2/nosub n'en ont pas.
  const expires = new Date(Date.now() + 10 * DAY)
  await seedAccess(OUTSIDER_ID, "exam", expires)
  await seedAccess(SUBSCRIBER_ID, "exam", expires)

  await db.insert(questions).values(
    qIds.map((id, i) => ({
      id,
      question: `AudQ ${i} ?`,
      correctAnswer: "A",
      options: ["A", "B", "C", "D"],
      objectiveId: TEST_OBJECTIVE_ID,
      domain: "AUD",
    })),
  )
})

const now = () => Date.now()

const makeRestrictedExam = async (userIds: string[]): Promise<string> => {
  asAdmin()
  const t = now()
  const res = await createFinalizedExam({
    title: "Restreint",
    startDate: t - 3600_000,
    endDate: t + 3600_000,
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
  const res = await createFinalizedExam({
    title: "Abonnés",
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

/** L'admin réécrit l'audience d'un examen ouvert, jeu inchangé. */
const rewriteAudience = async (
  examId: string,
  audience: { audienceType: "restricted" | "subscribers"; userIds: string[] },
) => {
  asAdmin()
  const t = now()
  return saveAndFinalize({
    id: examId,
    title: "Restreint maj",
    startDate: t - 1000,
    endDate: t + DAY,
    questionIds: qIds,
    enablePause: false,
    audienceType: audience.audienceType,
    audienceUserIds: audience.userIds,
  })
}

/**
 * Examen restreint à member, qui y démarre sa participation puis est retiré
 * de l'audience (réécrite vers member2) : sa participation en cours reste
 * l'autorisation.
 */
const memberRemovedMidExam = async () => {
  const examId = await makeRestrictedExam([MEMBER_ID])
  asMember()
  const started = await startExam({ examId })
  if (!started.success) throw new Error(started.error)
  const up = await rewriteAudience(examId, {
    audienceType: "restricted",
    userIds: [MEMBER2_ID],
  })
  if (!up.success) throw new Error(up.error)
  asMember()
  return examId
}

const memberParticipation = (examId: string) =>
  db
    .select({ id: examParticipations.id })
    .from(examParticipations)
    .where(
      and(
        eq(examParticipations.examId, examId),
        eq(examParticipations.userId, MEMBER_ID),
      ),
    )

describe("searchSelectableUsers", () => {
  it("recherche par nom, exclut admins et comptes supprimés, triée par nom", async () => {
    asAdmin()
    const rows = await searchSelectableUsers({ query: "Aud", limit: 10 })
    expect(rows.map((u) => u.id)).toEqual([
      MEMBER_ID,
      MEMBER2_ID,
      OUTSIDER_ID,
      SUBSCRIBER_ID,
      NOSUB_ID,
    ])
  })

  it("borne le nombre de lignes à `limit`", async () => {
    asAdmin()
    const rows = await searchSelectableUsers({ query: "Aud", limit: 2 })
    expect(rows.map((u) => u.id)).toEqual([MEMBER_ID, MEMBER2_ID])
  })

  it("recherche par email", async () => {
    asAdmin()
    const rows = await searchSelectableUsers({ query: "aud-bob", limit: 10 })
    expect(rows.map((u) => u.id)).toEqual([MEMBER2_ID])
  })

  // `escapeLike` n'agit que sur le motif `ilike` : son effet n'est observable
  // que contre une vraie base, d'où sa place ici plutôt qu'en unitaire. Aucun
  // nom ni courriel semé ne contient ces caractères : un joker actif ramènerait
  // tout le monde.
  it.each(["%", "_"])(
    "traite le métacaractère LIKE %s littéralement",
    async (meta) => {
      asAdmin()
      expect(await searchSelectableUsers({ query: meta, limit: 50 })).toEqual(
        [],
      )
    },
  )

  it("traite la barre oblique inverse littéralement", async () => {
    // Non échappée, elle échapperait le `%` final du motif (`%\%`) : la
    // recherche viserait un `%` littéral et manquerait ce compte.
    const id = createId()
    await db.insert(user).values({
      id,
      name: "Barre\\oblique",
      email: "barre-oblique@test.invalid",
    })
    asAdmin()
    const rows = await searchSelectableUsers({ query: "\\", limit: 50 })
    expect(rows.map((u) => u.id)).toEqual([id])
  })
})

describe("création d'un examen complet — audience restreinte", () => {
  it("insère examAudience dédupliqué (doublon volontaire → length 2)", async () => {
    asAdmin()
    const t = now()
    const res = await createFinalizedExam({
      title: "Dedup",
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

  it("refuse une audience restreinte avec un compte supprimé (INVALID_USERS)", async () => {
    asAdmin()
    const t = now()
    const res = await createFinalizedExam({
      title: "BadUsers",
      startDate: t,
      endDate: t + DAY,
      questionIds: qIds,
      enablePause: false,
      audienceType: "restricted",
      audienceUserIds: [MEMBER_ID, DELETED_ID],
    })
    expect(res).toEqual({
      success: false,
      error: "Certains utilisateurs sélectionnés sont introuvables.",
    })
  })

  it("refuse une audience restreinte vide (validation zod)", async () => {
    asAdmin()
    const t = now()
    const res = await createFinalizedExam({
      title: "Empty",
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

describe("modification d'un examen complet — édition de l'audience", () => {
  it("réécrit l'audience ([member]→[member2]) puis vide en bascule subscribers, participations conservées", async () => {
    const examId = await memberRemovedMidExam()
    asAdmin()
    expect((await getExamAudience(examId)).map((u) => u.id)).toEqual([
      MEMBER2_ID,
    ])
    expect(await memberParticipation(examId)).toHaveLength(1)

    const up = await rewriteAudience(examId, {
      audienceType: "subscribers",
      userIds: [],
    })
    expect(up.success).toBe(true)
    expect(await getExamAudience(examId)).toHaveLength(0)
    expect(await memberParticipation(examId)).toHaveLength(1)
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

  it("subscribers : abonné autorisé, non-abonné refusé", async () => {
    const examId = await makeSubscribersExam()

    asSubscriber()
    expect((await startExam({ examId })).success).toBe(true)

    asNoSub()
    expect((await startExam({ examId })).success).toBe(false)
  })
})

describe("membre retiré de l'audience pendant sa participation", () => {
  it.each([
    [
      "finalise quand même",
      async (examId: string) =>
        expect(await finalizeExam({ examId })).toEqual({ success: true }),
    ],
    [
      "lit toujours les questions",
      async (examId: string) =>
        expect((await getExamWithQuestions(examId))?.questions).toHaveLength(
          qIds.length,
        ),
    ],
    [
      "enregistre toujours une réponse",
      async (examId: string) =>
        expect(
          await saveExamAnswer({
            examId,
            questionId: qIds[0],
            selectedAnswer: "A",
          }),
        ).toMatchObject({ success: true }),
    ],
  ])("%s", async (_, check) => {
    await check(await memberRemovedMidExam())
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

describe("getExamWithQuestions — anti-fuite du texte des questions restreintes", () => {
  it("restreint → null pour outsider (avec accès), questions pour membre", async () => {
    const examId = await makeRestrictedExam([MEMBER_ID])

    asOutsider() // abonné mais hors audience
    expect(await getExamWithQuestions(examId)).toBeNull()

    asMember()
    const view = await getExamWithQuestions(examId)
    expect(view?.questions).toHaveLength(qIds.length)
  })

  it("subscribers → null pour un utilisateur SANS accès exam actif", async () => {
    const examId = await makeSubscribersExam()

    asNoSub() // aucun abonnement
    expect(await getExamWithQuestions(examId)).toBeNull()

    asSubscriber() // abonné avec accès actif
    const view = await getExamWithQuestions(examId)
    expect(view?.questions).toHaveLength(qIds.length)
  })
})

describe("saveExamAnswer — la sélection octroie l'accès", () => {
  it("un membre restreint SANS abonnement peut enregistrer une réponse", async () => {
    const examId = await makeRestrictedExam([MEMBER_ID])

    asMember() // pas d'abonnement, mais membre
    const started = await startExam({ examId })
    expect(started.success).toBe(true)

    const res = await saveExamAnswer({
      examId,
      questionId: qIds[0],
      selectedAnswer: "A",
    })
    expect(res.success).toBe(true)
  })
})
