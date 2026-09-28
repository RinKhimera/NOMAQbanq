"use client"

import { ShieldCheck, ShieldOff } from "lucide-react"
import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { updateUserRole } from "@/features/users/actions"
import type { AdminUserDetail } from "@/features/users/dal"
import { callAction } from "@/lib/safe-action"

interface UserRoleSectionProps {
  user: Pick<AdminUserDetail, "id" | "name" | "email" | "role">
  currentUserId: string
}

export const UserRoleSection = ({
  user,
  currentUserId,
}: UserRoleSectionProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const isSelf = user.id === currentUserId
  const isAdmin = user.role === "admin"

  const handleConfirm = async () => {
    const result = await callAction(() =>
      updateUserRole({
        userId: user.id,
        role: isAdmin ? "user" : "admin",
      }),
    )
    if (!result.success) {
      toast.error(result.error ?? "Une erreur est survenue.")
      return false
    }
    toast.success(
      isAdmin
        ? "Rôle administrateur retiré."
        : "Utilisateur promu administrateur.",
    )
    router.refresh()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/50 dark:bg-gray-900"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Rôle administrateur
        </h3>
      </div>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {isAdmin
          ? "Cet utilisateur a un accès complet au back-office : questions, examens, utilisateurs et transactions."
          : "Promouvoir cet utilisateur lui donne un accès complet au back-office : questions, examens, utilisateurs et transactions."}
      </p>

      {isSelf ? (
        <p
          data-testid="role-self-note"
          className="mt-4 text-sm text-gray-400 italic dark:text-gray-500"
        >
          Vous ne pouvez pas modifier votre propre rôle.
        </p>
      ) : (
        <>
          <Button
            data-testid="role-toggle-open"
            variant={isAdmin ? "outline" : "default"}
            className={
              isAdmin
                ? "mt-4 w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                : "mt-4 w-full rounded-xl"
            }
            onClick={() => setOpen(true)}
          >
            {isAdmin ? (
              <ShieldOff className="mr-2 h-4 w-4" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            {isAdmin
              ? "Retirer le rôle administrateur"
              : "Promouvoir administrateur"}
          </Button>

          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            variant={isAdmin ? "destructive" : "default"}
            title={
              isAdmin
                ? "Retirer le rôle administrateur ?"
                : "Promouvoir administrateur ?"
            }
            description={`${user.name} (${user.email}) ${
              isAdmin
                ? "perdra immédiatement l'accès au back-office."
                : "obtiendra un accès complet au back-office."
            }`}
            confirmLabel={isAdmin ? "Retirer le rôle" : "Promouvoir"}
            confirmTestId="role-toggle-confirm"
            onConfirm={handleConfirm}
          />
        </>
      )}
    </motion.div>
  )
}
