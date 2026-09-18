import { describe, expect, it } from "vitest"
import { canReadResults, isOpen, partition, phaseOf } from "@/lib/exam-phase"

const NOW = 1_700_000_000_000

describe("ExamPhase — phaseOf", () => {
  it.each([
    {
      label: "désactivé, quelles que soient les dates",
      exam: { isActive: false, startDate: NOW - 1000, endDate: NOW + 1000 },
      expected: "inactive",
    },
    {
      label: "à venir 1 ms avant l'ouverture",
      exam: { isActive: true, startDate: NOW + 1, endDate: NOW + 10_000 },
      expected: "upcoming",
    },
    {
      label: "en cours à l'instant exact d'ouverture",
      exam: { isActive: true, startDate: NOW, endDate: NOW + 10_000 },
      expected: "active",
    },
    {
      label: "encore en cours à l'instant exact de fermeture",
      exam: { isActive: true, startDate: NOW - 10_000, endDate: NOW },
      expected: "active",
    },
    {
      label: "terminé 1 ms après la fermeture",
      exam: { isActive: true, startDate: NOW - 10_000, endDate: NOW - 1 },
      expected: "completed",
    },
    {
      label: "à venir prime sur terminé (dates incohérentes)",
      exam: { isActive: true, startDate: NOW + 1000, endDate: NOW - 1000 },
      expected: "upcoming",
    },
  ])("$label → $expected", ({ exam, expected }) => {
    expect(phaseOf(exam, NOW)).toBe(expected)
  })
})

describe("ExamPhase — isOpen (date de fin non passée)", () => {
  it("un examen à venir est ouvert", () => {
    expect(isOpen({ endDate: NOW + 10_000 }, NOW)).toBe(true)
  })
  it("un examen fermé depuis 1 ms ne l'est plus", () => {
    expect(isOpen({ endDate: NOW - 1 }, NOW)).toBe(false)
  })
})

describe("ExamPhase — partition", () => {
  it("classe les examens actifs par phase et écarte les désactivés", () => {
    const active = {
      id: "a",
      isActive: true,
      startDate: NOW - 1,
      endDate: NOW + 1,
    }
    const upcoming = {
      id: "u",
      isActive: true,
      startDate: NOW + 1,
      endDate: NOW + 2,
    }
    const past = {
      id: "p",
      isActive: true,
      startDate: NOW - 2,
      endDate: NOW - 1,
    }
    const off = {
      id: "o",
      isActive: false,
      startDate: NOW - 1,
      endDate: NOW + 1,
    }
    expect(partition([past, off, upcoming, active], NOW)).toEqual({
      active: [active],
      upcoming: [upcoming],
      completed: [past],
    })
  })
})

describe("ExamPhase — canReadResults", () => {
  const open = { endDate: NOW + 1000 }
  const closed = { endDate: NOW - 1000 }

  it("un admin lit les résultats d'un examen ouvert", () => {
    expect(canReadResults(open, { role: "admin" }, NOW)).toBe(true)
  })
  it("un étudiant attend la fermeture", () => {
    expect(canReadResults(open, { role: "user" }, NOW)).toBe(false)
    expect(canReadResults(closed, { role: "user" }, NOW)).toBe(true)
  })
  it("un anonyme attend aussi la fermeture", () => {
    expect(canReadResults(open, null, NOW)).toBe(false)
    expect(canReadResults(closed, null, NOW)).toBe(true)
  })
})
