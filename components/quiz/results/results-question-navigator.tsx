"use client"

import { useState, useMemo } from "react"
import { AnimatePresence, motion } from "motion/react"
import { List, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ResultsNavigatorProps } from "./types"
import { resultColors } from "./types"

export const ResultsQuestionNavigator = ({
  questionResults,
  onNavigateToQuestion,
  variant,
  position = "right",
  accentColor = "blue",
  showTips = true,
}: ResultsNavigatorProps) => {
  const [isOpen, setIsOpen] = useState(false)

  const colors = resultColors[accentColor]

  const stats = useMemo(() => {
    const correct = questionResults.filter((r) => r.isCorrect).length
    const incorrect = questionResults.filter((r) => !r.isCorrect && r.isAnswered).length
    const unanswered = questionResults.filter((r) => !r.isAnswered).length
    return { correct, incorrect, unanswered }
  }, [questionResults])

  const handleNavigate = (index: number) => {
    onNavigateToQuestion(index)
    if (variant === "mobile") {
      setIsOpen(false)
    }
  }

  // Shared navigation grid content
  const navigationGrid = (
    <div
      className={cn(
        "grid gap-1.5",
        questionResults.length > 15 ? "grid-cols-6" : "grid-cols-5"
      )}
    >
      {questionResults.map((result, index) => (
        <button
          key={index}
          onClick={() => handleNavigate(index)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition-all hover:scale-105",
            result.isCorrect
              ? colors.correct
              : !result.isAnswered
                ? colors.unanswered
                : colors.incorrect
          )}
        >
          {index + 1}
        </button>
      ))}
    </div>
  )

  // Legend component
  const legend = (
    <div className="space-y-2 border-t border-gray-200/60 pt-4 dark:border-gray-700/60">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
        Légende
      </p>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className={cn("h-3 w-3 rounded", colors.legendCorrect)} />
          <span className="text-gray-600 dark:text-gray-400">
            Correct ({stats.correct})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("h-3 w-3 rounded", colors.legendIncorrect)} />
          <span className="text-gray-600 dark:text-gray-400">
            Incorrect ({stats.incorrect})
          </span>
        </div>
        {stats.unanswered > 0 && (
          <div className="flex items-center gap-2">
            <div className={cn("h-3 w-3 rounded", colors.legendUnanswered)} />
            <span className="text-gray-600 dark:text-gray-400">
              Vide ({stats.unanswered})
            </span>
          </div>
        )}
      </div>
    </div>
  )

  // Desktop variant - sticky sidebar
  if (variant === "desktop") {
    return (
      <div className="sticky top-24 flex max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-gray-700/60 dark:bg-gray-900/80">
        {/* Fixed header */}
        <div className="shrink-0">
          <h3 className="mb-4 font-display text-lg font-semibold text-gray-900 dark:text-white">
            Navigation
          </h3>
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              <span className={cn("font-semibold", colors.accentText)}>
                {stats.correct}
              </span>
              /{questionResults.length} correctes
            </span>
          </div>
        </div>

        {/* Scrollable grid */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {navigationGrid}
        </div>

        {/* Fixed footer */}
        <div className="shrink-0">
          <div className="mt-4">{legend}</div>
          {showTips && (
            <div className={cn("mt-4 rounded-lg p-3", colors.tipBg)}>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                <strong>Astuce :</strong> Cliquez sur un numéro pour accéder directement à la question
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Mobile variant - FAB with scrollable panel
  return (
    <div
      className={cn(
        "fixed z-50",
        position === "left" ? "left-6" : "right-6",
        "bottom-6"
      )}
    >
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="lg"
        className={cn("h-14 w-14 rounded-full shadow-lg", colors.fabButton)}
      >
        <List className="h-6 w-6" />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={cn(
                "fixed z-50 w-72 overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-xl dark:border-gray-700/60 dark:bg-gray-900",
                position === "left" ? "left-6" : "right-6",
                "bottom-24"
              )}
            >
              {/* Header - fixed */}
              <div className="border-b border-gray-200/60 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold text-gray-900 dark:text-white">
                    Navigation
                  </h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Stats */}
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    <span className={cn("font-semibold", colors.accentText)}>
                      {stats.correct}
                    </span>
                    /{questionResults.length} correctes
                  </span>
                </div>
              </div>

              {/* Scrollable grid area */}
              <div className="max-h-[60vh] overflow-y-auto p-4">
                {navigationGrid}
              </div>

              {/* Footer - fixed legend */}
              <div className="border-t border-gray-200/60 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-900">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className={cn("h-2.5 w-2.5 rounded", colors.legendCorrect)} />
                    <span className="text-gray-500 dark:text-gray-400">{stats.correct}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={cn("h-2.5 w-2.5 rounded", colors.legendIncorrect)} />
                    <span className="text-gray-500 dark:text-gray-400">{stats.incorrect}</span>
                  </div>
                  {stats.unanswered > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className={cn("h-2.5 w-2.5 rounded", colors.legendUnanswered)} />
                      <span className="text-gray-500 dark:text-gray-400">{stats.unanswered}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
