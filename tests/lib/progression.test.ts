import { describe, expect, it } from "vitest"
import {
  coveragePercent,
  formatTrend,
  isProgressionEmpty,
  masteryTrend,
  periodEyebrow,
  sortDomains,
} from "@/lib/progression"

const d = (
  domain: string,
  mastery: number | null,
  trend: number | null = null,
  answered = 10,
) => ({ domain, mastery, trend, answered })

const domains = [
  d("Neurologie", null),
  d("Cardiologie", 80, -3),
  d("Pédiatrie", 40, 5),
  d("Anesthésie-Réanimation", null),
  d("Psychiatrie", 60, null),
  d("Urologie", 10, 2, 2),
]
const names = (rows: { domain: string }[]) => rows.map((r) => r.domain)

describe("sortDomains", () => {
  it("« Plus faibles » : significatifs par maîtrise croissante, peu pratiqués après, jamais pratiqués en fin par nom", () => {
    expect(names(sortDomains(domains, "weakest", "30"))).toEqual([
      "Pédiatrie",
      "Psychiatrie",
      "Cardiologie",
      "Urologie",
      "Anesthésie-Réanimation",
      "Neurologie",
    ])
  })

  it("« Tendance » : plus fort recul d'abord, tendance absente après", () => {
    expect(names(sortDomains(domains, "trend", "30"))).toEqual([
      "Cardiologie",
      "Urologie",
      "Pédiatrie",
      "Psychiatrie",
      "Anesthésie-Réanimation",
      "Neurologie",
    ])
  })

  it("« Tendance » sur « Tout » retombe sur « Plus faibles »", () => {
    expect(sortDomains(domains, "trend", "tout")).toEqual(
      sortDomains(domains, "weakest", "tout"),
    )
  })

  it("« A–Z » : ordre alphabétique français, jamais pratiqués toujours en fin", () => {
    expect(names(sortDomains(domains, "az", "7"))).toEqual([
      "Cardiologie",
      "Pédiatrie",
      "Psychiatrie",
      "Urologie",
      "Anesthésie-Réanimation",
      "Neurologie",
    ])
  })
})

describe("coveragePercent", () => {
  it("arrondit à l'entier inférieur", () => {
    expect(coveragePercent(2, 3)).toBe(66)
    expect(coveragePercent(0, 40)).toBe(0)
  })

  it("rend null sans question active, jamais 0 %", () => {
    expect(coveragePercent(0, 0)).toBeNull()
  })
})

describe("isProgressionEmpty", () => {
  it("vide sans historique ni domaine pratiqué", () => {
    expect(
      isProgressionEmpty({ hasHistory: false, domains: [{ mastery: null }] }),
    ).toBe(true)
  })

  it("pleine dès qu'un domaine est pratiqué, même sans série close (série abandonnée)", () => {
    expect(
      isProgressionEmpty({
        hasHistory: false,
        domains: [{ mastery: null }, { mastery: 40 }],
      }),
    ).toBe(false)
  })

  it("pleine avec un historique, même sans réponse comptée", () => {
    expect(
      isProgressionEmpty({ hasHistory: true, domains: [{ mastery: null }] }),
    ).toBe(false)
  })
})

describe("masteryTrend", () => {
  const counts = (correct: number, answered: number) => ({ correct, answered })

  it("arrondit au plancher l'écart des parts brutes, pas l'écart des maîtrises arrondies", () => {
    // 50,4 % → 49,6 % : les deux s'affichent 50 %, le recul vaut −0,8 → −1.
    expect(masteryTrend(counts(62, 125), counts(63, 125))).toBe(-1)
    // 50,4 % → 50,79 % : 50 % puis 51 %, mais +0,39 → 0.
    expect(masteryTrend(counts(64, 126), counts(63, 125))).toBe(0)
  })

  it("rend l'écart exact quand il est entier", () => {
    expect(masteryTrend(counts(2, 2), counts(1, 2))).toBe(50)
    expect(masteryTrend(counts(0, 1), counts(1, 1))).toBe(-100)
    expect(masteryTrend(counts(1, 3), counts(2, 6))).toBe(0)
  })
})

describe("formatTrend", () => {
  it.each([
    [4, "+4"],
    [-2, "−2"],
    [0, "0"],
    [null, "—"],
  ])("%s → %s", (trend, text) => {
    expect(formatTrend(trend)).toBe(text)
  })
})

describe("periodEyebrow", () => {
  it.each([
    ["7", "Rapport · 7 derniers jours"],
    ["30", "Rapport · 30 derniers jours"],
    ["tout", "Rapport · depuis l'inscription"],
  ] as const)("%s → %s", (period, text) => {
    expect(periodEyebrow(period)).toBe(text)
  })
})
