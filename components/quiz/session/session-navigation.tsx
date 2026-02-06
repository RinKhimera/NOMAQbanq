"use client"

import { ChevronLeft, ChevronRight, Flag, CheckCircle, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SessionNavigationProps } from "./types"

export const SessionNavigation = ({
  currentIndex,
  totalQuestions,
  isFlagged,
  onPrevious,
  onNext,
  onToggleFlag,
  isPreviousLocked = false,
  isNextLocked = false,
  accentColor = "emerald",
}: SessionNavigationProps) => {
  const isFirstQuestion = currentIndex === 0
  const isLastQuestion = currentIndex === totalQuestions - 1

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Previous button */}
      <Button
        variant="outline"
        onClick={onPrevious}
        disabled={isFirstQuestion || isPreviousLocked}
        className={cn(
          "gap-2",
          isPreviousLocked && "cursor-not-allowed opacity-50"
        )}
      >
        {isPreviousLocked ? (
          <Lock className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">Précédent</span>
      </Button>

      {/* Flag button */}
      <Button
        variant="outline"
        onClick={onToggleFlag}
        className={cn(
          "gap-2",
          isFlagged &&
            "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
        )}
      >
        <Flag className={cn("h-4 w-4", isFlagged && "fill-amber-500")} />
        <span className="hidden sm:inline">
          {isFlagged ? "Marquée" : "Marquer"}
        </span>
      </Button>

      {/* Next button or Finish button on last question */}
      {isLastQuestion ? (
        <Button
          onClick={onNext}
          className={cn(
            "gap-2 shadow-md",
            accentColor === "blue"
              ? "bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              : "bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
          )}
        >
          <CheckCircle className="h-4 w-4" />
          <span>Terminer</span>
        </Button>
      ) : (
        <Button
          variant="outline"
          onClick={onNext}
          disabled={isNextLocked}
          className={cn(
            "gap-2",
            isNextLocked && "cursor-not-allowed opacity-50"
          )}
        >
          <span className="hidden sm:inline">Suivant</span>
          {isNextLocked ? (
            <Lock className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  )
}
