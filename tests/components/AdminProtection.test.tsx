import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import AdminProtection from "@/components/admin-protection"
import { authClient } from "@/lib/auth-client"

import { createMockBetterAuthUser, mockAuthSession } from "../helpers/mocks"

// Mock le client Better Auth : `AdminProtection` lit le rôle via
// `authClient.useSession()`.
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: vi.fn(),
  },
}))

const mockedUseSession = vi.mocked(authClient.useSession)

describe("AdminProtection", () => {
  it("affiche un loader pendant le chargement de la session", () => {
    mockedUseSession.mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockAuthSession({ isPending: true }) as any,
    )

    render(
      <AdminProtection>
        <div>Contenu Admin</div>
      </AdminProtection>,
    )

    expect(
      screen.getByText(/Vérification des permissions/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Contenu Admin/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Accès refusé/i)).not.toBeInTheDocument()
  })

  it("affiche un message d'accès refusé si l'utilisateur n'est pas connecté", () => {
    mockedUseSession.mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockAuthSession({ data: null, isPending: false }) as any,
    )

    render(
      <AdminProtection>
        <div>Contenu Admin</div>
      </AdminProtection>,
    )

    expect(screen.getByText(/Accès refusé/i)).toBeInTheDocument()
    expect(screen.queryByText(/Contenu Admin/i)).not.toBeInTheDocument()
  })

  it("affiche un message d'accès refusé si l'utilisateur n'est pas admin", () => {
    const user = createMockBetterAuthUser({ role: "user" })
    mockedUseSession.mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockAuthSession({ data: { user }, isPending: false }) as any,
    )

    render(
      <AdminProtection>
        <div>Contenu Admin</div>
      </AdminProtection>,
    )

    expect(screen.getByText(/Accès refusé/i)).toBeInTheDocument()
    expect(
      screen.getByText(/réservée aux administrateurs/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Zone protégée/i)).toBeInTheDocument()
    expect(screen.queryByText(/Contenu Admin/i)).not.toBeInTheDocument()
  })

  it("affiche le contenu si l'utilisateur est admin", () => {
    const user = createMockBetterAuthUser({ role: "admin" })
    mockedUseSession.mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockAuthSession({ data: { user }, isPending: false }) as any,
    )

    render(
      <AdminProtection>
        <div>Contenu Admin</div>
      </AdminProtection>,
    )

    expect(screen.getByText(/Contenu Admin/i)).toBeInTheDocument()
    expect(screen.queryByText(/Accès refusé/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Vérification des permissions/i),
    ).not.toBeInTheDocument()
  })
})
