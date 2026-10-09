import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { exams, questions, transactions, user, userBans } from "@/db/schema"
import { getMyAdminActivity } from "@/features/users/dal.activity"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"
import { TEST_OBJECTIVE_ID } from "../helpers/objective"
import { seedProduct } from "../helpers/seed-payments"

vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(),
  requireRole: vi.fn(),
}))

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()
const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY)

const me = createId()
const other = createId()
const candidate = createId()
let productId = ""

const signInAs = (id: string) =>
  vi.mocked(requireRole).mockResolvedValue({
    user: { id, role: "admin" },
    session: { id: createId() },
  } as never)

const newUser = async (name: string, role: "user" | "admin" = "user") => {
  const id = createId()
  await db.insert(user).values({ id, name, email: `${id}@test.invalid`, role })
  return id
}

const manualPayment = (o: {
  recordedBy: string
  amount: number
  currency: "CAD" | "XAF"
  createdAt: Date
}) =>
  db.insert(transactions).values({
    userId: candidate,
    productId,
    type: "manual",
    status: "completed",
    amountPaid: o.amount,
    currency: o.currency,
    recordedBy: o.recordedBy,
    accessType: "exam",
    durationDays: 30,
    accessExpiresAt: new Date(NOW + 30 * DAY),
    createdAt: o.createdAt,
    completedAt: o.createdAt,
  })

const exam = (o: {
  title: string
  createdBy: string
  createdAt: Date
  window?: { start: number; end: number }
}) =>
  db.insert(exams).values({
    title: o.title,
    createdBy: o.createdBy,
    createdAt: o.createdAt,
    targetQuestionCount: 10,
    ...(o.window
      ? {
          startDate: new Date(o.window.start),
          endDate: new Date(o.window.end),
          completionTime: 600,
          finalizedAt: o.createdAt,
        }
      : { finalizedAt: null }),
  })

const confirmedQuestion = (o: {
  text: string
  by: string
  confirmedAt: Date
  deleted?: boolean
}) =>
  db.insert(questions).values({
    question: o.text,
    correctAnswer: "A",
    options: ["A", "B"],
    objectiveId: TEST_OBJECTIVE_ID,
    domain: "Cardiologie",
    keyConfirmedBy: o.by,
    keyConfirmedAt: o.confirmedAt,
    keyConfirmedAnswerCount: 0,
    deletedAt: o.deleted ? at(0) : null,
  })

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: me,
      name: "Sandrine Admin",
      email: `${me}@test.invalid`,
      role: "admin",
    },
    {
      id: other,
      name: "Autre Admin",
      email: `${other}@test.invalid`,
      role: "admin",
    },
    { id: candidate, name: "Karim Haddad", email: `${candidate}@test.invalid` },
  ])
  productId = await seedProduct("exam_access", { name: "Accès Examens" })

  await manualPayment({
    recordedBy: me,
    amount: 5000,
    currency: "CAD",
    createdAt: at(9),
  })
  await manualPayment({
    recordedBy: me,
    amount: 3050,
    currency: "CAD",
    createdAt: at(1),
  })
  await manualPayment({
    recordedBy: me,
    amount: 85000,
    currency: "XAF",
    createdAt: at(5),
  })
  await manualPayment({
    recordedBy: other,
    amount: 9900,
    currency: "CAD",
    createdAt: at(0),
  })

  await exam({
    title: "EB ouvert",
    createdBy: me,
    createdAt: at(8),
    window: { start: NOW - DAY, end: NOW + DAY },
  })
  await exam({
    title: "EB à venir",
    createdBy: me,
    createdAt: at(7),
    window: { start: NOW + DAY, end: NOW + 2 * DAY },
  })
  await exam({
    title: "EB clos",
    createdBy: me,
    createdAt: at(30),
    window: { start: NOW - 3 * DAY, end: NOW - 2 * DAY },
  })
  await exam({ title: "EB en préparation", createdBy: me, createdAt: at(2) })
  await exam({
    title: "EB d'un autre",
    createdBy: other,
    createdAt: at(1),
    window: { start: NOW - DAY, end: NOW + DAY },
  })

  await confirmedQuestion({
    text: "Clé confirmée par moi",
    by: me,
    confirmedAt: at(3),
  })
  await confirmedQuestion({
    text: "Question supprimée",
    by: me,
    confirmedAt: at(4),
    deleted: true,
  })
  await confirmedQuestion({
    text: "Clé d'un autre",
    by: other,
    confirmedAt: at(3),
  })

  const active = await newUser("Lina Tremblay")
  const liftedByOther = await newUser("Paul Ngono")
  const liftedByMe = await newUser("Awa Diallo")
  await db.insert(userBans).values([
    { userId: active, reason: "r", bannedBy: me, bannedAt: at(6) },
    {
      userId: liftedByOther,
      reason: "r",
      bannedBy: me,
      bannedAt: at(20),
      liftedBy: other,
      liftedAt: at(19),
    },
    {
      userId: liftedByMe,
      reason: "r",
      bannedBy: other,
      bannedAt: at(15),
      liftedBy: me,
      liftedAt: at(10),
    },
  ])
})

