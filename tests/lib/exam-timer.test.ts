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

const ONE_HOUR_MS = 3600000
const ONE_HOUR_S = 3600

describe("Exam Timer Utilities", () => {
  describe("calculateTimeRemaining", () => {
    it.each([
      { label: "partial (30 min in)", elapsed: 1800000, expected: 1800000 },
      { label: "just started", elapsed: 0, expected: ONE_HOUR_MS },
      { label: "exactly at limit", elapsed: ONE_HOUR_MS, expected: 0 },
      { label: "beyond limit (expired)", elapsed: 4000000, expected: 0 },
    ])("$label", ({ elapsed, expected }) => {
      const start = 1000000
      expect(calculateTimeRemaining(start, ONE_HOUR_S, start + elapsed)).toBe(
        expected,
      )
    })
  })

  describe("shouldAutoSubmit", () => {
    it.each([
      { timeRemaining: 0, expected: true },
      { timeRemaining: 1, expected: false },
      { timeRemaining: 1000, expected: false },
      { timeRemaining: -1000, expected: true }, // negative edge case
    ])("returns $expected when timeRemaining=$timeRemaining", ({
      timeRemaining,
      expected,
    }) => {
      expect(shouldAutoSubmit(timeRemaining)).toBe(expected)
    })
  })

  describe("formatExamTime", () => {
    it.each([
      { ms: 0, expected: "00:00:00" },
      { ms: 45000, expected: "00:00:45" },
      { ms: 125000, expected: "00:02:05" },
      { ms: ONE_HOUR_MS, expected: "01:00:00" },
      { ms: (1 * 3600 + 5 * 60 + 9) * 1000, expected: "01:05:09" }, // pad single digits
      { ms: (1 * 3600 + 30 * 60 + 45) * 1000, expected: "01:30:45" },
      { ms: (12 * 3600 + 34 * 60 + 56) * 1000, expected: "12:34:56" },
    ])("formats $ms ms as $expected", ({ ms, expected }) => {
      expect(formatExamTime(ms)).toBe(expected)
    })
  })

  describe("isWithinGracePeriod", () => {
    const max = ONE_HOUR_MS

    it.each([
      // Manual submission → 5s grace
      { elapsed: 3000000, isAuto: false, expected: true },
      { elapsed: max, isAuto: false, expected: true }, // exact limit
      { elapsed: max + 5000, isAuto: false, expected: true }, // exact grace
      { elapsed: max + 6000, isAuto: false, expected: false }, // beyond
      // Auto submission → 30s grace
      { elapsed: max + 25000, isAuto: true, expected: true },
      { elapsed: max + 30000, isAuto: true, expected: true },
      { elapsed: max + 31000, isAuto: true, expected: false },
    ])(
      "elapsed=$elapsed isAuto=$isAuto → $expected",
      ({ elapsed, isAuto, expected }) => {
        expect(isWithinGracePeriod(elapsed, max, isAuto)).toBe(expected)
      },
    )
  })

  describe("isTimeRunningOut (< 10 min)", () => {
    it.each([
      { ms: 11 * 60 * 1000, expected: false },
      { ms: 10 * 60 * 1000, expected: false }, // exactly 10 min → false
      { ms: 9 * 60 * 1000 + 59000, expected: true },
      { ms: 5 * 60 * 1000, expected: true },
      { ms: 0, expected: true },
    ])("$ms ms → $expected", ({ ms, expected }) => {
      expect(isTimeRunningOut(ms)).toBe(expected)
    })
  })

  describe("isTimeCritical (< 5 min)", () => {
    it.each([
      { ms: 6 * 60 * 1000, expected: false },
      { ms: 5 * 60 * 1000, expected: false }, // exactly 5 min → false
      { ms: 4 * 60 * 1000 + 59000, expected: true },
      { ms: 60 * 1000, expected: true },
      { ms: 0, expected: true },
    ])("$ms ms → $expected", ({ ms, expected }) => {
      expect(isTimeCritical(ms)).toBe(expected)
    })
  })

  describe("calculateProgress", () => {
    it.each([
      { index: 0, total: 10, expected: 10 },
      { index: 4, total: 10, expected: 50 },
      { index: 9, total: 10, expected: 100 },
      { index: 0, total: 1, expected: 100 }, // single question
      { index: 0, total: 0, expected: 0 }, // empty exam
    ])(
      "question $index of $total → $expected%",
      ({ index, total, expected }) => {
        expect(calculateProgress(index, total)).toBe(expected)
      },
    )

    it("handles non-round percentages", () => {
      expect(calculateProgress(0, 3)).toBeCloseTo(33.33, 1)
    })
  })

  describe("calculateScorePercentage", () => {
    it.each([
      { score: 10, total: 10, expected: 100 },
      { score: 0, total: 10, expected: 0 },
      { score: 5, total: 10, expected: 50 },
      { score: 7, total: 10, expected: 70 },
      { score: 2, total: 3, expected: 67 }, // rounds up
      { score: 1, total: 3, expected: 33 }, // rounds down
      { score: 0, total: 0, expected: 0 },
      { score: 175, total: 230, expected: 76 }, // large exam
    ])("$score/$total → $expected%", ({ score, total, expected }) => {
      expect(calculateScorePercentage(score, total)).toBe(expected)
    })
  })
})

