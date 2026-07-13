"use client"

import { IconDeviceLaptop, IconLogout } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  revokeOtherUserSessions,
  revokeUserSession,
} from "@/features/users/actions"
import type { UserSession } from "@/features/users/dal"
import { callAction } from "@/lib/safe-action"

export const ProfileSessions = ({ sessions }: { sessions: UserSession[] }) => {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const hasOthers = sessions.some((s) => !s.isCurrent)

  const revokeOne = async (id: string) => {
    setBusy(true)
    const res = await callAction(() => revokeUserSession(id))
    setBusy(false)
    if (!res.success) {
      toast.error(res.error ?? "Échec de la révocation")
      return
    }
    toast.success("Appareil déconnecté")
    router.refresh()
  }

  const revokeOthers = async () => {
    setBusy(true)
    const res = await callAction(() => revokeOtherUserSessions())
    setBusy(false)
    if (!res.success) {
      toast.error(res.error ?? "Échec")
      return
    }
    toast.success("Autres appareils déconnectés")
    router.refresh()
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-gray-100 shadow-sm dark:border-gray-800">
      <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-500/20">
            <IconDeviceLaptop className="h-5 w-5 text-white" />
          </div>
          <span className="font-display font-semibold text-gray-900 dark:text-white">
            Appareils connectés
          </span>
        </CardTitle>
        {hasOthers && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={revokeOthers}
            data-testid="session-revoke-others"
          >
            <IconLogout className="mr-2 h-4 w-4" />
            Déconnecter les autres
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-3 p-6">
        {sessions.length === 0 && (
          <p className="text-sm text-gray-500">Aucune session active.</p>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-4 dark:border-gray-800"
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {s.deviceLabel}
                </p>
                {s.isCurrent && <Badge variant="secondary">Cet appareil</Badge>}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {s.ipAddress ?? "IP inconnue"} · actif le {s.lastActiveLabel}
              </p>
            </div>
            {!s.isCurrent && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => revokeOne(s.id)}
                data-testid={`session-revoke-${s.id}`}
              >
                Déconnecter
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
