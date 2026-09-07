import { render } from "@testing-library/react"
import { usePathname } from "next/navigation"
import type { ComponentProps, ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { NavMain } from "@/components/shared/nav-main"

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
// le sujet du test est la prop passée à `Link`, pas la sidebar.
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

const items: ComponentProps<typeof NavMain>["items"] = [
  { title: "Tableau de bord", url: "/tableau-de-bord" },
  { title: "Examen Blanc", url: "/tableau-de-bord/examen-blanc" },
]

describe("NavMain", () => {
  it("désactive le prefetch de chaque lien (routes dynamiques : un prefetch = une invocation)", () => {
    vi.mocked(usePathname).mockReturnValue("/tableau-de-bord")

    render(<NavMain items={items} />)

    expect(linkProps).toHaveBeenCalledTimes(items.length)
    for (const item of items) {
      expect(linkProps).toHaveBeenCalledWith({
        href: item.url,
        prefetch: false,
      })
    }
  })
})
