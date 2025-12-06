"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"
import { NavMain } from "@/components/shared/nav-main"
import { NavSecondary } from "@/components/shared/nav-secondary"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { adminNavigation, dashboardNavigation } from "@/constants"
import { cn } from "@/lib/utils"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  navigation: typeof adminNavigation | typeof dashboardNavigation
  homeUrl: string
  userComponent: React.ReactNode
  isAdmin?: boolean
}

export const AppSidebar = ({
  navigation,
  homeUrl,
  userComponent,
  isAdmin = false,
  ...props
}: AppSidebarProps) => {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  // Fermer la sidebar en mobile quand la route change
  React.useEffect(() => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }, [pathname, isMobile, setOpenMobile])

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="px-2 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className={cn(
                "group/logo rounded-2xl transition-all",
                "data-[slot=sidebar-menu-button]:!p-2",
                "active:scale-[0.98]",
                isAdmin
                  ? "hover:bg-orange-500/10 dark:hover:bg-orange-500/15"
                  : "hover:bg-blue-500/10 dark:hover:bg-blue-500/15",
              )}
            >
              <Link href={homeUrl} className="flex h-10 items-center gap-3">
                <div
                  className={cn(
                    "relative flex size-11 items-center justify-center rounded-xl transition-all duration-300",
                    "bg-gradient-to-br shadow-lg",
                    "group-hover/logo:scale-105 group-hover/logo:shadow-xl",
                    isAdmin
                      ? "from-orange-500/20 to-amber-500/20 shadow-orange-500/20"
                      : "from-blue-500/20 to-indigo-500/20 shadow-blue-500/20",
                  )}
                >
                  <Image
                    src="/noma-logo.svg"
                    alt="Logo NOMAQbanq"
                    fill
                    sizes="44px"
                    className="object-contain p-2"
                    priority
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-bold tracking-tight">
                    NOMAQbanq
                  </span>
                  {isAdmin ? (
                    <span className="text-[10px] font-semibold tracking-wider text-orange-500 uppercase dark:text-orange-400">
                      Administration
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[10px] font-medium">
                      Préparation EACMC
                    </span>
                  )}
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navigation.navMain} isAdmin={isAdmin} />
        <NavSecondary
          items={navigation.navSecondary}
          isAdmin={isAdmin}
          className="mt-auto"
        />
      </SidebarContent>

      <SidebarFooter>{userComponent}</SidebarFooter>
    </Sidebar>
  )
}