// ==========================================
// PAUSE FUNCTIONALITY TESTS
// ==========================================

describe("Pause Functionality Utilities", () => {
  describe("shouldTriggerPause (>= 50% elapsed)", () => {
    it.each([
      { label: "0% elapsed (start)", elapsedMs: 0, expected: false },
      { label: "~28% elapsed", elapsedMs: 1000000, expected: false },
      { label: "exactly 50%", elapsedMs: 1800000, expected: true },
      { label: "~69% elapsed", elapsedMs: 2500000, expected: true },
    ])("$label", ({ elapsedMs, expected }) => {
      const start = 1000000
      expect(
        shouldTriggerPause(start, ONE_HOUR_S, start + elapsedMs),
      ).toBe(expected)
    })
  })

  describe("calculatePauseTimeRemaining", () => {
    const start = 1000000
    const DURATION = 15

    it.each([
      { label: "at start", elapsedMs: 0, expected: 15 * 60 * 1000 },
      { label: "5 min in", elapsedMs: 5 * 60 * 1000, expected: 10 * 60 * 1000 },
      { label: "exactly at end", elapsedMs: 15 * 60 * 1000, expected: 0 },
      { label: "past end", elapsedMs: 20 * 60 * 1000, expected: 0 },
    ])("$label → $expected ms", ({ elapsedMs, expected }) => {
      expect(
        calculatePauseTimeRemaining(start, DURATION, start + elapsedMs),
      ).toBe(expected)
    })
  })

  describe("isPauseExpired", () => {
    const start = 1000000

    it.each([
      { label: "pause remaining", elapsedMs: 5 * 60 * 1000, expected: false },
      { label: "exact expiration", elapsedMs: 15 * 60 * 1000, expected: true },
      { label: "past expiration", elapsedMs: 16 * 60 * 1000, expected: true },
    ])("$label → $expected", ({ elapsedMs, expected }) => {
      expect(isPauseExpired(start, 15, start + elapsedMs)).toBe(expected)
    })
  })

  describe("isQuestionAccessible", () => {
    it.each([
      // before_pause : accès aux questions du premier tiers (indices < moitié)
      { index: 0, total: 100, phase: "before_pause" as const, allowed: true },
      { index: 49, total: 100, phase: "before_pause" as const, allowed: true },
      { index: 50, total: 100, phase: "before_pause" as const, allowed: false },
      { index: 99, total: 100, phase: "before_pause" as const, allowed: false },
      // during_pause : jamais
      { index: 0, total: 100, phase: "during_pause" as const, allowed: false },
      { index: 50, total: 100, phase: "during_pause" as const, allowed: false },
      { index: 99, total: 100, phase: "during_pause" as const, allowed: false },
      // after_pause : toujours
      { index: 0, total: 100, phase: "after_pause" as const, allowed: true },
      { index: 50, total: 100, phase: "after_pause" as const, allowed: true },
      { index: 99, total: 100, phase: "after_pause" as const, allowed: true },
      // undefined : toujours
      { index: 0, total: 100, phase: undefined, allowed: true },
      { index: 99, total: 100, phase: undefined, allowed: true },
    ])(
      "index=$index total=$total phase=$phase → allowed=$allowed",
      ({ index, total, phase, allowed }) => {
        expect(isQuestionAccessible(index, total, phase).allowed).toBe(allowed)
      },
    )

    it("fournit une raison avant pause", () => {
      const result = isQuestionAccessible(50, 100, "before_pause")
      expect(result.reason).toContain("déverrouillée après la pause")
    })

    it("fournit une raison pendant pause", () => {
      const result = isQuestionAccessible(25, 100, "during_pause")
      expect(result.reason).toContain("pendant la pause")
    })

    it("gère nombre impair et petits examens", () => {
      // 101 questions → midpoint 50
      expect(isQuestionAccessible(49, 101, "before_pause").allowed).toBe(true)
      expect(isQuestionAccessible(50, 101, "before_pause").allowed).toBe(false)
      // 10 questions → midpoint 5
      expect(isQuestionAccessible(4, 10, "before_pause").allowed).toBe(true)
      expect(isQuestionAccessible(5, 10, "before_pause").allowed).toBe(false)
    })
  })

  describe("getAccessibleQuestionRange", () => {
    it.each([
      { phase: undefined, total: 100, start: 0, end: 99 },
      { phase: "after_pause" as const, total: 100, start: 0, end: 99 },
      { phase: "before_pause" as const, total: 100, start: 0, end: 49 },
      { phase: "during_pause" as const, total: 100, start: -1, end: -1 },
      // Nombre impair : midpoint = 50
      { phase: "before_pause" as const, total: 101, start: 0, end: 49 },
    ])(
      "phase=$phase total=$total → [$start,$end]",
      ({ phase, total, start, end }) => {
        expect(getAccessibleQuestionRange(total, phase)).toEqual({ start, end })
      },
    )
  })

  describe("formatPauseTime", () => {
    it.each([
      { ms: 0, expected: "00:00" },
      { ms: 3 * 60 * 1000 + 45 * 1000, expected: "03:45" }, // pad zero
      { ms: 5 * 60 * 1000 + 30 * 1000, expected: "05:30" },
      { ms: 15 * 60 * 1000, expected: "15:00" },
      { ms: 60 * 60 * 1000, expected: "60:00" }, // > 60 min format
    ])("$ms ms → $expected", ({ ms, expected }) => {
      expect(formatPauseTime(ms)).toBe(expected)
    })
  })

  describe("questionsUntilPause", () => {
    it.each([
      { index: 0, total: 100, expected: 49 }, // midpoint=50
      { index: 48, total: 100, expected: 1 },
      { index: 49, total: 100, expected: 0 }, // at midpoint
      { index: 60, total: 100, expected: 0 }, // past midpoint
      { index: 0, total: 101, expected: 49 }, // odd count
    ])("index=$index total=$total → $expected", ({ index, total, expected }) => {
      expect(questionsUntilPause(index, total)).toBe(expected)
    })
  })

  describe("isApproachingPause (< 10 questions away)", () => {
    it.each([
      { index: 0, total: 100, expected: false }, // far from pause
      { index: 38, total: 100, expected: false }, // 11 away
      { index: 40, total: 100, expected: true }, // 9 away
      { index: 45, total: 100, expected: true }, // 4 away
      { index: 50, total: 100, expected: false }, // at midpoint
      { index: 60, total: 100, expected: false }, // past midpoint
      { index: 0, total: 20, expected: true }, // small exam, midpoint=10
      { index: 5, total: 20, expected: true },
    ])("index=$index total=$total → $expected", ({ index, total, expected }) => {
      expect(isApproachingPause(index, total)).toBe(expected)
    })
  })
})
