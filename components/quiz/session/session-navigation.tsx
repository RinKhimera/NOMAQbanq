"use client"

import { ArrowLeft, ArrowRight } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

type SessionNavigationProps = {
  currentIndex: number
  totalQuestions: number
  onPrevious: () => void
  onNext: () => void
  onFinish: () => void
  /** « Terminer la série », « Soumettre ». */
  finishLabel: string
  /** Action intercalée avant « Suivante » (validation en mode tuteur). */
  children?: ReactNode
}

/**
 * Pied de la carte en passation : « Précédente » à gauche, action primaire à
 * droite, de largeur minimale fixe pour ne pas bouger d'une question à
 * l'autre, ni quand elle devient la fin de la série.
 */
export const SessionNavigation = ({
  currentIndex,
  totalQuestions,
  onPrevious,
  onNext,
  onFinish,
  finishLabel,
  children,
}: SessionNavigationProps) => {
  const isLast = currentIndex === totalQuestions - 1

  return (
    <div
      data-testid="session-navigation"
      className="flex flex-1 flex-wrap items-center justify-between gap-2"
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
      <div className="flex flex-wrap items-center justify-end gap-2">
        {children}
        {/* Un seul bouton, dont le rôle change à la dernière question : deux
            boutons distincts perdraient le focus clavier au passage. */}
        <Button
          size="sm"
          onClick={isLast ? onFinish : onNext}
          data-testid={isLast ? "btn-finish" : "btn-next"}
          className="min-w-33 max-md:h-11"
        >
          {isLast ? finishLabel : "Suivante"}
          {!isLast && <ArrowRight aria-hidden />}
        </Button>
      </div>
    </div>
  )
}
