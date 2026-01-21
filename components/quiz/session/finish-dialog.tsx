"use client"

import { Flag, Loader2, AlertTriangle, Clock } from "lucide-react"
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
import { cn } from "@/lib/utils"
import { formatExamTime } from "@/lib/exam-timer"
import type { FinishDialogProps } from "./types"

export const FinishDialog = ({
  isOpen,
  onOpenChange,
  answeredCount,
  totalQuestions,
  flaggedCount,
  isSubmitting,
  onConfirm,
  mode,
  timeRemaining,
  confirmText = "Terminer",
  cancelText = "Continuer",
}: FinishDialogProps) => {
  const unansweredCount = totalQuestions - answeredCount
  const hasUnanswered = unansweredCount > 0
  const hasFlagged = flaggedCount > 0

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 font-display text-xl">
            {mode === "exam" ? "Soumettre l'examen ?" : "Terminer la session ?"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              {/* Stats summary */}
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Répondues
                    </span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {answeredCount}/{totalQuestions}
                    </span>
                  </div>
                  {hasFlagged && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                        <Flag className="h-3.5 w-3.5" />
                        Marquées
                      </span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {flaggedCount}
                      </span>
                    </div>
                  )}
                  {mode === "exam" && timeRemaining !== undefined && (
                    <div className="col-span-2 flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-700">
                      <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                        <Clock className="h-3.5 w-3.5" />
                        Temps restant
                      </span>
                      <span
                        className={cn(
                          "font-mono font-semibold",
                          timeRemaining < 5 * 60 * 1000
                            ? "text-red-600 dark:text-red-400"
                            : timeRemaining < 10 * 60 * 1000
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-gray-700 dark:text-gray-300"
                        )}
                      >
                        {formatExamTime(timeRemaining)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {(hasUnanswered || hasFlagged) && (
                <div className="space-y-2">
                  {hasUnanswered && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        <strong>{unansweredCount} question{unansweredCount > 1 ? "s" : ""}</strong>{" "}
                        non répondue{unansweredCount > 1 ? "s" : ""} sera{unansweredCount > 1 ? "ont" : ""} comptée{unansweredCount > 1 ? "s" : ""} comme incorrecte{unansweredCount > 1 ? "s" : ""}.
                      </p>
                    </div>
                  )}
                  {hasFlagged && (
                    <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                      <Flag className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Vous avez <strong>{flaggedCount} question{flaggedCount > 1 ? "s" : ""} marquée{flaggedCount > 1 ? "s" : ""}</strong> pour révision.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={isSubmitting}
            className={cn(
              mode === "exam"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === "exam" ? "Soumission..." : "Calcul du score..."}
              </>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
