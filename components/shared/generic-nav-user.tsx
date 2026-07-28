"use client"

import { IconDotsVertical, IconLogout } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { UserAvatar } from "@/components/shared/user-avatar"
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
import { authClient } from "@/lib/auth-client"
import type { SessionUser } from "@/lib/session-user"
import { cn } from "@/lib/utils"

interface NavUserProps {
  user: SessionUser
  isAdmin?: boolean
}

/**
 * Item de menu utilisateur de la sidebar. L'utilisateur vient du layout serveur
 * (qui a déjà gardé la zone via `requireSession`/`requireRole`) : ce composant
 * n'a donc AUCUN état de chargement et ne garde ni ne redirige rien. Ne pas y
 * réintroduire de `useSession` — c'était la cause de l'overlay plein écran.
 */
export const GenericNavUser = ({ user, isAdmin = false }: NavUserProps) => {
  const { isMobile } = useSidebar()
  const router = useRouter()

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push("/connexion")
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
                isAdmin && [
                  "hover:bg-orange-500/10 dark:hover:bg-orange-400/10",
                  "data-[state=open]:bg-orange-500/15",
                ],
              )}
            >
              <UserAvatar
                name={user.name}
                image={user.image}
                className={cn(
                  "ring-offset-sidebar h-9 w-9 rounded-lg ring-2 ring-offset-2 transition-all",
                  isAdmin
                    ? "ring-orange-500/30 group-hover/avatar:ring-orange-500/50"
                    : "ring-blue-500/30 group-hover/avatar:ring-blue-500/50",
                )}
                fallbackClassName={cn(
                  "rounded-lg font-semibold",
                  isAdmin
                    ? "bg-linear-to-br from-orange-500 to-amber-500 text-white"
                    : "bg-linear-to-br from-blue-500 to-indigo-500 text-white",
                )}
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {user.email}
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
                <UserAvatar
                  name={user.name}
                  image={user.image}
                  className={cn(
                    "h-10 w-10 rounded-lg ring-2",
                    isAdmin ? "ring-orange-500/30" : "ring-blue-500/30",
                  )}
                  fallbackClassName={cn(
                    "rounded-lg font-semibold",
                    isAdmin
                      ? "bg-linear-to-br from-orange-500 to-amber-500 text-white"
                      : "bg-linear-to-br from-blue-500 to-indigo-500 text-white",
                  )}
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {user.email}
                  </span>
                  {isAdmin && (
                    <span className="mt-1 text-[10px] font-medium tracking-wider text-orange-500 uppercase">
                      Administrateur
                    </span>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer rounded-lg"
              onClick={handleSignOut}
            >
              <IconLogout className="size-4" />
              <span>Se déconnecter</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
