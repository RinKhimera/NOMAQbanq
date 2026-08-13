import { act } from "@testing-library/react"
import type { ReactNode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { MarketingHeader } from "@/components/marketing-header"
import { useCurrentUser } from "@/hooks/useCurrentUser"

vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../helpers/motion-mock")
  return motionMockFactory
})

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="next-image" />
  ),
}))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/tarifs",
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
      hydrateRoot(container, <MarketingHeader />, {
        onRecoverableError: (err) => recoverable.push(err),
      })
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
      hydrateRoot(container, <MarketingHeader />)
    })

    // Le nom complet ne vit que dans le contenu du DropdownMenu, fermé par
    // défaut : la branche connectée se reconnaît aux initiales de l'avatar.
    expect(container.textContent).toContain("AD")
    expect(container.textContent).not.toContain("Connexion")
  })
})
