import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ExamsOverview } from "@/app/(admin)/admin/examens/_components/exams-overview"
import {
  overviewSections,
  passRateLabel,
  recentAverage,
  submittedPercent,
} from "@/app/(admin)/admin/examens/_components/exams-overview-model"
import type { AdminExamOverviewItem, ExamFigures } from "@/features/exams/dal"

// Minuit, heure de l'Est (UTC−4 en automne).
const day = (month: number, date: number) => Date.UTC(2026, month - 1, date, 4)
const NOW = day(9, 30) + 10 * 3_600_000

const figures = (over: Partial<ExamFigures> = {}): ExamFigures => ({
  started: 0,
  submitted: 0,
  autoSubmitted: 0,
  inProgress: 0,
  average: null,
  best: null,
  passed: 0,
  eligible: 118,
  participations: 0,
  locked: false,
  ...over,
})

let seq = 0
const exam = (
  over: Partial<AdminExamOverviewItem> = {},
): AdminExamOverviewItem => ({
  id: `exam-${++seq}`,
  title: `Examen ${seq}`,
  startDate: day(9, 1),
  endDate: day(9, 4),
  finalizedAt: day(8, 1),
  isActive: true,
  audienceType: "subscribers",
  questionCount: 230,
  targetQuestionCount: 230,
  figures: figures(),
  ...over,
})

const live = (over: Partial<AdminExamOverviewItem> = {}) =>
  exam({ startDate: day(9, 25), endDate: day(10, 3), ...over })

const preparation = (over: Partial<AdminExamOverviewItem> = {}) =>
  exam({
    startDate: day(10, 23),
    endDate: day(10, 26),
    finalizedAt: null,
    questionCount: 140,
    ...over,
  })

const finished = (start: number, over: Partial<AdminExamOverviewItem> = {}) =>
  exam({ startDate: start, endDate: start + 3 * 86_400_000, ...over })

const renderOverview = (exams: AdminExamOverviewItem[]) =>
  render(<ExamsOverview exams={exams} initialNow={NOW} />)

describe("overviewSections", () => {
  it("range par phase et trie « À préparer » par ouverture, sans dates à la fin", () => {
    const noDates = preparation({
      id: "sans-dates",
      startDate: null,
      endDate: null,
    })
    const late = preparation({ id: "en-retard", startDate: day(9, 29) })
    const soon = exam({
      id: "bientot",
      startDate: day(10, 9),
      endDate: day(10, 12),
    })
    const disabled = exam({ id: "desactive", isActive: false })
    const sections = overviewSections(
      [noDates, soon, live({ id: "en-cours" }), late, disabled],
      NOW,
    )
    expect(sections.live.map((e) => e.id)).toEqual(["en-cours"])
    expect(sections.toPrepare.map((e) => e.id)).toEqual([
      "en-retard",
      "bientot",
      "sans-dates",
    ])
    expect(sections.finished.map((e) => [e.id, e.phase])).toEqual([
      ["desactive", "inactive"],
    ])
  })

  it("range les terminés du plus récent au plus ancien", () => {
    const sections = overviewSections(
      [finished(day(7, 1), { id: "a" }), finished(day(9, 1), { id: "b" })],
      NOW,
    )
    expect(sections.finished.map((e) => e.id)).toEqual(["b", "a"])
  })
})

describe("chiffres des terminés", () => {
  it("moyenne des 5 derniers sur les seules moyennes connues", () => {
    const list = overviewSections(
      [
        finished(day(9, 10), { figures: figures({ average: 58 }) }),
        finished(day(9, 3), { figures: figures({ average: null }) }),
        finished(day(8, 20), { figures: figures({ average: 55 }) }),
        finished(day(8, 10), { figures: figures({ average: 57 }) }),
        finished(day(8, 1), { figures: figures({ average: 54 }) }),
        finished(day(7, 1), { figures: figures({ average: 10 }) }),
      ],
      NOW,
    ).finished
    // (58 + 55 + 57 + 54) / 4 : quatre moyennes connues parmi les 5 derniers.
    expect(recentAverage(list)).toEqual({ value: 56, count: 4 })
  })

  it("aucune moyenne connue : pas de moyenne", () => {
    const list = overviewSections([finished(day(9, 1))], NOW).finished
    expect(recentAverage(list)).toBeNull()
  })

  it("réussite et part soumise sans division par zéro", () => {
    expect(passRateLabel({ passed: 0, submitted: 0 })).toBe("—")
    expect(passRateLabel({ passed: 46, submitted: 71 })).toBe("64 %")
    expect(submittedPercent({ started: 0, submitted: 0 })).toBe(0)
    expect(submittedPercent({ started: 64, submitted: 41 })).toBe(64)
  })
})

