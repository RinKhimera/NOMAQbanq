"use client"

import { usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { adminNavigation } from "@/constants"

export const SiteHeader = () => {
  const pathname = usePathname()

  const getCurrentPageTitle = () => {
    const mainNavItem = adminNavigation.navMain.find(
      (item) => item.url === pathname,
    )
    if (mainNavItem) return mainNavItem.title

    const secondaryNavItem = adminNavigation.navSecondary.find(
      (item) => item.url === pathname,
    )
    if (secondaryNavItem) return secondaryNavItem.title

    if (pathname === "/admin") return "Tableau de bord"

    return "Administration"
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{getCurrentPageTitle()}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary">Admin</Badge>
        </div>
      </div>
    </header>
  )
}
