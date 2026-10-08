import { render, screen, within } from "@testing-library/react"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { AdminShell } from "@/components/shared/shell/admin-shell"
import type { SessionUser } from "@/lib/session-user"

// Le vrai Link ne laisse aucune trace de `prefetch` dans le DOM : le stub
// l'expose pour vérifier `prefetch={false}`.
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch,
    ...props
  }: {
    children: ReactNode
    href: string
    prefetch?: boolean
  }) => (
    <a href={href} data-prefetch={String(prefetch)} {...props}>
      {children}
    </a>
  ),
}))
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: vi.fn() }),
}))
vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}))
vi.mock("@/components/shared/link-pending-indicator", () => ({
  LinkPendingIndicator: () => <span data-testid="pending-indicator" />,
}))

const admin: SessionUser = {
  name: "Awa Diallo",
  email: "awa@example.test",
  image: null,
  role: "admin",
}

const renderShell = (pathname = "/admin", envLabel = "Production") => {
  vi.mocked(usePathname).mockReturnValue(pathname)
  render(
    <AdminShell user={admin} envLabel={envLabel}>
      <p>Contenu de la page</p>
    </AdminShell>,
  )
}

const groupLinks = (heading: string) =>
  within(screen.getByRole("list", { name: heading }))
    .getAllByRole("link")
    .map((link) => link.textContent)

describe("AdminShell", () => {
  it("signale la zone et l'environnement réel", () => {
    renderShell("/admin", "Développement")

    expect(screen.getByText("Mode administration")).toBeInTheDocument()
    expect(screen.getByText("Développement")).toBeInTheDocument()
  })

  it("range la navigation en Pilotage · Contenu · Comptes", () => {
    renderShell()

    expect(groupLinks("Pilotage")).toEqual(["Tableau de bord", "Transactions"])
    expect(groupLinks("Contenu")).toEqual(["Questions", "Examens blancs"])
    expect(groupLinks("Comptes")).toEqual(["Utilisateurs", "Profil"])
  })

  it("marque la page courante et titre la barre du haut", () => {
    renderShell("/admin/examens/ex_1/resultats/u_1")

    const nav = screen.getByRole("navigation", {
      name: "Navigation de l'administration",
    })
    expect(
      within(nav).getByRole("link", { name: "Examens blancs" }),
    ).toHaveAttribute("aria-current", "page")
    expect(
      within(screen.getByRole("banner")).getByText("Examens blancs"),
    ).toBeInTheDocument()
  })

  it("mène à l'espace étudiant, sans prefetch", () => {
    renderShell()

    const link = screen.getByRole("link", { name: "Voir l'espace étudiant" })
    expect(link).toHaveAttribute("href", "/tableau-de-bord")
    expect(link).toHaveAttribute("data-prefetch", "false")
    expect(within(link).getByTestId("pending-indicator")).toBeInTheDocument()
  })
})
