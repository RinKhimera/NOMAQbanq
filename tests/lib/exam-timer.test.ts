import { describe, expect, it } from "vitest"
import {
  calculateProgress,
  calculateScorePercentage,
  calculateTimeRemaining,
  formatExamTime,
  isTimeCritical,
  isTimeRunningOut,
  isWithinGracePeriod,
  shouldAutoSubmit,
} from "@/lib/exam-timer"

describe("Exam Timer Utilities", () => {
  describe("calculateTimeRemaining", () => {
    it("should calculate remaining time correctly", () => {
      const serverStartTime = 1000000
      const completionTimeSeconds = 3600 // 1 hour
      const currentTime = 1000000 + 1800000 // 30 minutes later

      const result = calculateTimeRemaining(
        serverStartTime,
        completionTimeSeconds,
        currentTime,
      )

      expect(result).toBe(1800000) // 30 minutes remaining
    })

    it("should return 0 when time has expired", () => {
      const serverStartTime = 1000000
      const completionTimeSeconds = 3600 // 1 hour
      const currentTime = 1000000 + 4000000 // More than 1 hour later

      const result = calculateTimeRemaining(
        serverStartTime,
        completionTimeSeconds,
        currentTime,
      )

      expect(result).toBe(0)
    })

    it("should return full time when just started", () => {
      const serverStartTime = 1000000
      const completionTimeSeconds = 3600 // 1 hour
      const currentTime = 1000000 // Same time

      const result = calculateTimeRemaining(
        serverStartTime,
        completionTimeSeconds,
        currentTime,
      )

      expect(result).toBe(3600000) // Full 1 hour
    })

    it("should handle exact boundary time", () => {
      const serverStartTime = 1000000
      const completionTimeSeconds = 3600 // 1 hour
      const currentTime = 1000000 + 3600000 // Exactly 1 hour later

      const result = calculateTimeRemaining(
        serverStartTime,
        completionTimeSeconds,
        currentTime,
      )

      expect(result).toBe(0)
    })
  })

  describe("shouldAutoSubmit", () => {
    it("should return true when time is 0", () => {
      expect(shouldAutoSubmit(0)).toBe(true)
    })

    it("should return false when time remains", () => {
      expect(shouldAutoSubmit(1000)).toBe(false)
    })

    it("should return false for 1ms remaining", () => {
      expect(shouldAutoSubmit(1)).toBe(false)
    })

    it("should return true for negative time (edge case)", () => {
      expect(shouldAutoSubmit(-1000)).toBe(true)
    })
  })

  describe("formatExamTime", () => {
    it("should format 0ms as 00:00:00", () => {
      expect(formatExamTime(0)).toBe("00:00:00")
    })

    it("should format 1 hour correctly", () => {
      expect(formatExamTime(3600000)).toBe("01:00:00")
    })

    it("should format 1 hour 30 minutes 45 seconds", () => {
      const ms = (1 * 60 * 60 + 30 * 60 + 45) * 1000
      expect(formatExamTime(ms)).toBe("01:30:45")
    })

    it("should format seconds only", () => {
      expect(formatExamTime(45000)).toBe("00:00:45")
    })

    it("should format minutes and seconds", () => {
      expect(formatExamTime(125000)).toBe("00:02:05")
    })

    it("should handle large values (10+ hours)", () => {
      const ms = 12 * 60 * 60 * 1000 + 34 * 60 * 1000 + 56 * 1000
      expect(formatExamTime(ms)).toBe("12:34:56")
    })

    it("should pad single digits with zeros", () => {
      const ms = (1 * 60 * 60 + 5 * 60 + 9) * 1000
      expect(formatExamTime(ms)).toBe("01:05:09")
    })
  })

  describe("isWithinGracePeriod", () => {
    const maxTimeMs = 3600000 // 1 hour

    describe("manual submission (5s grace)", () => {
      it("should return true when within time limit", () => {
        expect(isWithinGracePeriod(3000000, maxTimeMs, false)).toBe(true)
      })

      it("should return true at exact time limit", () => {
        expect(isWithinGracePeriod(maxTimeMs, maxTimeMs, false)).toBe(true)
      })

      it("should return true within 5s grace period", () => {
        expect(isWithinGracePeriod(maxTimeMs + 4000, maxTimeMs, false)).toBe(
          true,
        )
      })

      it("should return true at exactly 5s grace", () => {
        expect(isWithinGracePeriod(maxTimeMs + 5000, maxTimeMs, false)).toBe(
          true,
        )
      })

      it("should return false beyond 5s grace", () => {
        expect(isWithinGracePeriod(maxTimeMs + 6000, maxTimeMs, false)).toBe(
          false,
        )
      })
    })

    describe("auto submission (30s grace)", () => {
      it("should return true within 30s grace period", () => {
        expect(isWithinGracePeriod(maxTimeMs + 25000, maxTimeMs, true)).toBe(
          true,
        )
      })

      it("should return true at exactly 30s grace", () => {
        expect(isWithinGracePeriod(maxTimeMs + 30000, maxTimeMs, true)).toBe(
          true,
        )
      })

      it("should return false beyond 30s grace", () => {
        expect(isWithinGracePeriod(maxTimeMs + 31000, maxTimeMs, true)).toBe(
          false,
        )
      })
    })
  })

  describe("isTimeRunningOut", () => {
    it("should return false for time > 10 minutes", () => {
      expect(isTimeRunningOut(11 * 60 * 1000)).toBe(false)
    })

    it("should return false for exactly 10 minutes", () => {
      expect(isTimeRunningOut(10 * 60 * 1000)).toBe(false)
    })

    it("should return true for less than 10 minutes", () => {
      expect(isTimeRunningOut(9 * 60 * 1000 + 59000)).toBe(true)
    })

    it("should return true for 5 minutes", () => {
      expect(isTimeRunningOut(5 * 60 * 1000)).toBe(true)
    })

    it("should return true for 0", () => {
      expect(isTimeRunningOut(0)).toBe(true)
    })
  })

  describe("isTimeCritical", () => {
    it("should return false for time > 5 minutes", () => {
      expect(isTimeCritical(6 * 60 * 1000)).toBe(false)
    })

    it("should return false for exactly 5 minutes", () => {
      expect(isTimeCritical(5 * 60 * 1000)).toBe(false)
    })

    it("should return true for less than 5 minutes", () => {
      expect(isTimeCritical(4 * 60 * 1000 + 59000)).toBe(true)
    })

    it("should return true for 1 minute", () => {
      expect(isTimeCritical(60 * 1000)).toBe(true)
    })

    it("should return true for 0", () => {
      expect(isTimeCritical(0)).toBe(true)
    })
  })

  describe("calculateProgress", () => {
    it("should return 0 for first question of many", () => {
      // Index 0, question 1 of 10 = 10%
      expect(calculateProgress(0, 10)).toBe(10)
    })

    it("should return 100 for last question", () => {
      expect(calculateProgress(9, 10)).toBe(100)
    })

    it("should return 50 for middle question", () => {
      expect(calculateProgress(4, 10)).toBe(50)
    })

    it("should handle single question exam", () => {
      expect(calculateProgress(0, 1)).toBe(100)
    })

    it("should return 0 for empty exam", () => {
      expect(calculateProgress(0, 0)).toBe(0)
    })

    it("should handle non-round percentages", () => {
      // Question 1 of 3 = 33.33...%
      expect(calculateProgress(0, 3)).toBeCloseTo(33.33, 1)
    })
  })

  describe("calculateScorePercentage", () => {
    it("should return 100 for perfect score", () => {
      expect(calculateScorePercentage(10, 10)).toBe(100)
    })

    it("should return 0 for no correct answers", () => {
      expect(calculateScorePercentage(0, 10)).toBe(0)
    })

    it("should return 50 for half correct", () => {
      expect(calculateScorePercentage(5, 10)).toBe(50)
    })

    it("should round to nearest integer", () => {
      // 7/10 = 70%
      expect(calculateScorePercentage(7, 10)).toBe(70)
      // 2/3 = 66.67% -> 67%
      expect(calculateScorePercentage(2, 3)).toBe(67)
      // 1/3 = 33.33% -> 33%
      expect(calculateScorePercentage(1, 3)).toBe(33)
    })

    it("should handle 0 total questions", () => {
      expect(calculateScorePercentage(0, 0)).toBe(0)
    })

    it("should handle large exam", () => {
      expect(calculateScorePercentage(175, 230)).toBe(76)
    })
  })
})
