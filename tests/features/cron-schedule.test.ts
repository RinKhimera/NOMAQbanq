import { describe, expect, it, vi } from "vitest"
import { SCHEDULE } from "@/features/cron/schedule"

// L'ordre du cron est une donnée : on le lit, on ne le rejoue pas. Les six
// modules sont remplacés par des coquilles pour charger la liste sans base ;
// aucune n'est appelée.
vi.mock("@/features/exams/cron", () => ({
  closeExpiredExamParticipations: vi.fn(),
}))
vi.mock("@/features/training/cron", () => ({
  closeExpiredTrainingSessions: vi.fn(),
}))
vi.mock("@/features/users/cron", () => ({
  anonymizeExpiredDeletedAccounts: vi.fn(),
}))
vi.mock("@/features/notifications/cron", () => ({
  sendPendingNotifications: vi.fn(),
}))
vi.mock("@/features/payments/cron", () => ({
  auditProductPriceDrift: vi.fn(),
}))
vi.mock("@/lib/quiz-rate-limit", () => ({ cleanupQuizRateLimits: vi.fn() }))

const keys = SCHEDULE.map((t) => t.key)

describe("SCHEDULE", () => {
  it("garde les six clés du rapport JSON", () => {
    expect([...keys].sort()).toEqual([
      "anonymizedAccounts",
      "examParticipations",
      "notifications",
      "priceDrift",
      "quizRateLimitCleanup",
      "trainingSessions",
    ])
    expect(new Set(SCHEDULE.map((t) => t.tag)).size).toBe(SCHEDULE.length)
  })

  // Les notifications doivent voir les `auto_submitted` du même passage.
  it("les notifications partent après les deux clôtures", () => {
    const notifications = keys.indexOf("notifications")
    expect(notifications).toBeGreaterThan(keys.indexOf("examParticipations"))
    expect(notifications).toBeGreaterThan(keys.indexOf("trainingSessions"))
  })

  // Seul aller-retour hors Neon : une coupure à la limite de temps ne perd
  // qu'un rapport, jamais une clôture ni un courriel.
  it("la dérive des prix passe en dernier", () => {
    expect(keys.at(-1)).toBe("priceDrift")
  })
})
