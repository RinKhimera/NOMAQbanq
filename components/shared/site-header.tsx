"use client"

import { usePathname } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { adminNavigation, dashboardNavigation } from "@/constants"
import { cn } from "@/lib/utils"
import ThemeToggle from "./theme-toggle"

interface SiteHeaderProps {
  isAdmin?: boolean
}

export const SiteHeader = ({ isAdmin = false }: SiteHeaderProps) => {
  const pathname = usePathname()

  const getCurrentPageTitle = () => {
    const isAdminPage = pathname.startsWith("/admin")
    const navigation = isAdminPage ? adminNavigation : dashboardNavigation

    const mainNavItem = navigation.navMain.find((item) => item.url === pathname)
    if (mainNavItem) return mainNavItem.title

    const secondaryNavItem = navigation.navSecondary.find(
      (item) => item.url === pathname,
    )
    if (secondaryNavItem) return secondaryNavItem.title

    if (pathname === "/admin") return "Tableau de bord"
    if (pathname === "/dashboard") return "Tableau de bord"

    // Fallback selon le contexte
    return isAdminPage ? "Administration" : "Dashboard"
  }

  return (
    <header
      className={cn(
        "flex h-(--header-height) shrink-0 items-center gap-2",
        "border-border/40 bg-background/60 border-b backdrop-blur-xl",
        "transition-[width,height] ease-linear",
        "group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)",
        "md:rounded-t-xl",
      )}
    >
      <div className="flex w-full items-center gap-3 px-4 lg:gap-4 lg:px-6">
        <SidebarTrigger
          className={cn(
            "-ml-1 size-9 rounded-xl transition-all duration-200",
            "hover:scale-105 active:scale-95",
            isAdmin
              ? "hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400"
              : "hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400",
          )}
        />
        <Separator orientation="vertical" className="bg-border/50 mx-1 h-6" />
        <div className="flex items-center gap-3">
          <h1
            className={cn(
              "text-lg font-semibold tracking-tight",
              isAdmin ? "text-orange-600 dark:text-orange-400" : "",
            )}
          >
            {getCurrentPageTitle()}
          </h1>
          {isAdmin && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1",
                "text-[10px] font-bold tracking-wider uppercase",
                "bg-gradient-to-r from-orange-500 to-amber-500 text-white",
                "shadow-lg shadow-orange-500/30",
              )}
            >
              Admin
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
