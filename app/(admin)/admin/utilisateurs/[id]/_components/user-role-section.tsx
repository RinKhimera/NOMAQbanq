"use client"

import { Info } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { updateUserRole } from "@/features/users/actions"
import type { UserFile } from "@/features/users/dal"
import { callAction } from "@/lib/safe-action"
import { userLabel } from "../../_components/user-labels"

/** Raison qui rend une action indisponible, affichée sous son bouton. */
export const Why = ({
  testId,
  children,
}: {
  testId?: string
  children: string
}) => (
  <span
    data-testid={testId}
    className="text-ink-2 inline-flex items-start gap-1.5 text-[0.8125rem] leading-snug"
  >
    <Info aria-hidden="true" className="text-ink-3 mt-0.5 size-3.5 shrink-0" />
    {children}
  </span>
)

/** Rôle : promouvoir ou rétrograder, jamais soi-même ni un compte suspendu. */
export const UserRoleSection = ({
  user,
  currentUserId,
}: {
  user: Pick<UserFile["user"], "id" | "name" | "email" | "role" | "banned">
  currentUserId: string
}) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const isAdmin = user.role === "admin"
  const label = userLabel(user.name)
  const why =
    user.id === currentUserId
      ? {
          id: "role-self-note",
          text: "Vous ne pouvez pas modifier votre propre rôle.",
        }
      : !isAdmin && user.banned
        ? {
            id: "role-banned-note",
            text: "Levez d'abord la suspension de ce compte.",
          }
        : null

  const confirm = async () => {
    const result = await callAction(() =>
      updateUserRole({ userId: user.id, role: isAdmin ? "user" : "admin" }),
    )
    if (!result.success) {
      toast.error(result.error ?? "Une erreur est survenue.")
      return false
    }
    toast.success(
      isAdmin ? "Rôle administrateur retiré" : "Rôle administrateur accordé",
    )
    router.refresh()
  }

  return (
    <div className="flex flex-col items-start gap-2.5 text-sm">
      <div>
        <p className="text-ink font-medium">
          {isAdmin ? "Administrateur" : "Étudiant"}
        </p>
        <p className="text-ink-3 text-[0.8125rem]">
          {isAdmin
            ? "Accès à toute la zone admin."
            : "Accès selon ses abonnements."}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        data-testid="role-toggle-open"
        disabled={why !== null}
        onClick={() => setOpen(true)}
      >
        {isAdmin
          ? "Retirer le rôle administrateur"
          : "Promouvoir administrateur"}
      </Button>
      {why && <Why testId={why.id}>{why.text}</Why>}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        variant={isAdmin ? "destructive" : "default"}
        title={
          isAdmin
            ? "Retirer le rôle administrateur ?"
            : `Promouvoir ${label} administrateur ?`
        }
        description={
          isAdmin
            ? `${label} (${user.email}) redevient étudiant. Ses sessions restent ouvertes ; il perd l'accès à la zone admin à son prochain chargement de page.`
            : `${label} (${user.email}) accèdera à toute la zone admin, y compris les paiements et les comptes. Un administrateur n'est jamais bloqué par les accès.`
        }
        confirmLabel={isAdmin ? "Retirer le rôle" : "Promouvoir"}
        confirmTestId="role-toggle-confirm"
        onConfirm={confirm}
      />
    </div>
  )
}
