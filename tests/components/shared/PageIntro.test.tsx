import { render, screen } from "@testing-library/react"
import { Users } from "lucide-react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { PageIntro } from "@/components/shared/page-intro"

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode
    href: string
    "aria-label"?: string
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe("PageIntro", () => {
  it("le titre est l'unique titre de niveau 1, suivi de sa description", () => {
    render(
      <PageIntro
        label="Comptes"
        title="Utilisateurs"
        description="Gérez les comptes et leurs accès"
      />,
    )
    expect(
      screen.getByRole("heading", { level: 1, name: "Utilisateurs" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Comptes")).toBeInTheDocument()
    expect(
      screen.getByText("Gérez les comptes et leurs accès"),
    ).toBeInTheDocument()
  })

  it("lien retour, badge de compte et actions", () => {
    render(
      <PageIntro
        icon={Users}
        title="Détails de l'utilisateur"
        backHref="/admin/utilisateurs"
        badge={{ count: 12, label: "utilisateurs" }}
        actions={<button type="button">Exporter</button>}
      />,
    )
    expect(screen.getByRole("link", { name: "Retour" })).toHaveAttribute(
      "href",
      "/admin/utilisateurs",
    )
    expect(screen.getByText("12 utilisateurs")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Exporter" })).toBeInTheDocument()
  })
})
