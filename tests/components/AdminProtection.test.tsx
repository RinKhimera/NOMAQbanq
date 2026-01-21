import { render, screen } from "@testing-library/react"
import { useConvexAuth, useQuery } from "convex/react"
import { describe, expect, it, vi } from "vitest"
import AdminProtection from "@/components/admin-protection"

// Mock convex/react
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useConvexAuth: vi.fn(),
}))

describe("AdminProtection", () => {
  it("affiche un loader pendant le chargement de l'auth", () => {
    vi.mocked(useConvexAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    })
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

  it("affiche un loader pendant le chargement de la query", () => {
    vi.mocked(useConvexAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    })
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

  it("affiche un message d'accès refusé si l'utilisateur n'est pas connecté", () => {
    vi.mocked(useConvexAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    })
    vi.mocked(useQuery).mockReturnValue(undefined)

    render(
      <AdminProtection>
        <div>Contenu Admin</div>
      </AdminProtection>,
    )

    expect(screen.getByText(/Accès refusé/i)).toBeInTheDocument()
    expect(screen.queryByText(/Contenu Admin/i)).not.toBeInTheDocument()
  })

  it("affiche un message d'accès refusé si l'utilisateur n'est pas admin", () => {
    vi.mocked(useConvexAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    })
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
    vi.mocked(useConvexAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    })
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
