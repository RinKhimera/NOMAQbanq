"use client"

import { ShieldCheck, ShieldOff } from "lucide-react"
import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { banUser, unbanUser } from "@/features/users/actions"
import type { AdminUserDetail, UserBanView } from "@/features/users/dal"
import { formatLongDateTime } from "@/lib/format"
import { callAction } from "@/lib/safe-action"

const REASON_MIN = 5
const REASON_MAX = 500

interface UserBanSectionProps {
  user: Pick<AdminUserDetail, "id" | "name" | "email" | "role" | "banned">
  bans: UserBanView[]
  currentUserId: string
}

// Après anonymisation, la jointure renvoie « Utilisateur supprimé » ; le repli
// ne couvre que la FK mise à null (suppression physique, jamais faite).
const authorLabel = (name: string | null) => name ?? "un compte supprimé"

const BanEpisode = ({ ban }: { ban: UserBanView }) => (
  <li className="rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-700">
    <p className="text-gray-500 dark:text-gray-400">
      Du {formatLongDateTime(ban.bannedAt)} par {authorLabel(ban.bannedByName)}
      {ban.liftedAt !== null && (
        <>
          {" "}
          au {formatLongDateTime(ban.liftedAt)} par{" "}
          {authorLabel(ban.liftedByName)}
        </>
      )}
    </p>
    <p className="mt-1 text-gray-900 dark:text-white">{ban.reason}</p>
    {ban.liftReason && (
      <p className="mt-1 text-gray-500 italic dark:text-gray-400">
        Levée : {ban.liftReason}
      </p>
    )}
  </li>
)

export const UserBanSection = ({
  user,
  bans,
  currentUserId,
}: UserBanSectionProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [isPending, startTransition] = useTransition()

  const isSelf = user.id === currentUserId
  const isAdmin = user.role === "admin"
  const activeBan = bans.find((b) => b.liftedAt === null) ?? null
  const pastBans = bans.filter((b) => b.liftedAt !== null)
  const trimmed = reason.trim()
  const banReasonValid =
    trimmed.length >= REASON_MIN && trimmed.length <= REASON_MAX

  const handleConfirm = () => {
    startTransition(async () => {
      // callAction : un rejet fetch dans une transition remonterait à l'error
      // boundary au rendu (React 19), pas seulement en unhandled rejection.
      const result = await callAction(() =>
        user.banned
          ? unbanUser({ userId: user.id, reason: trimmed || undefined })
          : banUser({ userId: user.id, reason: trimmed }),
      )
      if (result.success) {
        toast.success(user.banned ? "Suspension levée." : "Compte suspendu.")
        setOpen(false)
        setReason("")
        router.refresh()
      } else {
        toast.error(result.error ?? "Une erreur est survenue.")
      }
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/50 dark:bg-gray-900"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldOff className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Suspension
          </h3>
        </div>
        {user.banned && (
          <Badge
            data-testid="ban-badge"
            className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400"
          >
            Suspendu
          </Badge>
        )}
      </div>

      {user.banned ? (
        <div className="mt-3 space-y-2 text-sm">
          {activeBan ? (
            <>
              <p className="text-gray-500 dark:text-gray-400">
                Depuis le {formatLongDateTime(activeBan.bannedAt)} par{" "}
                {authorLabel(activeBan.bannedByName)}
              </p>
              <blockquote className="border-l-2 border-red-300 pl-3 text-gray-900 dark:border-red-800 dark:text-white">
                {activeBan.reason}
              </blockquote>
            </>
          ) : (
            <p className="text-gray-500 italic dark:text-gray-400">
              Suspension sans épisode dans le journal.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Suspendre ce compte le déconnecte partout et lui interdit toute
          connexion. Ses accès et ses transactions sont conservés et reviennent
          à la levée.
        </p>
      )}

      {isSelf ? (
        <p
          data-testid="ban-self-note"
          className="mt-4 text-sm text-gray-400 italic dark:text-gray-500"
        >
          Vous ne pouvez pas suspendre votre propre compte.
        </p>
      ) : isAdmin && !user.banned ? (
        <p
          data-testid="ban-admin-note"
          className="mt-4 text-sm text-gray-400 italic dark:text-gray-500"
        >
          Retirez d&apos;abord le rôle administrateur pour suspendre ce compte.
        </p>
      ) : (
        <>
          <Button
            data-testid={user.banned ? "unban-open" : "ban-open"}
            variant={user.banned ? "outline" : "default"}
            className={
              user.banned
                ? "mt-4 w-full rounded-xl"
                : "mt-4 w-full rounded-xl bg-red-600 text-white hover:bg-red-700"
            }
            onClick={() => setOpen(true)}
          >
            {user.banned ? (
              <ShieldCheck className="mr-2 h-4 w-4" />
            ) : (
              <ShieldOff className="mr-2 h-4 w-4" />
            )}
            {user.banned ? "Lever la suspension" : "Suspendre ce compte"}
          </Button>

          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {user.banned
                    ? "Lever la suspension ?"
                    : "Suspendre ce compte ?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {user.name} ({user.email}){" "}
                  {user.banned
                    ? "pourra de nouveau se connecter ; ses accès sont inchangés."
                    : "sera déconnecté partout et ne pourra plus se connecter. Le motif reste interne."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-1">
                <Textarea
                  data-testid={user.banned ? "unban-reason" : "ban-reason"}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={REASON_MAX}
                  placeholder={
                    user.banned
                      ? "Motif de la levée (facultatif)"
                      : "Motif de la suspension (obligatoire, 5 à 500 caractères)"
                  }
                  aria-label="Motif"
                  rows={3}
                />
                <p className="text-right text-xs text-gray-400">
                  {trimmed.length}/{REASON_MAX}
                </p>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>
                  Annuler
                </AlertDialogCancel>
                <AlertDialogAction
                  data-testid={user.banned ? "unban-confirm" : "ban-confirm"}
                  disabled={isPending || (!user.banned && !banReasonValid)}
                  onClick={(e) => {
                    e.preventDefault()
                    handleConfirm()
                  }}
                  className={
                    user.banned ? "" : "bg-red-600 text-white hover:bg-red-700"
                  }
                >
                  {user.banned ? "Lever" : "Suspendre"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {pastBans.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Épisodes précédents
          </p>
          <ul className="space-y-2">
            {pastBans.map((ban) => (
              <BanEpisode key={ban.id} ban={ban} />
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  )
}
