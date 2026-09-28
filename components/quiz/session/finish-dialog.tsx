"use client"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { cn } from "@/lib/utils"
import type { FinishDialogProps } from "./types"

/** Récapitulatif avant la soumission d'un examen ou la fin d'une série. */
export const FinishDialog = ({
  isOpen,
  onOpenChange,
  answeredCount,
  totalQuestions,
  flaggedCount,
  isSubmitting,
  onConfirm,
  kind,
}: FinishDialogProps) => {
  const unanswered = totalQuestions - answeredCount
  const exam = kind === "exam"
  const cells = [
    { label: "Répondues", value: answeredCount },
    { label: "Sans réponse", value: unanswered, alert: unanswered > 0 },
    { label: "Marquées", value: flaggedCount },
  ]

  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={onOpenChange}
      title={exam ? "Soumettre l'examen ?" : "Terminer la série ?"}
      description={
        exam
          ? "Une fois soumis, vous ne pourrez plus modifier vos réponses."
          : "Vous pourrez revoir chaque question et son explication."
      }
      confirmLabel={exam ? "Soumettre" : "Voir les résultats"}
      pendingLabel={exam ? "Soumission…" : "Calcul du score…"}
      cancelLabel={exam ? "Revenir à l'examen" : "Continuer"}
      isPending={isSubmitting}
      // La page redirige au succès ; un échec laisse le dialogue ouvert,
      // pour réessayer.
      onConfirm={() => {
        onConfirm()
        return false
      }}
    >
      <dl className="border-line bg-line grid grid-cols-3 gap-px overflow-hidden rounded-md border">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className="bg-surface-2 flex flex-col-reverse px-3.5 py-3"
          >
            <dt className="text-ink-3 text-xs">{cell.label}</dt>
            <dd
              className={cn(
                "font-mono text-xl tabular-nums",
                cell.alert ? "text-danger-ink" : "text-ink",
              )}
            >
              {cell.value}
            </dd>
          </div>
        ))}
      </dl>
    </ConfirmDialog>
  )
}
