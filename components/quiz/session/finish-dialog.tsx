"use client"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { cn } from "@/lib/utils"
import type { FinishDialogProps, SessionKind } from "./types"

const COPY: Record<
  SessionKind,
  Record<"title" | "description" | "confirm" | "pending" | "cancel", string>
> = {
  exam: {
    title: "Soumettre l'examen ?",
    description: "Une fois soumis, vous ne pourrez plus modifier vos réponses.",
    confirm: "Soumettre",
    pending: "Soumission…",
    cancel: "Revenir à l'examen",
  },
  training: {
    title: "Terminer la série ?",
    description: "Vous pourrez revoir chaque question et son explication.",
    confirm: "Voir les résultats",
    pending: "Calcul du score…",
    cancel: "Continuer",
  },
}

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
  const copy = COPY[kind]
  const cells = [
    { label: "Répondues", value: answeredCount },
    { label: "Sans réponse", value: unanswered, alert: unanswered > 0 },
    { label: "Marquées", value: flaggedCount },
  ]

  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirm}
      pendingLabel={copy.pending}
      cancelLabel={copy.cancel}
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
