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

interface NavSecondaryProps
  extends React.ComponentPropsWithoutRef<typeof SidebarGroup> {
  items: {
    title: string
    url: string
    icon: IconType
  }[]
  isAdmin?: boolean
}

export const NavSecondary = ({
  items,
  isAdmin = false,
  ...props
}: NavSecondaryProps) => {
  const pathname = usePathname()
  const isCurrentUserAdmin = useQuery(api.users.isCurrentUserAdmin)

  const isOnAdminPage = pathname.startsWith("/admin")
  const isOnDashboardPage = pathname.startsWith("/dashboard")

  const getNavigationButton = () => {
    if (isOnAdminPage && isCurrentUserAdmin) {
      return {
        href: "/dashboard",
        text: "Aller au Dashboard",
        theme:
          "bg-linear-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md shadow-blue-500/25",
      }
    } else if (isOnDashboardPage && isCurrentUserAdmin) {
      return {
        href: "/admin",
        text: "Aller à l'Admin",
        theme:
          "bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md shadow-orange-500/25",
      }
    } else if (isOnDashboardPage && !isCurrentUserAdmin) {
      return null
    }

    return {
      href: "/",
      text: "Revenir à l'accueil",
      theme:
        "bg-linear-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md shadow-blue-500/25",
    }
  }

  const navigationButton = getNavigationButton()

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent className="px-2">
        <SidebarMenu>
          {items.map((item) => {
            const isActive = pathname === item.url

            return (
              <SidebarMenuItem key={item.title} className="relative">
                {/* Barre verticale animée */}
                <div
                  className={cn(
                    "absolute top-1/2 left-0 h-0 w-0.75 -translate-y-1/2 rounded-r-full transition-all duration-300 ease-out",
                    isActive && "h-6",
                    isAdmin
                      ? "bg-linear-to-b from-orange-400 to-amber-500"
                      : "bg-linear-to-b from-blue-400 to-indigo-500",
                  )}
                />
                <SidebarMenuButton
                  variant="link"
                  asChild
                  className={cn(
                    "relative ml-1 rounded-xl transition-all duration-200",
                    "hover:translate-x-1",
                    isActive
                      ? [
                          "font-semibold",
                          isAdmin
                            ? "bg-orange-500/10 text-orange-600 hover:bg-orange-500/15 hover:text-orange-600 dark:bg-orange-500/15 dark:text-orange-400 dark:hover:text-orange-400"
                            : "bg-blue-500/10 text-blue-600 hover:bg-blue-500/15 hover:text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 dark:hover:text-blue-400",
                        ]
                      : isAdmin
                        ? "hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400"
                        : "hover:bg-muted/50",
                  )}
                >
                  <Link href={item.url} className="flex items-center gap-3">
                    <item.icon
                      className={cn(
                        "size-4.5 transition-colors",
                        isActive &&
                          (isAdmin
                            ? "text-orange-500 dark:text-orange-400"
                            : "text-blue-500 dark:text-blue-400"),
                      )}
                    />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
        {navigationButton && (
          <SidebarMenu className="mt-3 px-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                variant="none"
                asChild
                tooltip="Navigation contextuelle"
                className={cn(
                  "cursor-pointer rounded-xl text-white transition-all duration-300",
                  "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
                  navigationButton.theme,
                )}
              >
                <Link
                  href={navigationButton.href}
                  className="flex items-center gap-2"
                >
                  <IconCirclePlusFilled className="size-5" />
                  <span className="font-medium">{navigationButton.text}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
