"use client"

import { ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

type SessionNavigationProps = {
  currentIndex: number
  totalQuestions: number
  onPrevious: () => void
  onNext: () => void
  onFinish: () => void
  /** « Terminer la série », « Soumettre ». */
  finishLabel: string
  /** Mode tuteur : un choix attend sa validation. */
  onValidate?: () => void
  isValidating?: boolean
}

/**
 * Pied de la carte en passation : « Précédente » à gauche, action primaire à
 * droite. L'action primaire est UN bouton de largeur minimale fixe, dont le
 * rôle change (valider le choix en tuteur, question suivante, fin de la
 * série) : il ne bouge pas, et le focus clavier le suit d'une étape à l'autre.
 */
export const SessionNavigation = ({
  currentIndex,
  totalQuestions,
  onPrevious,
  onNext,
  onFinish,
  finishLabel,
  onValidate,
  isValidating = false,
}: SessionNavigationProps) => {
  const isLast = currentIndex === totalQuestions - 1
  const primary = onValidate
    ? { label: "Valider ma réponse", onClick: onValidate, arrow: false }
    : isLast
      ? { label: finishLabel, onClick: onFinish, arrow: false }
      : { label: "Suivante", onClick: onNext, arrow: true }

  return (
    <div
      data-testid="session-navigation"
      className="flex flex-1 items-center justify-between gap-2"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onPrevious}
        disabled={currentIndex === 0}
        data-testid="btn-previous"
        className="max-md:h-11"
      >
        <ArrowLeft aria-hidden />
        Précédente
      </Button>
      <Button
        size="sm"
        onClick={primary.onClick}
        disabled={isValidating}
        data-testid={
          onValidate
            ? "btn-validate-answer"
            : isLast
              ? "btn-finish"
              : "btn-next"
        }
        className="min-w-38 max-md:h-11"
      >
        {primary.label}
        {primary.arrow && <ArrowRight aria-hidden />}
      </Button>
    </div>
  )
}
