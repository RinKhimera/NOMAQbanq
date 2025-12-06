"use client"

import { SignOutButton } from "@clerk/clerk-react"
import { IconDotsVertical, IconLogout } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { cn } from "@/lib/utils"

interface NavUserProps {
  requireAdmin?: boolean
  redirectUrl?: string
}

export const GenericNavUser = ({
  requireAdmin = false,
  redirectUrl = "/",
}: NavUserProps) => {
  const { isMobile } = useSidebar()
  const { currentUser, isLoading } = useCurrentUser()
  const router = useRouter()

  // Redirection automatique si pas d'utilisateur connecté
  useEffect(() => {
    if (!isLoading && currentUser === null) {
      router.push(redirectUrl)
    }
  }, [currentUser, isLoading, router, redirectUrl])

  // Redirection si admin requis mais utilisateur pas admin
  useEffect(() => {
    if (
      requireAdmin &&
      !isLoading &&
      currentUser &&
      currentUser.role !== "admin"
    ) {
      router.push(redirectUrl)
    }
  }, [currentUser, isLoading, router, requireAdmin, redirectUrl])

  if (isLoading || currentUser === undefined) {
    return (
      <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
        <div className="flex flex-col items-center space-y-4">
          <div
            className={cn(
              "h-12 w-12 animate-spin rounded-full border-b-2",
              requireAdmin ? "border-orange-500" : "border-blue-500",
            )}
          />
          <div className="text-center">
            <h2 className="text-lg font-semibold">Chargement...</h2>
            <p className="text-muted-foreground text-sm">
              {requireAdmin
                ? "Vérification des permissions"
                : "Connexion en cours"}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Si pas d'utilisateur, ne rien afficher (redirection en cours)
  if (currentUser === null) {
    return null
  }

  // Vérification supplémentaire du rôle admin si requis
  if (requireAdmin && currentUser.role !== "admin") {
    return (
      <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
        <div className="flex flex-col items-center space-y-4">
          <div className="border-destructive h-12 w-12 animate-spin rounded-full border-b-2" />
          <div className="text-center">
            <h2 className="text-destructive text-lg font-semibold">
              Accès refusé
            </h2>
            <p className="text-muted-foreground text-sm">
              Redirection en cours...
            </p>
          </div>
        </div>
      </div>
    )
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className={cn(
                "group/avatar cursor-pointer rounded-xl transition-all duration-200",
                "hover:bg-blue-500/10 dark:hover:bg-blue-400/10",
                "data-[state=open]:text-sidebar-accent-foreground data-[state=open]:bg-blue-500/15",
                requireAdmin && [
                  "hover:bg-orange-500/10 dark:hover:bg-orange-400/10",
                  "data-[state=open]:bg-orange-500/15",
                ],
              )}
            >
              <Avatar
                className={cn(
                  "ring-offset-sidebar h-9 w-9 rounded-lg ring-2 ring-offset-2 transition-all",
                  requireAdmin
                    ? "ring-orange-500/30 group-hover/avatar:ring-orange-500/50"
                    : "ring-blue-500/30 group-hover/avatar:ring-blue-500/50",
                )}
              >
                <AvatarImage src={currentUser.image} alt={currentUser.name} />
                <AvatarFallback
                  className={cn(
                    "rounded-lg font-semibold",
                    requireAdmin
                      ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white"
                      : "bg-gradient-to-br from-blue-500 to-indigo-500 text-white",
                  )}
                >
                  {getInitials(currentUser.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {currentUser.name}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {currentUser.email}
                </span>
              </div>
              <IconDotsVertical className="ml-auto size-4 opacity-50 transition-opacity group-hover/avatar:opacity-100" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="bg-card/95 w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-xl border p-1 shadow-xl backdrop-blur-xl"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-3 px-2 py-2.5 text-left text-sm">
                <Avatar
                  className={cn(
                    "h-10 w-10 rounded-lg ring-2",
                    requireAdmin ? "ring-orange-500/30" : "ring-blue-500/30",
                  )}
                >
                  <AvatarImage src={currentUser.image} alt={currentUser.name} />
                  <AvatarFallback
                    className={cn(
                      "rounded-lg font-semibold",
                      requireAdmin
                        ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white"
                        : "bg-gradient-to-br from-blue-500 to-indigo-500 text-white",
                    )}
                  >
                    {getInitials(currentUser.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {currentUser.name}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {currentUser.email}
                  </span>
                  {requireAdmin && (
                    <span className="mt-1 text-[10px] font-medium tracking-wider text-orange-500 uppercase">
                      Administrateur
                    </span>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1" />
            <SignOutButton>
              <DropdownMenuItem
                variant="destructive"
                className="cursor-pointer rounded-lg"
              >
                <IconLogout className="size-4" />
                <span>Se déconnecter</span>
              </DropdownMenuItem>
            </SignOutButton>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
