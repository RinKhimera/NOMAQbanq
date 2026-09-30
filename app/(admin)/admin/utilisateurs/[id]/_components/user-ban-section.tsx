"use client"

import { Ban } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { BannedPill } from "@/components/shared/status-pill"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { banUser, unbanUser } from "@/features/users/actions"
import type { UserBanView, UserFile } from "@/features/users/dal"
import { formatMediumDate, formatMediumDateTime } from "@/lib/format"
import { callAction } from "@/lib/safe-action"
import { userLabel } from "../../_components/user-labels"
import { Why } from "./user-role-section"

const REASON_MIN = 5
const REASON_MAX = 500

// Après anonymisation, la jointure renvoie « Utilisateur supprimé » ; le repli
// ne couvre que la FK mise à null (suppression physique, jamais faite).
const by = (name: string | null) => name ?? "un compte supprimé"

/** Suspension : épisode en cours, levée, suspension, épisodes précédents. */
export const UserBanSection = ({
  user,
  bans,
  currentUserId,
}: {
  user: Pick<UserFile["user"], "id" | "name" | "email" | "role" | "banned">
  bans: UserBanView[]
  currentUserId: string
}) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const label = userLabel(user.name)
  const activeBan = bans.find((b) => b.liftedAt === null) ?? null
  const pastBans = bans.filter((b) => b.liftedAt !== null)
  const trimmed = reason.trim()
  const reasonError =
    !user.banned && reason && trimmed.length < REASON_MIN
      ? "Le motif doit compter au moins 5 caractères."
      : reason.length > REASON_MAX
        ? "500 caractères au plus."
        : null
  const banReasonValid =
    trimmed.length >= REASON_MIN && trimmed.length <= REASON_MAX
  const why =
    user.id === currentUserId
      ? {
          id: "ban-self-note",
          text: "Vous ne pouvez pas suspendre votre propre compte.",
        }
      : user.role === "admin" && !user.banned
        ? {
            id: "ban-admin-note",
            text: "Retirez d'abord le rôle administrateur de ce compte.",
          }
        : null

  const confirm = async () => {
    const result = await callAction(() =>
      user.banned
        ? unbanUser({ userId: user.id, reason: trimmed || undefined })
        : banUser({ userId: user.id, reason: trimmed }),
    )
    if (!result.success) {
      toast.error(result.error ?? "Une erreur est survenue.")
      return false
    }
    toast.success(
      user.banned ? "Suspension levée" : "Compte suspendu · sessions fermées",
    )
    setReason("")
    router.refresh()
  }

  return (
    <div className="flex flex-col items-start gap-2.5 text-sm">
      {user.banned ? (
        <div className="border-danger bg-surface flex w-full flex-col gap-1 rounded-md border px-3.5 py-3">
          <BannedPill />
          {activeBan ? (
            <>
              <p className="text-ink">
                Depuis le {formatMediumDateTime(activeBan.bannedAt)}, par{" "}
                {by(activeBan.bannedByName)}
              </p>
              <p className="text-ink-2">Motif : {activeBan.reason}</p>
            </>
          ) : (
            <p className="text-ink-3 italic">
              Suspension sans épisode dans le journal.
            </p>
          )}
          <p className="text-ink-3 text-xs">
            Toutes ses sessions ont été fermées ; il voit la page « Compte
            suspendu ».
          </p>
        </div>
      ) : (
        <div>
          <p className="text-ink font-medium">Compte actif</p>
          <p className="text-ink-3 text-[0.8125rem]">
            La suspension ferme toutes les sessions du compte.
          </p>
        </div>
      )}

      {user.banned ? (
        <Button
          type="button"
          variant="outline"
          data-testid="unban-open"
          disabled={user.id === currentUserId}
          onClick={() => setOpen(true)}
        >
          Lever la suspension
        </Button>
      ) : (
        <Button
          type="button"
          variant="destructive"
          data-testid="ban-open"
          disabled={why !== null}
          onClick={() => setOpen(true)}
        >
          <Ban aria-hidden="true" />
          Suspendre le compte
        </Button>
      )}
      {why && !user.banned && <Why testId={why.id}>{why.text}</Why>}

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        variant={user.banned ? "default" : "destructive"}
        title={
          user.banned
            ? `Lever la suspension de ${label} ?`
            : `Suspendre ${label} ?`
        }
        description={
          user.banned
            ? "Il pourra se reconnecter immédiatement. L'épisode reste dans l'historique."
            : "Toutes ses sessions sont fermées immédiatement et il voit la page « Compte suspendu ». Ses données sont conservées."
        }
        confirmLabel={user.banned ? "Lever la suspension" : "Suspendre"}
        confirmTestId={user.banned ? "unban-confirm" : "ban-confirm"}
        confirmDisabled={
          user.banned ? reason.length > REASON_MAX : !banReasonValid
        }
        onConfirm={confirm}
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="ban-reason">
              {user.banned ? "Motif de levée" : "Motif"}
            </Label>
            <span className="text-ink-3 text-xs">
              {user.banned ? "Optionnel" : "Obligatoire"}
            </span>
          </div>
          <Textarea
            id="ban-reason"
            data-testid={user.banned ? "unban-reason" : "ban-reason"}
            value={reason}
            aria-invalid={Boolean(reasonError)}
            onChange={(e) => setReason(e.target.value)}
            rows={user.banned ? 2 : 3}
            placeholder={
              user.banned
                ? undefined
                : "Ex. : partage de compte signalé par deux candidats"
            }
          />
          {reasonError ? (
            <p role="alert" className="text-danger-ink text-xs">
              {reasonError}
            </p>
          ) : (
            <p className="text-ink-3 text-xs">
              {reason.length} / {REASON_MAX}
              {user.banned ? "" : " · visible dans l'historique admin"}
            </p>
          )}
        </div>
      </ConfirmDialog>

      {pastBans.length > 0 && (
        <div className="border-line flex w-full flex-col gap-1.5 border-t pt-3">
          <span className="type-label">
            Épisodes précédents · {pastBans.length}
          </span>
          {pastBans.map((ban) => (
            <div
              key={ban.id}
              className="flex flex-col gap-0.5 text-[0.8125rem]"
            >
              <span className="text-ink">
                Suspendu le {formatMediumDate(ban.bannedAt)} par{" "}
                {by(ban.bannedByName)} : {ban.reason}
              </span>
              <span className="text-ink-3">
                Levée le {formatMediumDate(ban.liftedAt!)} par{" "}
                {by(ban.liftedByName)}
                {ban.liftReason ? ` · ${ban.liftReason}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
