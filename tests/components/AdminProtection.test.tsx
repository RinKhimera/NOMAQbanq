import { render, screen } from "@testing-library/react"
import { useQuery } from "convex/react"
import { describe, expect, it, vi } from "vitest"
import AdminProtection from "@/components/admin-protection"

// Mock convex/react
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}))

describe("AdminProtection", () => {
  it("affiche un loader pendant la vérification", () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    render(
      <AdminProtection>
        <div>Contenu Admin</div>
      </AdminProtection>,
    )

    expect(
      screen.getByText(/Vérification des permissions/i),
    ).toBeInTheDocument()
  })

  it("affiche un message d'accès refusé si l'utilisateur n'est pas admin", () => {
    vi.mocked(useQuery).mockReturnValue(false)

    render(
      <AdminProtection>
        <div>Contenu Admin</div>
      </AdminProtection>,
    )

    expect(screen.getByText(/Accès refusé/i)).toBeInTheDocument()
    expect(screen.queryByText(/Contenu Admin/i)).not.toBeInTheDocument()
  })

  it("affiche le contenu si l'utilisateur est admin", () => {
    vi.mocked(useQuery).mockReturnValue(true)

    render(
      <AdminProtection>
        <div>Contenu Admin</div>
      </AdminProtection>,
    )

    expect(screen.getByText(/Contenu Admin/i)).toBeInTheDocument()
    expect(screen.queryByText(/Accès refusé/i)).not.toBeInTheDocument()
  })
})
