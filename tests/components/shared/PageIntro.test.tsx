import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PageIntro } from "@/components/shared/page-intro"

describe("PageIntro", () => {
  it("le titre est de niveau 1, suivi de sa description", () => {
    render(
      <PageIntro
        title="Utilisateurs"
        description="Gérez les comptes et leurs accès"
      />,
    )
    expect(
      screen.getByRole("heading", { level: 1, name: "Utilisateurs" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Gérez les comptes et leurs accès"),
    ).toBeInTheDocument()
  })

  it("lien retour et actions", () => {
    render(
      <PageIntro
        title="Détails de l'utilisateur"
        backHref="/admin/utilisateurs"
        actions={<button type="button">Exporter</button>}
      />,
    )
    expect(screen.getByRole("link", { name: "Retour" })).toHaveAttribute(
      "href",
      "/admin/utilisateurs",
    )
    expect(screen.getByRole("button", { name: "Exporter" })).toBeInTheDocument()
  })

  it("libellé au-dessus du titre, hors du h1", () => {
    render(<PageIntro eyebrow="Compte" title="Abonnements et accès" />)
    expect(
      screen.getByRole("heading", { level: 1, name: "Abonnements et accès" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Compte")).toBeInTheDocument()
  })
})
