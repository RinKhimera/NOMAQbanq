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
          "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 active:from-blue-700 active:to-cyan-700",
      }
    } else if (isOnDashboardPage && isCurrentUserAdmin) {
      // User admin sur le dashboard -> aller à l'admin
      return {
        href: "/admin",
        text: "Aller à l'Admin",
        theme:
          "bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 active:from-red-700 active:to-orange-700",
      }
    } else if (isOnDashboardPage && !isCurrentUserAdmin) {
      // User non-admin sur le dashboard -> pas de bouton
      return null
    }

    // Fallback vers l'accueil pour les autres cas
    return {
      href: "/",
      text: "Revenir à l'accueil",
      theme:
        "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 active:from-purple-700 active:to-pink-700",
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
                  asChild
                  className={
                    isActive
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground transition"
                      : ""
                  }
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
                asChild
                tooltip="Navigation contextuelle"
                className={`min-w-8 cursor-pointer text-white duration-200 ease-linear hover:text-white active:text-white ${navigationButton.theme}`}
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
