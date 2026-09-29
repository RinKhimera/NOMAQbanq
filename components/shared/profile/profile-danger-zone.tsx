"use client"

import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { deleteMyAccount } from "@/features/users/actions"
import { authClient } from "@/lib/auth-client"
import { callAction } from "@/lib/safe-action"

export const ProfileDangerZone = ({ email }: { email: string }) => {
  const router = useRouter()
  const [confirmEmail, setConfirmEmail] = useState("")
  const matches = confirmEmail.trim().toLowerCase() === email.toLowerCase()

  const onDelete = async () => {
    if (!matches) return false
    const res = await callAction(() => deleteMyAccount({ confirmEmail }))
    if (!res.success) {
      toast.error(res.error ?? "Suppression impossible")
      return false
    }
    // Le compte est supprimé côté serveur : rediriger même si le signOut
    // échoue (la session ne survivra pas côté serveur de toute façon)
    await authClient.signOut().catch(() => {})
    router.replace("/compte-supprime")
  }

  return (
    <ConfirmDialog
      variant="destructive"
      title="Supprimer votre compte ?"
      description="Vous serez déconnecté de tous vos appareils. Vous pourrez réactiver le compte en vous reconnectant pendant 30 jours ; ensuite, vos données personnelles sont anonymisées."
      confirmLabel="Supprimer définitivement"
      pendingLabel="Suppression…"
      confirmDisabled={!matches}
      confirmTestId="danger-confirm-delete"
      onOpenChange={(open) => {
        if (!open) setConfirmEmail("")
      }}
      onConfirm={onDelete}
      trigger={
        <Button
          variant="destructive"
          size="sm"
          data-testid="danger-open-delete"
          className="w-fit max-md:h-11"
        >
          <Trash2 aria-hidden="true" />
          Supprimer mon compte
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="danger-confirm-email"
          className="text-ink-2 font-normal"
        >
          <span>
            Pour confirmer, saisissez votre adresse courriel :{" "}
            <strong className="text-ink font-medium">{email}</strong>
          </span>
        </Label>
        <Input
          id="danger-confirm-email"
          type="email"
          autoComplete="off"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          placeholder={email}
          data-testid="danger-confirm-email"
          className="max-md:h-11"
        />
      </div>
    </ConfirmDialog>
  )
}
