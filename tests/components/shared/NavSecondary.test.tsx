import { render, screen } from "@testing-library/react"
import { usePathname } from "next/navigation"
import type { ComponentProps, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NavSecondary } from "@/components/shared/nav-secondary"

const linkProps = vi.fn()

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch,
  }: {
    children: ReactNode
    href: string
    prefetch?: boolean | null
  }) => {
    linkProps({ href, prefetch })
    return <a href={href}>{children}</a>
  },
}))

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }))

// Les composants `Sidebar*` exigent `SidebarProvider` (matchMedia, tooltips) ;
// le sujet du test est le bouton contextuel et les props passées à `Link`.
vi.mock("@/components/ui/sidebar", () => {
  const passthrough = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  )
  return {
    SidebarGroup: passthrough,
    SidebarGroupContent: passthrough,
    SidebarMenu: passthrough,
    SidebarMenuItem: passthrough,
    SidebarMenuButton: passthrough,
  }
})

const Icon = () => <svg />

const items: ComponentProps<typeof NavSecondary>["items"] = [
  { title: "Profil", url: "/tableau-de-bord/profil", icon: Icon },
]

describe("NavSecondary", () => {
  beforeEach(() => vi.clearAllMocks())

  it("propose l'admin à un administrateur sur le dashboard étudiant", () => {
    vi.mocked(usePathname).mockReturnValue("/tableau-de-bord")

    render(<NavSecondary items={items} isUserAdmin />)

    expect(screen.getByText("Aller à l'Admin")).toBeInTheDocument()
  })

  it("propose le dashboard à un administrateur sur l'admin", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/questions")

    render(<NavSecondary items={items} isAdmin isUserAdmin />)

    expect(screen.getByText("Aller au Dashboard")).toBeInTheDocument()
  })

  it("ne propose rien à un étudiant sur le dashboard", () => {
    vi.mocked(usePathname).mockReturnValue("/tableau-de-bord")

    render(<NavSecondary items={items} isUserAdmin={false} />)

    expect(screen.queryByText(/Aller/)).not.toBeInTheDocument()
  })

  it("désactive le prefetch de tous ses liens", () => {
    vi.mocked(usePathname).mockReturnValue("/tableau-de-bord")

    render(<NavSecondary items={items} isUserAdmin />)

    expect(linkProps).toHaveBeenCalledWith({
      href: "/tableau-de-bord/profil",
      prefetch: false,
    })
    expect(linkProps).toHaveBeenCalledWith({ href: "/admin", prefetch: false })
  })
})
