import { describe, expect, it } from "vitest"
import {
  GRACE_MS,
  formatExamTime,
  formatPauseTime,
  isExpired,
  pauseCredit,
  pauseRemainingMs,
  remainingMs,
  zone,
} from "@/lib/attempt-clock"

const MIN = 60_000
const START = 1_000_000

describe("AttemptClock — remainingMs", () => {
  it("décompte le budget net du crédit de pause", () => {
    // 40 s écoulées − 20 s de pause = 20 s consommées sur 60.
    expect(
      remainingMs(
        { startedAt: START, budgetSeconds: 60, pauseCreditMs: 20_000 },
        START + 40_000,
      ),
    ).toBe(40_000)
  })

  it("ne dépasse jamais le budget, ancre antérieure au démarrage comprise", () => {
    expect(
      remainingMs(
        { startedAt: START, budgetSeconds: 60, pauseCreditMs: 0 },
        START - 90_000,
      ),
    ).toBe(60_000)
  })

  it("s'arrête à zéro une fois le budget consommé", () => {
    expect(
      remainingMs(
        { startedAt: START, budgetSeconds: 60, pauseCreditMs: 0 },
        START + 5 * MIN,
      ),
    ).toBe(0)
  })

  it("crédite une pause en cours, plafonnée à la durée autorisée", () => {
    // Démarré il y a 10 min, budget 5 min, en pause depuis 8 min.
    const timing = {
      startedAt: START,
      budgetSeconds: 5 * 60,
      pauseCreditMs: 0,
      pauseInProgress: { startedAt: START + 2 * MIN, capMinutes: 15 },
    }
    // Pause de 8 min sous le plafond : 10 − 8 = 2 min consommées, 3 restantes.
    expect(remainingMs(timing, START + 10 * MIN)).toBe(3 * MIN)
    // Plafond 1 min : 10 − 1 = 9 min consommées, budget épuisé.
    expect(
      remainingMs(
        {
          ...timing,
          pauseInProgress: { startedAt: START + 2 * MIN, capMinutes: 1 },
        },
        START + 10 * MIN,
      ),
    ).toBe(0)
  })
})

describe("AttemptClock — pauseCredit", () => {
  it("cumule le crédit figé et la pause en cours plafonnée", () => {
    expect(
      pauseCredit(
        {
          pauseCreditMs: 30_000,
          pauseInProgress: { startedAt: START + MIN, capMinutes: 1 },
        },
        START + 3 * MIN,
      ),
    ).toBe(90_000)
  })

  it("ne crédite rien pour une pause dont l'horloge serait dans le futur", () => {
    expect(
      pauseCredit(
        {
          pauseCreditMs: 5_000,
          pauseInProgress: { startedAt: START + 10 * MIN, capMinutes: 15 },
        },
        START + 3 * MIN,
      ),
    ).toBe(5_000)
  })
})

describe("AttemptClock — isExpired", () => {
  const timing = { startedAt: START, budgetSeconds: 332, pauseCreditMs: 0 }

  it("tolère la grâce au-delà du budget", () => {
    expect(GRACE_MS).toBe(10_000)
    expect(isExpired(timing, START + 332_000 + GRACE_MS)).toBe(false)
  })

  it("expire une milliseconde après la grâce", () => {
    expect(isExpired(timing, START + 332_000 + GRACE_MS + 1)).toBe(true)
  })

  it("le crédit de pause repousse l'expiration d'autant", () => {
    expect(
      isExpired(
        { ...timing, pauseCreditMs: 60_000 },
        START + 332_000 + GRACE_MS + 59_000,
      ),
    ).toBe(false)
  })
})

describe("AttemptClock — pauseRemainingMs", () => {
  const pause = { startedAt: START, capMinutes: 15 }

  it.each([
    { label: "au début", at: 0, expected: 15 * MIN },
    { label: "5 min plus tard", at: 5 * MIN, expected: 10 * MIN },
    { label: "à l'échéance", at: 15 * MIN, expected: 0 },
    { label: "après l'échéance", at: 20 * MIN, expected: 0 },
    {
      label: "ancre antérieure au début de pause",
      at: -5 * MIN,
      expected: 15 * MIN,
    },
  ])("$label → $expected ms", ({ at, expected }) => {
    expect(pauseRemainingMs(pause, START + at)).toBe(expected)
  })
})

describe("AttemptClock — zone", () => {
  it.each([
    { ms: 11 * MIN, expected: "normal" },
    { ms: 10 * MIN, expected: "normal" },
    { ms: 10 * MIN - 1, expected: "warning" },
    { ms: 5 * MIN, expected: "warning" },
    { ms: 5 * MIN - 1, expected: "critical" },
    { ms: 0, expected: "critical" },
  ])("$ms ms → $expected", ({ ms, expected }) => {
    expect(zone(ms)).toBe(expected)
  })
})

describe("AttemptClock — formats", () => {
  it.each([
    { ms: 0, expected: "00:00:00" },
    { ms: 45_000, expected: "00:00:45" },
    { ms: 125_000, expected: "00:02:05" },
    { ms: (1 * 3600 + 5 * 60 + 9) * 1000, expected: "01:05:09" },
    { ms: (12 * 3600 + 34 * 60 + 56) * 1000, expected: "12:34:56" },
  ])("formatExamTime($ms) → $expected", ({ ms, expected }) => {
    expect(formatExamTime(ms)).toBe(expected)
  })

  it.each([
    { ms: 0, expected: "00:00" },
    { ms: 3 * MIN + 45_000, expected: "03:45" },
    { ms: 15 * MIN, expected: "15:00" },
    { ms: 60 * MIN, expected: "60:00" },
  ])("formatPauseTime($ms) → $expected", ({ ms, expected }) => {
    expect(formatPauseTime(ms)).toBe(expected)
  })
})
