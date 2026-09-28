import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AccessCard } from "@/components/shared/payments/access-card"

vi.mock("@/lib/format", () => ({
  formatExpiration: (ts: number) => `formatted-${ts}`,
}))

describe("AccessCard", () => {
  it("accès actif : jours restants, barre et date d'expiration", () => {
    render(
      <AccessCard
        type="exam"
        access={{ expiresAt: 1_000, daysRemaining: 45 }}
      />,
    )
    expect(screen.getByText("Examens Simulés")).toBeInTheDocument()
    expect(screen.getByText("45 jours")).toBeInTheDocument()
    expect(
      screen.getByRole("progressbar", { name: "45 jours restants" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/formatted-1000/)).toBeInTheDocument()
  })

  it("sans accès : message d'absence, ni barre ni date", () => {
    render(<AccessCard type="training" access={null} />)
    expect(screen.getByText("Banque d'Entraînement")).toBeInTheDocument()
    expect(screen.getByText("Aucun accès actif")).toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })

  it("accès échu (0 jour) : lu comme inactif", () => {
    render(
      <AccessCard
        type="exam"
        access={{ expiresAt: 1_000, daysRemaining: 0 }}
      />,
    )
    expect(screen.getByText("Aucun accès actif")).toBeInTheDocument()
    expect(screen.getByText("Expiré")).toBeInTheDocument()
  })

  it("rend l'action choisie selon l'état de l'accès", () => {
    const { rerender } = render(
      <AccessCard
        type="exam"
        access={null}
        action={(active) => <button>{active ? "Prolonger" : "Activer"}</button>}
      />,
    )
    expect(screen.getByRole("button", { name: "Activer" })).toBeInTheDocument()
    rerender(
      <AccessCard
        type="exam"
        access={{ expiresAt: 1_000, daysRemaining: 10 }}
        action={(active) => <button>{active ? "Prolonger" : "Activer"}</button>}
      />,
    )
    expect(
      screen.getByRole("button", { name: "Prolonger" }),
    ).toBeInTheDocument()
  })

  it("la description n'apparaît qu'en taille normale", () => {
    const { rerender } = render(
      <AccessCard type="exam" access={null} size="compact" />,
    )
    expect(
      screen.queryByText("Accès aux examens blancs chronométrés"),
    ).not.toBeInTheDocument()
    rerender(<AccessCard type="exam" access={null} />)
    expect(
      screen.getByText("Accès aux examens blancs chronométrés"),
    ).toBeInTheDocument()
  })
})
