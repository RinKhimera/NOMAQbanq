import { render, screen } from "@testing-library/react"
import { Clock } from "lucide-react"
import { describe, expect, it } from "vitest"
import {
  BannedPill,
  RolePill,
  StatusPill,
} from "@/components/shared/status-pill"

describe("StatusPill", () => {
  it("rend son libellé et transmet ses attributs", () => {
    render(
      <StatusPill tone="warning" icon={Clock} data-testid="pill">
        En attente
      </StatusPill>,
    )
    expect(screen.getByTestId("pill")).toHaveTextContent("En attente")
    expect(screen.getByTestId("pill").querySelector("svg")).not.toBeNull()
  })

  it("sans icône, ne rend que le libellé", () => {
    render(<StatusPill tone="neutral">Terminé</StatusPill>)
    expect(screen.getByText("Terminé").querySelector("svg")).toBeNull()
  })
})

describe("RolePill", () => {
  it.each([
    { role: "admin", label: "Administrateur" },
    { role: "user", label: "Utilisateur" },
    { role: null, label: "Utilisateur" },
  ])("$role → $label", ({ role, label }) => {
    render(<RolePill role={role} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})

describe("BannedPill", () => {
  it("annonce la suspension", () => {
    render(<BannedPill />)
    expect(screen.getByTestId("ban-badge")).toHaveTextContent("Suspendu")
  })
})
