"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

type TimeUpDialogProps = {
  answeredCount: number
  totalQuestions: number
  isSubmitting: boolean
  /** L'auto-soumission a échoué (réseau) : l'étudiant la relance lui-même. */
  onRetry: () => void
}

/**
 * Chronomètre épuisé : dialogue non fermable pendant que l'examen se soumet
 * automatiquement. Seul le bouton de relance reste, si la soumission a
 * échoué ; la page redirige au succès.
 */
export const TimeUpDialog = ({
  answeredCount,
  totalQuestions,
  isSubmitting,
  onRetry,
}: TimeUpDialogProps) => {
  const unanswered = totalQuestions - answeredCount
  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        data-testid="time-up-dialog"
      >
        <DialogHeader>
          <DialogTitle>Temps écoulé</DialogTitle>
          <DialogDescription>
            Votre examen est soumis automatiquement avec {answeredCount}{" "}
            {answeredCount > 1 ? "réponses" : "réponse"} sur {totalQuestions}.
          </DialogDescription>
        </DialogHeader>
        <dl className="border-line bg-line grid grid-cols-2 gap-px overflow-hidden rounded-md border">
          {[
            { label: "Répondues", value: answeredCount, alert: false },
            { label: "Sans réponse", value: unanswered, alert: unanswered > 0 },
          ].map((cell) => (
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
        <DialogFooter>
          {isSubmitting ? (
            <span className="text-ink-2 inline-flex h-10 items-center gap-2 text-sm">
              <Spinner size="sm" />
              Soumission…
            </span>
          ) : (
            <Button
              type="button"
              onClick={onRetry}
              data-testid="btn-time-up-submit"
            >
              Soumettre
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
