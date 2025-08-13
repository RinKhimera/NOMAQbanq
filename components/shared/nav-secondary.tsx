"use client"

import {
  IconCirclePlusFilled,
  type Icon as TablerIcon,
} from "@tabler/icons-react"
import { useQuery } from "convex/react"
import { type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { api } from "@/convex/_generated/api"
import { cn } from "@/lib/utils"

type IconType = TablerIcon | LucideIcon

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: IconType
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname()
  const isCurrentUserAdmin = useQuery(api.users.isCurrentUserAdmin)

  const isOnAdminPage = pathname.startsWith("/admin")
  const isOnDashboardPage = pathname.startsWith("/dashboard")

  const getNavigationButton = () => {
    if (isOnAdminPage && isCurrentUserAdmin) {
      // User admin sur une page admin -> aller au dashboard
      return {
        href: "/dashboard",
        text: "Aller au Dashboard",
        theme:
          "hover:bg-blue-600 bg-blue-600 focus:hover:bg-blue-600 text-white",
      }
    } else if (isOnDashboardPage && isCurrentUserAdmin) {
      // User admin sur le dashboard -> aller à l'admin
      return {
        href: "/admin",
        text: "Aller à l'Admin",
        theme:
          "hover:bg-blue-600 bg-blue-600 focus:hover:bg-blue-600 text-white",
      }
    } else if (isOnDashboardPage && !isCurrentUserAdmin) {
      // User non-admin sur le dashboard -> pas de bouton
      return null
    }

    // Fallback vers l'accueil pour les autres cas
    return {
      href: "/",
      text: "Revenir à l'accueil",
      theme: "hover:bg-blue-600 bg-blue-600 focus:hover:bg-blue-600 text-white",
    }
  }

  const navigationButton = getNavigationButton()

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = pathname === item.url

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  variant={"link"}
                  asChild
                  className={cn("", isActive ? "active-link" : "")}
                >
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
        {navigationButton && (
          <SidebarMenu>
            <SidebarMenuItem className="mt-1 flex items-center gap-2">
              <SidebarMenuButton
                variant="none"
                asChild
                tooltip="Navigation contextuelle"
                className={`min-w-8 cursor-pointer text-white duration-200 ease-linear active:text-white ${navigationButton.theme}`}
              >
                <Link href={navigationButton.href}>
                  <IconCirclePlusFilled />
                  <span>{navigationButton.text}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