describe("ExamsOverview", () => {
  it("carte en cours : fermeture, participations ouvertes et part soumise", () => {
    renderOverview([
      live({
        id: "eb26",
        title: "Examen blanc 26",
        figures: figures({ started: 64, submitted: 41, inProgress: 23 }),
      }),
    ])
    const card = screen.getByTestId("live-exam-card-eb26")
    expect(card).toHaveTextContent("ferme le 3 oct. à 0 h 00, dans 3 j")
    expect(
      within(card).getByRole("link", { name: /Examen blanc 26/ }),
    ).toHaveAttribute("href", "/admin/examens/eb26")
    expect(within(card).getByTestId("live-exam-open-count")).toHaveTextContent(
      "23 participations encore ouvertes seront soumises automatiquement à la fermeture.",
    )
    expect(card).toHaveTextContent("64 % soumis · 118 éligibles")
  })

  it("carte en cours sans participation : 0 % et aucune participation ouverte", () => {
    renderOverview([live({ id: "vide" })])
    const card = screen.getByTestId("live-exam-card-vide")
    expect(card).toHaveTextContent("Aucune participation encore ouverte.")
    expect(card).toHaveTextContent("0 % soumis")
  })

  it("examen en préparation en retard : bloquant, « Finaliser » vers le formulaire", () => {
    renderOverview([
      preparation({
        id: "rattrapage",
        startDate: day(9, 29),
        endDate: day(10, 3),
        audienceType: "restricted",
        figures: figures({ eligible: 0 }),
      }),
    ])
    const card = screen.getByTestId("prep-exam-card-rattrapage")
    expect(card).toHaveAttribute("data-blocking", "true")
    expect(card).toHaveTextContent("devait ouvrir le 29 sept.")
    expect(within(card).getByTestId("readiness-summary")).toHaveTextContent(
      "3 points bloquants",
    )
    expect(within(card).getByTestId("readiness-audience")).toHaveTextContent(
      "liste vide",
    )
    expect(within(card).getByTestId("btn-finalize-exam")).toHaveAttribute(
      "href",
      "/admin/examens/modifier/rattrapage",
    )
  })

  it("examen à venir prêt : « ouvre dans N j », « Prêt », « Modifier »", () => {
    renderOverview([
      exam({
        id: "eb27",
        startDate: day(10, 9),
        endDate: day(10, 12),
        audienceType: "restricted",
        figures: figures({ eligible: 14 }),
      }),
    ])
    const card = screen.getByTestId("prep-exam-card-eb27")
    expect(card).not.toHaveAttribute("data-blocking")
    expect(card).toHaveTextContent("ouvre dans 9 j · 9 oct.")
    expect(card).toHaveTextContent("14 invités")
    expect(within(card).getByTestId("readiness-summary")).toHaveTextContent(
      "Prêt",
    )
    expect(within(card).getByTestId("btn-edit-exam")).toHaveAttribute(
      "href",
      "/admin/examens/modifier/eb27",
    )
    expect(within(card).queryByTestId("btn-finalize-exam")).toBeNull()
  })

  it("examen en préparation sans dates : aucune ligne d'ouverture", () => {
    renderOverview([
      preparation({ id: "brouillon", startDate: null, endDate: null }),
    ])
    const card = screen.getByTestId("prep-exam-card-brouillon")
    expect(card).not.toHaveTextContent("ouvre")
    expect(within(card).getByTestId("readiness-dates")).toHaveTextContent(
      "à choisir",
    )
  })

  it("terminés : 5 derniers, moyenne en en-tête, puis tout afficher", () => {
    const exams = Array.from({ length: 7 }, (_, i) =>
      finished(day(8, 1 + i * 3), {
        id: `fin-${i}`,
        title: `Terminé ${i}`,
        figures: figures({ submitted: 10, passed: 6, average: 50 + i }),
      }),
    )
    renderOverview(exams)
    const section = screen.getByTestId("exams-section-finished")
    expect(
      within(section).getByTestId("finished-recent-average"),
    ).toHaveTextContent("moyenne des 5 derniers : 54 %")
    expect(within(section).queryAllByText("Terminé 0")).toHaveLength(0)
    expect(within(section).getAllByText("Terminé 6").length).toBeGreaterThan(0)

    fireEvent.click(within(section).getByTestId("btn-show-all-finished"))
    expect(within(section).getAllByText("Terminé 0").length).toBeGreaterThan(0)
    expect(within(section).queryByTestId("btn-show-all-finished")).toBeNull()
  })

  it("terminé sans soumission : moyenne et réussite « — »", () => {
    renderOverview([finished(day(9, 1), { id: "zero", title: "Personne" })])
    const section = screen.getByTestId("exams-section-finished")
    expect(within(section).queryByTestId("finished-recent-average")).toBeNull()
    expect(within(section).getAllByText("—").length).toBeGreaterThan(0)
    expect(within(section).queryByTestId("btn-show-all-finished")).toBeNull()
  })

  it("sections vides : état compact, action de création", () => {
    renderOverview([])
    expect(screen.getByText("Aucun examen en cours.")).toBeInTheDocument()
    expect(
      screen.getByText("Aucun examen à venir ni en préparation."),
    ).toBeInTheDocument()
    expect(screen.getByText("Aucun examen terminé.")).toBeInTheDocument()
    expect(screen.getByTestId("btn-create-exam")).toHaveAttribute(
      "href",
      "/admin/examens/creer",
    )
  })
})
