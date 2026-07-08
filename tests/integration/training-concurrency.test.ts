import { eq } from "drizzle-orm"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { db } from "@/db"
import {
  questions,
  trainingSessionItems,
  trainingSessions,
  user,
} from "@/db/schema"
import {
  abandonTrainingSession,
  completeTrainingSession,
} from "@/features/training/actions"
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
const USER_ID = createId()
const QID = createId()

beforeAll(async () => {
  await db.insert(user).values({
    id: USER_ID,
    name: "IT concurrence",
    email: `conc-${suffix}@test.invalid`,
  })
  await db.insert(questions).values({
    id: QID,
    question: `Q ${suffix} ?`,
    correctAnswer: "A",
    options: ["A", "B", "C", "D"],
    objectifCmc: `Obj ${suffix}`,
    domain: `CONC-${suffix}`,
  })
})

beforeEach(() => {
  vi.mocked(getCurrentSession).mockResolvedValue({
    user: { id: USER_ID, role: "admin" },
  } as never)
})

const seedSession = async (o: {
  status: "in_progress" | "completed" | "abandoned"
  expiresAt: Date
}) => {
  const id = createId()
  const now = Date.now()
  await db.insert(trainingSessions).values({
    id,
    userId: USER_ID,
    status: o.status,
    questionCount: 1,
    startedAt: new Date(now - 3600_000),
    completedAt: o.status === "completed" ? new Date(now - 1000) : null,
    expiresAt: o.expiresAt,
    score: o.status === "completed" ? 100 : null,
  })
  await db.insert(trainingSessionItems).values({
    id: createId(),
    sessionId: id,
    questionId: QID,
    position: 0,
    selectedAnswer: "A",
    isCorrect: true,
  })
  return id
}

const statusOf = (id: string) =>
  db
    .select({
      status: trainingSessions.status,
      score: trainingSessions.score,
    })
    .from(trainingSessions)
    .where(eq(trainingSessions.id, id))
    .limit(1)
    .then((r) => r[0])

describe("clôture de session : gardes de statut + expiration", () => {
  it("session expirée : complétion refusée et session basculée abandonnée", async () => {
    const sid = await seedSession({
      status: "in_progress",
      expiresAt: new Date(Date.now() - DAY),
    })
    const res = await completeTrainingSession({ sessionId: sid })
    expect(res.success).toBe(false)
    expect((await statusOf(sid))?.status).toBe("abandoned")
  })

  it("session abandonnée par le cron : complétion refusée, statut intact", async () => {
    const sid = await seedSession({
      status: "abandoned",
      expiresAt: new Date(Date.now() + DAY),
    })
    const res = await completeTrainingSession({ sessionId: sid })
    expect(res.success).toBe(false)
    expect((await statusOf(sid))?.status).toBe("abandoned")
  })

  it("session complétée : abandon refusé, statut et score intacts", async () => {
    const sid = await seedSession({
      status: "completed",
      expiresAt: new Date(Date.now() + DAY),
    })
    const res = await abandonTrainingSession({ sessionId: sid })
    expect(res.success).toBe(false)
    const s = await statusOf(sid)
    expect(s?.status).toBe("completed")
    expect(s?.score).toBe(100)
  })

  it("race complete/abandon concurrents : exactement une clôture gagne", async () => {
    const sid = await seedSession({
      status: "in_progress",
      expiresAt: new Date(Date.now() + DAY),
    })

    const [complete, abandon] = await Promise.all([
      completeTrainingSession({ sessionId: sid }),
      abandonTrainingSession({ sessionId: sid }),
    ])

    expect([complete, abandon].filter((r) => r.success)).toHaveLength(1)

    const s = await statusOf(sid)
    if (complete.success) {
      expect(s?.status).toBe("completed")
      expect(s?.score).toBe(100)
    } else {
      expect(s?.status).toBe("abandoned")
    }
  })
})

afterAll(async () => {
  await db.delete(trainingSessions).where(eq(trainingSessions.userId, USER_ID))
  await db.delete(questions).where(eq(questions.id, QID))
  await db.delete(user).where(eq(user.id, USER_ID))
})
