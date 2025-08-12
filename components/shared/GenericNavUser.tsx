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
      <div className="bg-background fixed inset-0 z-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="border-primary h-12 w-12 animate-spin rounded-full border-b-2"></div>
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
      <div className="bg-background fixed inset-0 z-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="border-destructive h-12 w-12 animate-spin rounded-full border-b-2"></div>
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

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="group data-[state=open]:text-sidebar-accent-foreground hover:bg-muted data-[state=open]:bg-muted dark:hover:bg-gray-900 dark:data-[state=open]:bg-gray-900"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={currentUser.image} alt={currentUser.name} />
                <AvatarFallback className="group-[hover]: rounded-lg bg-gray-900">
                  CN
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{currentUser.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {currentUser.email}
                </span>
              </div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="bg-card w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={currentUser.image} alt={currentUser.name} />
                  <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {currentUser.name}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {currentUser.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <SignOutButton>
              <DropdownMenuItem variant="destructive">
                <IconLogout />
                Se déconnecter
              </DropdownMenuItem>
            </SignOutButton>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
