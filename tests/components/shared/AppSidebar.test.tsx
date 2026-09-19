import { render } from "@testing-library/react"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { AppSidebar } from "@/components/shared/app-sidebar"
import { dashboardNavigation } from "@/constants"

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

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }))

// Le sujet du test est le lien du logo ; la sidebar (provider, matchMedia) et
// les deux menus, déjà verrouillés par leurs propres tests, sont neutralisés.
vi.mock("@/components/ui/sidebar", () => {
  const passthrough = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  )
  return {
    Sidebar: passthrough,
    SidebarContent: passthrough,
    SidebarFooter: passthrough,
    SidebarHeader: passthrough,
    SidebarMenu: passthrough,
    SidebarMenuButton: passthrough,
    SidebarMenuItem: passthrough,
    useSidebar: () => ({ isMobile: false, setOpenMobile: vi.fn() }),
  }
})
vi.mock("@/components/shared/link-pending-indicator", () => ({
  LinkPendingIndicator: () => null,
}))
vi.mock("@/components/shared/nav-main", () => ({ NavMain: () => null }))
vi.mock("@/components/shared/nav-secondary", () => ({
  NavSecondary: () => null,
}))

describe("AppSidebar", () => {
  it("désactive le prefetch du lien du logo (présent sur chaque page authentifiée)", () => {
    vi.mocked(usePathname).mockReturnValue("/tableau-de-bord/profil")

    render(
      <AppSidebar
        navigation={dashboardNavigation}
        homeUrl="/tableau-de-bord"
        userComponent={null}
        isUserAdmin={false}
      />,
    )

    expect(linkProps).toHaveBeenCalledTimes(1)
    expect(linkProps).toHaveBeenCalledWith({
      href: "/tableau-de-bord",
      prefetch: false,
    })
  })
})
