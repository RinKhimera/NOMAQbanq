"use client"

import { IconAlertTriangle } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { deleteMyAccount } from "@/features/users/actions"
import { authClient } from "@/lib/auth-client"
import { callAction } from "@/lib/safe-action"

export const ProfileDangerZone = ({ email }: { email: string }) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const matches = confirmEmail.trim().toLowerCase() === email.toLowerCase()

  const onDelete = async () => {
    if (!matches) return
    setBusy(true)
    const res = await callAction(() => deleteMyAccount({ confirmEmail }))
    if (!res.success) {
      setBusy(false)
      toast.error(res.error ?? "Suppression impossible")
      return
    }
    // Le compte est supprimé côté serveur : rediriger même si le signOut
    // échoue (la session ne survivra pas côté serveur de toute façon)
    await authClient.signOut().catch(() => {})
    router.replace("/compte-supprime")
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-red-200 shadow-sm dark:border-red-900/50">
      <CardHeader className="block border-b border-red-100 bg-red-50/50 px-6 py-4 dark:border-red-900/50 dark:bg-red-950/20">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/20">
            <IconAlertTriangle className="h-5 w-5 text-white" />
          </div>
          <span className="font-display font-semibold text-red-700 dark:text-red-400">
            Zone de danger
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6">
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          La suppression désactive votre compte immédiatement. Vous avez{" "}
          <strong>30 jours</strong> pour le réactiver en vous reconnectant ;
          passé ce délai, vos données personnelles sont définitivement
          anonymisées.
        </p>

        {!open ? (
          <Button
            variant="destructive"
            className="mt-4"
            onClick={() => setOpen(true)}
            data-testid="danger-open-delete"
          >
            Supprimer mon compte
          </Button>
        ) : (
          <div className="mt-4 space-y-3 rounded-xl border border-red-200 p-4 dark:border-red-900/50">
            <label
              htmlFor="danger-confirm-email"
              className="text-sm font-medium text-gray-900 dark:text-white"
            >
              Saisissez votre adresse courriel pour confirmer :
            </label>
            <Input
              id="danger-confirm-email"
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={email}
              data-testid="danger-confirm-email"
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={!matches || busy}
                onClick={onDelete}
                data-testid="danger-confirm-delete"
              >
                {busy ? "Suppression..." : "Supprimer définitivement"}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
