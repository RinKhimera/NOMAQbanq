import { describe, expect, it } from "vitest"
import {
  type ReadinessInput,
  calendarDaysUntil,
  examReadiness,
  isLateToOpen,
  readinessSummary,
} from "@/lib/exam-readiness"

// 30 sept. 2026, 12 h 00 à Toronto (16 h 00 UTC).
const NOW = Date.UTC(2026, 8, 30, 16)
const torontoMidnight = (month: number, day: number) =>
  Date.UTC(2026, month, day, 4)

const ready: ReadinessInput = {
  finalizedAt: null,
  startDate: torontoMidnight(9, 23),
  endDate: torontoMidnight(9, 26),
  questionCount: 230,
  targetQuestionCount: 230,
  audienceType: "subscribers",
  audienceSize: 0,
}

const failing = (exam: ReadinessInput) =>
  examReadiness(exam, NOW)
    .filter((c) => !c.ok)
    .map((c) => [c.key, c.value])

describe("examReadiness", () => {
  it("prêt : jeu complet, dates à venir, abonnés", () => {
    expect(failing(ready)).toEqual([])
    expect(readinessSummary(examReadiness(ready, NOW))).toEqual({
      tone: "success",
      label: "Prêt",
    })
  })

  it("jeu incomplet, dates absentes, liste restreinte vide : trois points bloquants", () => {
    const exam = {
      ...ready,
      questionCount: 140,
      startDate: null,
      endDate: null,
      audienceType: "restricted" as const,
    }
    expect(failing(exam)).toEqual([
      ["questions", "140 / 230"],
      ["dates", "à choisir"],
      ["audience", "liste vide"],
    ])
    expect(readinessSummary(examReadiness(exam, NOW)).label).toBe(
      "3 points bloquants",
    )
  })

  it("une ouverture passée bloque un examen en préparation, pas un examen finalisé", () => {
    const past = { ...ready, startDate: torontoMidnight(8, 29) }
    expect(isLateToOpen(past, NOW)).toBe(true)
    expect(failing(past)).toEqual([["dates", "devait ouvrir le 29 sept."]])
    expect(isLateToOpen({ ...past, finalizedAt: NOW - 1 }, NOW)).toBe(false)
  })

  it("au moment de finaliser : une ouverture passée ne bloque pas, une fermeture passée si", () => {
    const today = { ...ready, startDate: torontoMidnight(8, 30) }
    expect(
      examReadiness(today, NOW, { finalizing: true }).find(
        (c) => c.key === "dates",
      ),
    ).toMatchObject({ ok: true })
    const closed = { ...today, endDate: torontoMidnight(8, 30) + 1 }
    expect(
      examReadiness(closed, NOW, { finalizing: true }).find(
        (c) => c.key === "dates",
      ),
    ).toMatchObject({ ok: false, value: "fenêtre déjà close" })
  })

  it("compte les invités d'une liste restreinte", () => {
    const check = examReadiness(
      { ...ready, audienceType: "restricted", audienceSize: 1 },
      NOW,
    ).find((c) => c.key === "audience")
    expect(check).toMatchObject({ ok: true, value: "1 invité" })
  })
})

describe("readinessSummary", () => {
  it("mêle bloquants et points à vérifier", () => {
    expect(
      readinessSummary([
        { key: "questions", label: "", ok: false, tone: "danger", value: "" },
        { key: "reports", label: "", ok: false, tone: "warning", value: "" },
      ]),
    ).toEqual({ tone: "danger", label: "2 points dont 1 bloquant" })
    expect(
      readinessSummary([
        { key: "reports", label: "", ok: false, tone: "warning", value: "" },
      ]),
    ).toEqual({ tone: "warning", label: "1 point à vérifier" })
  })
})

describe("calendarDaysUntil", () => {
  it("compte les journées civiles de l'Est, pas des tranches de 24 h", () => {
    expect(calendarDaysUntil(torontoMidnight(9, 23), NOW)).toBe(23)
    // 23 h 30 le soir même à Toronto : même journée.
    expect(calendarDaysUntil(Date.UTC(2026, 9, 1, 3, 30), NOW)).toBe(0)
  })
})
