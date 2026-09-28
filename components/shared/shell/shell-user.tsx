"use client"

import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"
import type { SessionUser } from "@/lib/session-user"

/**
 * L'utilisateur vient du layout serveur, qui a déjà gardé la zone : aucun
 * état de chargement ici, et jamais d'`authClient.useSession()` (mismatch
 * d'hydratation, `.claude/rules/loading-ui.md`).
 */
export const ShellUser = ({ user }: { user: SessionUser }) => {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    await authClient.signOut()
    router.push("/connexion")
  }

  return (
    <div className="border-line flex items-center gap-2.5 border-t px-2 pt-3 pb-1">
      <UserAvatar
        name={user.name}
        image={user.image}
        className="size-8"
        fallbackClassName="bg-surface-2 text-ink-2 text-xs font-medium"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-ink truncate text-[13px] font-medium">
          {user.name}
        </span>
        <span className="text-ink-3 truncate text-xs">{user.email}</span>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="max-md:size-11"
        aria-label="Se déconnecter"
        disabled={signingOut}
        onClick={handleSignOut}
      >
        {signingOut ? (
          <Spinner size="sm" label="Déconnexion…" />
        ) : (
          <LogOut aria-hidden />
        )}
      </Button>
    </div>
  )
}