describe("activité d'un administrateur", () => {
  it("compte ses seules actions, depuis toujours", async () => {
    signInAs(me)
    const activity = await getMyAdminActivity()

    expect(activity.manualPayments).toEqual({
      count: 3,
      totals: [
        { currency: "CAD", amount: 8050 },
        { currency: "XAF", amount: 85000 },
      ],
      lastAt: at(1),
    })
    expect(activity.exams).toEqual({ count: 4, openOrUpcoming: 2 })
    expect(activity.confirmedKeys).toBe(1)
    expect(activity.suspensions).toEqual({
      pronounced: 2,
      active: 1,
      lifted: 1,
    })
    expect(requireRole).toHaveBeenCalledWith(["admin"])
  })

  it("liste ses dernières actions, de la plus récente à la plus ancienne", async () => {
    signInAs(me)
    const { feed } = await getMyAdminActivity()

    expect(feed.map((item) => [item.kind, item.label])).toEqual([
      ["manual_payment", "Karim Haddad · Accès Examens"],
      ["exam_created", "EB en préparation"],
      ["key_confirmed", "Clé confirmée par moi"],
      ["manual_payment", "Karim Haddad · Accès Examens"],
      ["suspension", "Lina Tremblay"],
      ["exam_created", "EB à venir"],
      ["exam_created", "EB ouvert"],
      ["manual_payment", "Karim Haddad · Accès Examens"],
      ["suspension_lifted", "Awa Diallo"],
      ["suspension", "Paul Ngono"],
    ])
    expect(feed[0]).toMatchObject({ at: at(1), clientId: candidate })
    expect(feed[4]).toMatchObject({
      kind: "suspension",
      id: expect.any(String),
    })
  })

  it("additionne des montants au-delà de l'entier 32 bits", async () => {
    const big = await newUser("Gros volume", "admin")
    for (const createdAt of [at(1), at(2)])
      await manualPayment({
        recordedBy: big,
        amount: 2_000_000_000,
        currency: "XAF",
        createdAt,
      })
    signInAs(big)

    const { manualPayments } = await getMyAdminActivity()

    expect(manualPayments.totals).toEqual([
      { currency: "XAF", amount: 4_000_000_000 },
    ])
  })

  it("rend des zéros à un administrateur qui n'a encore rien fait", async () => {
    signInAs(await newUser("Nouvel Admin", "admin"))

    expect(await getMyAdminActivity()).toEqual({
      manualPayments: { count: 0, totals: [], lastAt: null },
      exams: { count: 0, openOrUpcoming: 0 },
      confirmedKeys: 0,
      suspensions: { pronounced: 0, active: 0, lifted: 0 },
      feed: [],
    })
  })
})
