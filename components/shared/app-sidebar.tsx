"use client"

import { IconInnerShadowTop } from "@tabler/icons-react"
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

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  navigation: typeof adminNavigation | typeof dashboardNavigation
  homeUrl: string
  userComponent: React.ReactNode
}

export function AppSidebar({
  navigation,
  homeUrl,
  userComponent,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  // Fermer la sidebar en mobile quand la route change
  React.useEffect(() => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }, [pathname, isMobile, setOpenMobile])

  return (
    <Sidebar className="" collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="hover:bg-blue-500/25 data-[slot=sidebar-menu-button]:!p-1.5 dark:hover:bg-blue-500/20"
            >
              <Link href={homeUrl}>
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">NOMAQbank</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navigation.navMain} />
        <NavSecondary items={navigation.navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>{userComponent}</SidebarFooter>
    </Sidebar>
  )
}
