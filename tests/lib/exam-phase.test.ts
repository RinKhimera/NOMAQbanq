import { describe, expect, it } from "vitest"
import {
  adminPhaseOf,
  adminSectionOf,
  canReadResults,
  isOpen,
  partition,
  phaseOf,
} from "@/lib/exam-phase"

const NOW = 1_700_000_000_000

describe("ExamPhase — phaseOf", () => {
  it.each([
    {
      label: "suspendu prime sur en cours",
      exam: { isActive: false, startDate: NOW - 1000, endDate: NOW + 1000 },
      expected: "suspended",
    },
    {
      label: "suspendu prime sur à venir",
      exam: { isActive: false, startDate: NOW + 1000, endDate: NOW + 2000 },
      expected: "suspended",
    },
    {
      label: "clos : terminé, suspendu ou non",
      exam: { isActive: false, startDate: NOW - 2000, endDate: NOW },
      expected: "completed",
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
      label:
        "terminé à l'instant exact de fermeture (même borne que le verrou)",
      exam: { isActive: true, startDate: NOW - 10_000, endDate: NOW },
      expected: "completed",
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

describe("ExamPhase — adminPhaseOf (préparation comprise)", () => {
  it.each([
    {
      label: "en préparation sans dates",
      exam: {
        isActive: true,
        finalizedAt: null,
        startDate: null,
        endDate: null,
      },
      expected: "preparation",
    },
    {
      label: "en préparation même daté et ouvert par les dates",
      exam: {
        isActive: true,
        finalizedAt: null,
        startDate: NOW - 1000,
        endDate: NOW + 1000,
      },
      expected: "preparation",
    },
    {
      label: "la préparation prime sur la suspension",
      exam: {
        isActive: false,
        finalizedAt: null,
        startDate: null,
        endDate: null,
      },
      expected: "preparation",
    },
    {
      label: "finalisé, ouvert et suspendu",
      exam: {
        isActive: false,
        finalizedAt: NOW - 5000,
        startDate: NOW - 1000,
        endDate: NOW + 1000,
      },
      expected: "suspended",
    },
    {
      label: "finalisé, clos et suspendu : terminé",
      exam: {
        isActive: false,
        finalizedAt: NOW - 5000,
        startDate: NOW - 2000,
        endDate: NOW - 1000,
      },
      expected: "completed",
    },
    {
      label: "finalisé : phase par les dates",
      exam: {
        isActive: true,
        finalizedAt: NOW - 5000,
        startDate: NOW - 1000,
        endDate: NOW + 1000,
      },
      expected: "active",
    },
  ])("$label → $expected", ({ exam, expected }) => {
    expect(adminPhaseOf(exam, NOW)).toBe(expected)
  })
})

describe("ExamPhase — adminSectionOf", () => {
  const exam = (isActive: boolean, startDate: number, endDate: number) => ({
    isActive,
    finalizedAt: NOW - 5000,
    startDate,
    endDate,
  })

  it("un suspendu reste dans la section de ses dates", () => {
    expect(adminSectionOf(exam(false, NOW - 1000, NOW + 1000), NOW)).toBe(
      "active",
    )
    expect(adminSectionOf(exam(false, NOW + 1000, NOW + 2000), NOW)).toBe(
      "upcoming",
    )
    expect(adminSectionOf(exam(false, NOW - 2000, NOW - 1000), NOW)).toBe(
      "completed",
    )
  })

  it("un examen en préparation reste en préparation", () => {
    expect(
      adminSectionOf(
        { isActive: true, finalizedAt: null, startDate: null, endDate: null },
        NOW,
      ),
    ).toBe("preparation")
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
  it("classe les examens par leurs dates, un suspendu dans sa section", () => {
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
    const suspendedNow = {
      id: "s",
      isActive: false,
      startDate: NOW - 1,
      endDate: NOW + 1,
    }
    const suspendedLater = {
      id: "l",
      isActive: false,
      startDate: NOW + 1,
      endDate: NOW + 2,
    }
    const suspendedPast = {
      id: "o",
      isActive: false,
      startDate: NOW - 2,
      endDate: NOW - 1,
    }
    expect(
      partition(
        [past, suspendedNow, upcoming, active, suspendedLater, suspendedPast],
        NOW,
      ),
    ).toEqual({
      active: [suspendedNow, active],
      upcoming: [upcoming, suspendedLater],
      completed: [past, suspendedPast],
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
