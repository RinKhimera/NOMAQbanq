import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "@/app/api/cron/close-expired/route"

// Route cron : garde fail-closed et ISOLATION des taches. L'invariant qui compte
// est le second — un echec de la cloture des examens ne doit pas empecher
// l'anonymisation RGPD de tourner. Le contenu de chaque tache est teste ailleurs
// (features/*/cron.ts).
const { mocks } = vi.hoisted(() => ({
  mocks: {
    captureServerError: vi.fn(),
    env: { CRON_SECRET: "s3cret" as string | undefined },
    closeExpiredExamParticipations: vi.fn(async () => ({ closedCount: 0 })),
    closeExpiredTrainingSessions: vi.fn(async () => ({ closedCount: 0 })),
    anonymizeExpiredDeletedAccounts: vi.fn(async () => ({
      anonymizedCount: 0,
    })),
    cleanupQuizRateLimits: vi.fn(async () => ({ deletedCount: 0 })),
    sendPendingNotifications: vi.fn(async () => ({
      examResultsSent: 0,
      accessRemindersSent: 0,
    })),
  },
}))

vi.mock("@/features/exams/cron", () => ({
  closeExpiredExamParticipations: mocks.closeExpiredExamParticipations,
}))
vi.mock("@/features/training/cron", () => ({
  closeExpiredTrainingSessions: mocks.closeExpiredTrainingSessions,
}))
vi.mock("@/features/users/cron", () => ({
  anonymizeExpiredDeletedAccounts: mocks.anonymizeExpiredDeletedAccounts,
}))
vi.mock("@/features/notifications/cron", () => ({
  sendPendingNotifications: mocks.sendPendingNotifications,
}))
vi.mock("@/lib/quiz-rate-limit", () => ({
  cleanupQuizRateLimits: mocks.cleanupQuizRateLimits,
}))
vi.mock("@/lib/env/server", () => ({ env: mocks.env }))
vi.mock("@/lib/observability", () => ({
  captureServerError: mocks.captureServerError,
}))

const call = (authorization?: string) =>
  GET(
    new Request("https://app.test/api/cron/close-expired", {
      headers: authorization ? { authorization } : {},
    }),
  )

beforeEach(() => {
  mocks.env.CRON_SECRET = "s3cret"
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "log").mockImplementation(() => {})
})

describe("garde d'authentification (fail-closed)", () => {
  it("secret non configure → 401, aucune tache lancee", async () => {
    mocks.env.CRON_SECRET = undefined
    const res = await call("Bearer s3cret")
    expect(res.status).toBe(401)
    expect(mocks.closeExpiredExamParticipations).not.toHaveBeenCalled()
  })

  it("en-tete absent → 401", async () => {
    const res = await call()
    expect(res.status).toBe(401)
    expect(mocks.closeExpiredExamParticipations).not.toHaveBeenCalled()
  })

  it("mauvais bearer → 401", async () => {
    const res = await call("Bearer autre")
    expect(res.status).toBe(401)
    expect(mocks.closeExpiredExamParticipations).not.toHaveBeenCalled()
  })
})

describe("execution des taches", () => {
  it("bearer valide → 200 et compte-rendu de chaque tache", async () => {
    mocks.closeExpiredExamParticipations.mockResolvedValueOnce({
      closedCount: 2,
    })
    mocks.sendPendingNotifications.mockResolvedValueOnce({
      examResultsSent: 3,
      accessRemindersSent: 1,
    })

    const res = await call("Bearer s3cret")
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      examParticipations: { closedCount: 2 },
      trainingSessions: { closedCount: 0 },
      anonymizedAccounts: { anonymizedCount: 0 },
      notifications: { examResultsSent: 3, accessRemindersSent: 1 },
      quizRateLimitCleanup: { deletedCount: 0 },
    })
  })

  // Les notifications doivent voir les `auto_submitted` du meme run.
  it("les notifications partent APRES les clotures", async () => {
    const order: string[] = []
    mocks.closeExpiredExamParticipations.mockImplementationOnce(async () => {
      order.push("examens")
      return { closedCount: 0 }
    })
    mocks.sendPendingNotifications.mockImplementationOnce(async () => {
      order.push("notifications")
      return { examResultsSent: 0, accessRemindersSent: 0 }
    })

    await call("Bearer s3cret")
    expect(order).toEqual(["examens", "notifications"])
  })

  // L'invariant central : sans isolation, un echec de la premiere tache
  // empecherait l'anonymisation RGPD de tourner.
  it("echec d'une tache → les suivantes tournent quand meme, 500 a la fin", async () => {
    const boom = new Error("poison row")
    mocks.closeExpiredExamParticipations.mockRejectedValueOnce(boom)

    const res = await call("Bearer s3cret")
    expect(res.status).toBe(500)
    expect(mocks.anonymizeExpiredDeletedAccounts).toHaveBeenCalled()
    expect(mocks.sendPendingNotifications).toHaveBeenCalled()
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[cron:exams]",
      boom,
      {
        detail: "clôture examens",
      },
    )
  })

  it("chaque tache est capturee sous son propre tag", async () => {
    mocks.closeExpiredTrainingSessions.mockRejectedValueOnce(new Error("t"))
    mocks.anonymizeExpiredDeletedAccounts.mockRejectedValueOnce(new Error("a"))
    mocks.cleanupQuizRateLimits.mockRejectedValueOnce(new Error("q"))
    mocks.sendPendingNotifications.mockRejectedValueOnce(new Error("n"))

    const res = await call("Bearer s3cret")
    expect(res.status).toBe(500)
    const tags = mocks.captureServerError.mock.calls.map((c) => c[0])
    expect(tags).toEqual([
      "[cron:trainings]",
      "[cron:anonymize]",
      "[cron:quiz-rl]",
      "[cron:notifications]",
    ])
  })
})
