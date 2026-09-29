import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { type Root, hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MarketingHeader } from "@/components/marketing-header"
import { useCurrentUser } from "@/hooks/useCurrentUser"

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="next-image" />
  ),
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode
    href: string
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const route = vi.hoisted(() => ({ pathname: "/tarifs" }))
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}))

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: vi.fn(),
}))

type Session = ReturnType<typeof useCurrentUser>

const deconnecte = {
  currentUser: null,
  isLoading: true,
  isAuthenticated: false,
  refetch: vi.fn(),
} as unknown as Session

const connecte = {
  currentUser: {
    name: "Awa Diallo",
    email: "awa@example.test",
    image: null,
  },
  isLoading: false,
  isAuthenticated: true,
  refetch: vi.fn(),
} as unknown as Session

describe("MarketingHeader", () => {
  // Les tests d'hydratation montent leur racine à la main : Testing Library
  // ne la démonte pas.
  const hydrated: { root: Root; container: HTMLElement }[] = []
  afterEach(() => {
    for (const { root, container } of hydrated.splice(0)) {
      act(() => root.unmount())
      container.remove()
    }
  })

  it("hydrate proprement quand la session se résout entre le HTML serveur et l'hydratation", async () => {
    // 1. HTML serveur : aucune session résolue côté serveur.
    vi.mocked(useCurrentUser).mockReturnValue(deconnecte)
    const html = renderToString(<MarketingHeader />)
    expect(html).toContain("Connexion")

    // 2. La session arrive AVANT qu'on hydrate — la fenêtre de l'incident.
    vi.mocked(useCurrentUser).mockReturnValue(connecte)

    const container = document.createElement("div")
    container.innerHTML = html
    document.body.appendChild(container)

    const recoverable: unknown[] = []
    await act(async () => {
      const root = hydrateRoot(container, <MarketingHeader />, {
        onRecoverableError: (err) => recoverable.push(err),
      })
      hydrated.push({ root, container })
    })

    // 3. Sans la garde, React signale ici un mismatch d'hydratation.
    expect(recoverable).toEqual([])
  })

  it("affiche l'utilisateur une fois l'hydratation terminée", async () => {
    vi.mocked(useCurrentUser).mockReturnValue(deconnecte)
    const html = renderToString(<MarketingHeader />)

    vi.mocked(useCurrentUser).mockReturnValue(connecte)
    const container = document.createElement("div")
    container.innerHTML = html
    document.body.appendChild(container)

    await act(async () => {
      const root = hydrateRoot(container, <MarketingHeader />)
      hydrated.push({ root, container })
    })

    // Le nom complet ne vit que dans le contenu du DropdownMenu, fermé par
    // défaut : la branche connectée se reconnaît aux initiales de l'avatar.
    expect(container.textContent).toContain("AD")
    expect(container.textContent).not.toContain("Connexion")
  })

  describe("visiteur déconnecté", () => {
    it("propose Comment ça marche, Domaines, Tarifs et FAQ, la page courante marquée", () => {
      route.pathname = "/tarifs"
      vi.mocked(useCurrentUser).mockReturnValue(deconnecte)
      render(<MarketingHeader />)

      const nav = screen.getByRole("navigation", {
        name: "Navigation principale",
      })
      const links = within(nav).getAllByRole("link")
      expect(links.map((l) => l.textContent)).toEqual([
        "Comment ça marche",
        "Domaines",
        "Tarifs",
        "FAQ",
      ])
      expect(within(nav).getByRole("link", { name: "Tarifs" })).toHaveAttribute(
        "aria-current",
        "page",
      )
    })

    it("marque la rubrique Domaines depuis une page domaine", () => {
      route.pathname = "/domaines/cardiologie"
      vi.mocked(useCurrentUser).mockReturnValue(deconnecte)
      render(<MarketingHeader />)

      const nav = screen.getByRole("navigation", {
        name: "Navigation principale",
      })
      expect(
        within(nav).getByRole("link", { name: "Domaines" }),
      ).toHaveAttribute("aria-current", "true")
      route.pathname = "/tarifs"
    })

    it("mène à la connexion, à l'essai gratuit et à l'inscription", () => {
      vi.mocked(useCurrentUser).mockReturnValue(deconnecte)
      render(<MarketingHeader />)

      expect(screen.getByRole("link", { name: "Connexion" })).toHaveAttribute(
        "href",
        "/connexion",
      )
      expect(
        screen.getByRole("link", { name: "Essai gratuit" }),
      ).toHaveAttribute("href", "/evaluation")
      expect(screen.getByRole("link", { name: "S'inscrire" })).toHaveAttribute(
        "href",
        "/inscription",
      )
    })

    it("le menu mobile porte aussi l'essai, À propos, la connexion et le thème", async () => {
      vi.mocked(useCurrentUser).mockReturnValue(deconnecte)
      render(<MarketingHeader />)

      await userEvent.click(
        screen.getByRole("button", { name: "Ouvrir le menu" }),
      )

      const menu = within(screen.getByRole("dialog"))
      for (const name of ["Essai gratuit", "À propos", "Connexion"]) {
        expect(menu.getByRole("link", { name })).toBeInTheDocument()
      }
      expect(menu.getByRole("button", { name: "Sombre" })).toHaveAttribute(
        "aria-pressed",
        "false",
      )
    })

    it("rend le focus au bouton du menu à la fermeture", async () => {
      vi.mocked(useCurrentUser).mockReturnValue(deconnecte)
      render(<MarketingHeader />)
      const trigger = screen.getByRole("button", { name: "Ouvrir le menu" })
      await userEvent.click(trigger)

      await userEvent.keyboard("{Escape}")

      expect(screen.queryByRole("dialog")).toBeNull()
      expect(trigger).toHaveFocus()
    })
  })
})
