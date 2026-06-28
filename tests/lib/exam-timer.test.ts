import { describe, expect, it } from "vitest"
import {
  calculatePauseTimeRemaining,
  calculateTimeRemaining,
  formatExamTime,
  formatPauseTime,
  isPauseExpired,
  isTimeCritical,
  isTimeRunningOut,
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
})

// ==========================================
// PAUSE FUNCTIONALITY TESTS
// ==========================================

describe("Pause Functionality Utilities", () => {
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
})
