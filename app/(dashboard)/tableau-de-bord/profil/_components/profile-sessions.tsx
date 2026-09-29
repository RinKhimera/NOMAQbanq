"use client"

import { Monitor, Smartphone } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { StatusPill } from "@/components/shared/status-pill"
import { Button } from "@/components/ui/button"
import {
  revokeOtherUserSessions,
  revokeUserSession,
} from "@/features/users/actions"
import type { UserSession } from "@/features/users/dal"
import { callAction } from "@/lib/safe-action"
import { ProfileRow } from "./profile-section"

const MOBILE = /iphone|ipad|android|mobile/i

export const ProfileSessions = ({ sessions }: { sessions: UserSession[] }) => {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const hasOthers = sessions.some((s) => !s.isCurrent)

  // Garde sans `disabled` : le bouton cliqué garde le focus pendant l'appel.
  const run = async (
    action: () => Promise<{ success: boolean; error?: string }>,
    done: string,
  ) => {
    if (busy) return
    setBusy(true)
    const res = await callAction(action)
    setBusy(false)
    if (!res.success) {
      toast.error(res.error ?? "Échec de la déconnexion")
      return
    }
    toast.success(done)
    router.refresh()
  }

  if (sessions.length === 0) {
    return <p className="text-ink-3 text-sm">Aucune session active.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        {sessions.map((s) => (
          <ProfileRow
            key={s.id}
            icon={MOBILE.test(s.deviceLabel) ? <Smartphone /> : <Monitor />}
            title={s.deviceLabel}
            detail={`${s.ipAddress ?? "IP inconnue"} · actif le ${s.lastActiveLabel}`}
            badge={
              s.isCurrent && <StatusPill tone="info">Cet appareil</StatusPill>
            }
            action={
              !s.isCurrent && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-disabled={busy}
                  onClick={() =>
                    run(() => revokeUserSession(s.id), "Appareil déconnecté")
                  }
                  data-testid={`session-revoke-${s.id}`}
                  className="max-md:h-11"
                >
                  Déconnecter
                  <span className="sr-only"> : {s.deviceLabel}</span>
                </Button>
              )
            }
          />
        ))}
      </div>
      {hasOthers && (
        <div>
          <Button
            size="sm"
            variant="outline"
            aria-disabled={busy}
            onClick={() =>
              run(
                () => revokeOtherUserSessions(),
                "Autres appareils déconnectés",
              )
            }
            data-testid="session-revoke-others"
            className="max-md:h-11"
          >
            Déconnecter les autres appareils
          </Button>
        </div>
      )}
    </div>
  )
}
