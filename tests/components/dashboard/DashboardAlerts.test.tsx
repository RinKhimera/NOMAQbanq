import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { DashboardAlerts } from "@/app/(dashboard)/tableau-de-bord/_components/dashboard-alerts"

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse("2026-09-27T15:00:00Z")
const none = { exam: null, training: null }
const inAccess = (days: number) => ({
  expiresAt: NOW + days * DAY,
  daysRemaining: days,
})

describe("DashboardAlerts", () => {
  it("examen commencé : progression, temps restant depuis l'ancre serveur, Reprendre", () => {
    render(
      <DashboardAlerts
        examInProgress={{
          examId: "exam-1",
          title: "Examen blanc de septembre",
          answeredCount: 112,
          questionCount: 230,
          timing: {
            // Commencé il y a 1 h 30 sur un budget de 5 h 18.
            startedAt: NOW - 90 * 60_000,
            budgetSeconds: 318 * 60,
            pauseCreditMs: 0,
          },
        }}
        access={{ examAccess: inAccess(40), trainingAccess: null }}
        lapsed={none}
        now={NOW}
      />,
    )
    expect(
      screen.getByText("Examen blanc de septembre en cours"),
    ).toBeInTheDocument()
    expect(screen.getByText("112 / 230")).toBeInTheDocument()
    expect(screen.getByText("3 h 48")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Reprendre" })).toHaveAttribute(
      "href",
      "/tableau-de-bord/examen-blanc/exam-1/evaluation",
    )
  })

  it("budget épuisé : temps écoulé, pas « en cours »", () => {
    render(
      <DashboardAlerts
        examInProgress={{
          examId: "exam-1",
          title: "Examen blanc de septembre",
          answeredCount: 40,
          questionCount: 230,
          // Commencé il y a 3 jours sur un budget d'une heure.
          timing: {
            startedAt: NOW - 3 * DAY,
            budgetSeconds: 3600,
            pauseCreditMs: 0,
          },
        }}
        access={null}
        lapsed={none}
        now={NOW}
      />,
    )
    expect(
      screen.getByText("Examen blanc de septembre : temps écoulé"),
    ).toBeInTheDocument()
    expect(screen.queryByText(/chronomètre continue/)).toBeNull()
    expect(
      screen.getByRole("link", { name: "Terminer l'examen" }),
    ).toHaveAttribute("href", "/tableau-de-bord/examen-blanc/exam-1/evaluation")
  })

  it("pause en cours : le chronomètre est suspendu", () => {
    render(
      <DashboardAlerts
        examInProgress={{
          examId: "exam-1",
          title: "Examen blanc de septembre",
          answeredCount: 40,
          questionCount: 230,
          timing: {
            startedAt: NOW - 60 * 60_000,
            budgetSeconds: 318 * 60,
            pauseCreditMs: 0,
            pauseInProgress: { startedAt: NOW - 5 * 60_000, capMinutes: 45 },
          },
        }}
        access={null}
        lapsed={none}
        now={NOW}
      />,
    )
    expect(
      screen.getByText(/en pause : le chronomètre reprendra/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/chronomètre continue/)).toBeNull()
  })

  it("accès à 7 jours ou moins : Prolonger ; au-delà, rien", () => {
    const { rerender } = render(
      <DashboardAlerts
        examInProgress={null}
        access={{ examAccess: inAccess(5), trainingAccess: inAccess(8) }}
        lapsed={none}
        now={NOW}
      />,
    )
    expect(
      screen.getByText("Votre accès Examens expire dans 5 jours"),
    ).toBeInTheDocument()
    expect(screen.queryByText(/accès Entraînement expire/)).toBeNull()
    expect(screen.getByRole("link", { name: "Prolonger" })).toHaveAttribute(
      "href",
      "/tarifs",
    )

    rerender(
      <DashboardAlerts
        examInProgress={null}
        access={{ examAccess: inAccess(1), trainingAccess: null }}
        lapsed={none}
        now={NOW}
      />,
    )
    expect(
      screen.getByText("Votre accès Examens expire dans 1 jour"),
    ).toBeInTheDocument()
  })

  it("accès expiré : Réactiver, avec la date de fin", () => {
    render(
      <DashboardAlerts
        examInProgress={null}
        access={{ examAccess: null, trainingAccess: inAccess(40) }}
        lapsed={{ exam: Date.parse("2026-09-21T15:00:00Z"), training: null }}
        now={NOW}
      />,
    )
    expect(
      screen.getByText("Votre accès Examens a expiré le 21 septembre 2026"),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Réactiver" })).toHaveAttribute(
      "href",
      "/tarifs",
    )
  })

  it("rien à signaler : aucune alerte", () => {
    const { container } = render(
      <DashboardAlerts
        examInProgress={null}
        access={{ examAccess: inAccess(40), trainingAccess: null }}
        lapsed={none}
        now={NOW}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
