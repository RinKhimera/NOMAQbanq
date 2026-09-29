import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { AccessPaywall } from "@/components/shared/payments/access-paywall"

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe("AccessPaywall", () => {
  it("sans accès : présentation, prix d'appel du catalogue et tarifs", () => {
    render(<AccessPaywall type="training" priceFromCents={5000} />)
    expect(
      screen.getByRole("heading", { name: "Entraînement non disponible" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/À partir de/)).toHaveTextContent(
      /50\s\$ pour 1 mois/,
    )
    expect(
      screen.getByRole("link", { name: /Voir les tarifs/ }),
    ).toHaveAttribute("href", "/tarifs")
    expect(
      screen.getByRole("link", { name: "Faire l'évaluation gratuite" }),
    ).toHaveAttribute("href", "/evaluation")
  })

  it("sans prix dans le catalogue : la phrase de prix disparaît, pas un « 0 $ »", () => {
    render(<AccessPaywall type="exam" priceFromCents={null} />)
    expect(
      screen.getByRole("heading", { name: "Examens blancs non disponibles" }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/À partir de/)).not.toBeInTheDocument()
  })

  it("accès échu : la date, « Prolonger l'accès » et le retour à la progression", () => {
    render(
      <AccessPaywall
        type="exam"
        expiredAt={Date.parse("2026-09-20T12:00:00Z")}
        priceFromCents={5000}
      />,
    )
    expect(
      screen.getByRole("heading", {
        name: "Votre accès Examens a expiré le 20 septembre 2026",
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/À partir de/)).not.toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Prolonger l'accès/ }),
    ).toHaveAttribute("href", "/tarifs")
    expect(
      screen.getByRole("link", { name: "Voir ma progression" }),
    ).toHaveAttribute("href", "/tableau-de-bord")
  })
})
