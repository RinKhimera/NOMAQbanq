"use client"

import { type Icon as TablerIcon } from "@tabler/icons-react"
import { type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type IconType = TablerIcon | LucideIcon

interface NavMainProps {
  items: {
    title: string
    url: string
    icon?: IconType
  }[]
  isAdmin?: boolean
}

export const NavMain = ({ items, isAdmin = false }: NavMainProps) => {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-1 px-2">
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
                  tooltip={item.title}
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
                    {item.icon && (
                      <item.icon
                        className={cn(
                          "size-4.5 transition-colors",
                          isActive &&
                            (isAdmin
                              ? "text-orange-500 dark:text-orange-400"
                              : "text-blue-500 dark:text-blue-400"),
                        )}
                      />
                    )}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
