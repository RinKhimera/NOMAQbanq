import { describe, expect, it } from "vitest"
import {
  calculatePauseTimeRemaining,
  calculateProgress,
  calculateScorePercentage,
  calculateTimeRemaining,
  formatExamTime,
  formatPauseTime,
  getAccessibleQuestionRange,
  isApproachingPause,
  isPauseExpired,
  isQuestionAccessible,
  isTimeCritical,
  isTimeRunningOut,
  isWithinGracePeriod,
  questionsUntilPause,
  shouldAutoSubmit,
  shouldTriggerPause,
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

// ==========================================
// PAUSE FUNCTIONALITY TESTS
// ==========================================

describe("Pause Functionality Utilities", () => {
  describe("shouldTriggerPause", () => {
    it("should return false when less than 50% time has elapsed", () => {
      const serverStartTime = 1000000
      const completionTimeSeconds = 3600 // 1 hour
      const currentTime = serverStartTime + 1000000 // ~27.78% elapsed

      expect(
        shouldTriggerPause(serverStartTime, completionTimeSeconds, currentTime),
      ).toBe(false)
    })

    it("should return true when exactly 50% time has elapsed", () => {
      const serverStartTime = 1000000
      const completionTimeSeconds = 3600 // 1 hour = 3600000ms
      const currentTime = serverStartTime + 1800000 // exactly 50%

      expect(
        shouldTriggerPause(serverStartTime, completionTimeSeconds, currentTime),
      ).toBe(true)
    })

    it("should return true when more than 50% time has elapsed", () => {
      const serverStartTime = 1000000
      const completionTimeSeconds = 3600 // 1 hour
      const currentTime = serverStartTime + 2500000 // ~69% elapsed

      expect(
        shouldTriggerPause(serverStartTime, completionTimeSeconds, currentTime),
      ).toBe(true)
    })

    it("should return false at exam start", () => {
      const serverStartTime = 1000000
      const completionTimeSeconds = 3600
      const currentTime = serverStartTime

      expect(
        shouldTriggerPause(serverStartTime, completionTimeSeconds, currentTime),
      ).toBe(false)
    })
  })

  describe("calculatePauseTimeRemaining", () => {
    it("should return full pause time at start", () => {
      const pauseStartedAt = 1000000
      const pauseDurationMinutes = 15
      const currentTime = pauseStartedAt

      expect(
        calculatePauseTimeRemaining(
          pauseStartedAt,
          pauseDurationMinutes,
          currentTime,
        ),
      ).toBe(15 * 60 * 1000) // 15 minutes in ms
    })

    it("should calculate remaining time correctly", () => {
      const pauseStartedAt = 1000000
      const pauseDurationMinutes = 15
      const currentTime = pauseStartedAt + 5 * 60 * 1000 // 5 minutes later

      expect(
        calculatePauseTimeRemaining(
          pauseStartedAt,
          pauseDurationMinutes,
          currentTime,
        ),
      ).toBe(10 * 60 * 1000) // 10 minutes remaining
    })

    it("should return 0 when pause time has expired", () => {
      const pauseStartedAt = 1000000
      const pauseDurationMinutes = 15
      const currentTime = pauseStartedAt + 20 * 60 * 1000 // 20 minutes later

      expect(
        calculatePauseTimeRemaining(
          pauseStartedAt,
          pauseDurationMinutes,
          currentTime,
        ),
      ).toBe(0)
    })

    it("should return 0 at exact expiration", () => {
      const pauseStartedAt = 1000000
      const pauseDurationMinutes = 15
      const currentTime = pauseStartedAt + 15 * 60 * 1000 // exactly 15 minutes

      expect(
        calculatePauseTimeRemaining(
          pauseStartedAt,
          pauseDurationMinutes,
          currentTime,
        ),
      ).toBe(0)
    })
  })

  describe("isPauseExpired", () => {
    it("should return false when pause time remains", () => {
      const pauseStartedAt = 1000000
      const pauseDurationMinutes = 15
      const currentTime = pauseStartedAt + 5 * 60 * 1000

      expect(
        isPauseExpired(pauseStartedAt, pauseDurationMinutes, currentTime),
      ).toBe(false)
    })

    it("should return true when pause time has expired", () => {
      const pauseStartedAt = 1000000
      const pauseDurationMinutes = 15
      const currentTime = pauseStartedAt + 16 * 60 * 1000

      expect(
        isPauseExpired(pauseStartedAt, pauseDurationMinutes, currentTime),
      ).toBe(true)
    })

    it("should return true at exact expiration", () => {
      const pauseStartedAt = 1000000
      const pauseDurationMinutes = 15
      const currentTime = pauseStartedAt + 15 * 60 * 1000

      expect(
        isPauseExpired(pauseStartedAt, pauseDurationMinutes, currentTime),
      ).toBe(true)
    })
  })

  describe("isQuestionAccessible", () => {
    describe("before_pause phase", () => {
      it("should allow access to questions in first half", () => {
        const result = isQuestionAccessible(0, 100, "before_pause")
        expect(result.allowed).toBe(true)
      })

      it("should allow access to question just before midpoint", () => {
        const result = isQuestionAccessible(49, 100, "before_pause")
        expect(result.allowed).toBe(true)
      })

      it("should deny access to questions in second half", () => {
        const result = isQuestionAccessible(50, 100, "before_pause")
        expect(result.allowed).toBe(false)
        expect(result.reason).toContain("déverrouillée après la pause")
      })

      it("should deny access to last question", () => {
        const result = isQuestionAccessible(99, 100, "before_pause")
        expect(result.allowed).toBe(false)
      })
    })

    describe("during_pause phase", () => {
      it("should deny access to all questions", () => {
        expect(isQuestionAccessible(0, 100, "during_pause").allowed).toBe(false)
        expect(isQuestionAccessible(50, 100, "during_pause").allowed).toBe(
          false,
        )
        expect(isQuestionAccessible(99, 100, "during_pause").allowed).toBe(
          false,
        )
      })

      it("should provide appropriate reason", () => {
        const result = isQuestionAccessible(25, 100, "during_pause")
        expect(result.reason).toContain("pendant la pause")
      })
    })

    describe("after_pause phase", () => {
      it("should allow access to all questions", () => {
        expect(isQuestionAccessible(0, 100, "after_pause").allowed).toBe(true)
        expect(isQuestionAccessible(50, 100, "after_pause").allowed).toBe(true)
        expect(isQuestionAccessible(99, 100, "after_pause").allowed).toBe(true)
      })
    })

    describe("undefined pause phase", () => {
      it("should allow access to all questions when no pause phase", () => {
        expect(isQuestionAccessible(0, 100, undefined).allowed).toBe(true)
        expect(isQuestionAccessible(99, 100, undefined).allowed).toBe(true)
      })
    })

    describe("edge cases", () => {
      it("should handle odd number of questions", () => {
        // 101 questions -> midpoint is 50
        expect(isQuestionAccessible(49, 101, "before_pause").allowed).toBe(true)
        expect(isQuestionAccessible(50, 101, "before_pause").allowed).toBe(
          false,
        )
      })

      it("should handle small exams", () => {
        // 10 questions -> midpoint is 5
        expect(isQuestionAccessible(4, 10, "before_pause").allowed).toBe(true)
        expect(isQuestionAccessible(5, 10, "before_pause").allowed).toBe(false)
      })
    })
  })

  describe("getAccessibleQuestionRange", () => {
    it("should return full range when no pause phase", () => {
      const result = getAccessibleQuestionRange(100, undefined)
      expect(result).toEqual({ start: 0, end: 99 })
    })

    it("should return full range after pause", () => {
      const result = getAccessibleQuestionRange(100, "after_pause")
      expect(result).toEqual({ start: 0, end: 99 })
    })

    it("should return first half range before pause", () => {
      const result = getAccessibleQuestionRange(100, "before_pause")
      expect(result).toEqual({ start: 0, end: 49 })
    })

    it("should return empty range during pause", () => {
      const result = getAccessibleQuestionRange(100, "during_pause")
      expect(result).toEqual({ start: -1, end: -1 })
    })

    it("should handle odd number of questions", () => {
      const result = getAccessibleQuestionRange(101, "before_pause")
      expect(result).toEqual({ start: 0, end: 49 }) // midpoint is 50, so 0-49 accessible
    })
  })

  describe("formatPauseTime", () => {
    it("should format 15 minutes correctly", () => {
      expect(formatPauseTime(15 * 60 * 1000)).toBe("15:00")
    })

    it("should format 5 minutes 30 seconds correctly", () => {
      expect(formatPauseTime(5 * 60 * 1000 + 30 * 1000)).toBe("05:30")
    })

    it("should format 0 time correctly", () => {
      expect(formatPauseTime(0)).toBe("00:00")
    })

    it("should format single digit minutes with leading zero", () => {
      expect(formatPauseTime(3 * 60 * 1000 + 45 * 1000)).toBe("03:45")
    })

    it("should handle 1 hour (60 minutes)", () => {
      expect(formatPauseTime(60 * 60 * 1000)).toBe("60:00")
    })
  })

  describe("questionsUntilPause", () => {
    it("should return correct count at start", () => {
      expect(questionsUntilPause(0, 100)).toBe(49) // midpoint at 50, so 49 questions until pause
    })

    it("should return correct count near midpoint", () => {
      expect(questionsUntilPause(48, 100)).toBe(1)
    })

    it("should return 0 at midpoint", () => {
      expect(questionsUntilPause(49, 100)).toBe(0)
    })

    it("should return 0 after midpoint", () => {
      expect(questionsUntilPause(60, 100)).toBe(0)
    })

    it("should handle odd question count", () => {
      expect(questionsUntilPause(0, 101)).toBe(49) // midpoint is 50
    })
  })

  describe("isApproachingPause", () => {
    it("should return false at start of exam", () => {
      expect(isApproachingPause(0, 100)).toBe(false)
    })

    it("should return true within 10 questions of pause", () => {
      expect(isApproachingPause(40, 100)).toBe(true) // 9 questions until pause
      expect(isApproachingPause(45, 100)).toBe(true) // 4 questions until pause
    })

    it("should return false at exactly 11 questions before pause", () => {
      expect(isApproachingPause(38, 100)).toBe(false) // 11 questions until pause
    })

    it("should return false at midpoint", () => {
      expect(isApproachingPause(50, 100)).toBe(false)
    })

    it("should return false after midpoint", () => {
      expect(isApproachingPause(60, 100)).toBe(false)
    })

    it("should handle small exams", () => {
      // 20 questions -> midpoint at 10
      expect(isApproachingPause(0, 20)).toBe(true) // 9 questions until pause
      expect(isApproachingPause(5, 20)).toBe(true) // 4 questions until pause
    })
  })
})
