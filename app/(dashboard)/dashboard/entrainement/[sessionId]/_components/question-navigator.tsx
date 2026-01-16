"use client"

import { useState, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { List, Flag, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface QuestionNavigatorProps {
  questions: Array<{ _id: { toString(): string } }>
  answers: Record<string, { selectedAnswer: string; isCorrect?: boolean }>
  flaggedQuestions: Set<string>
  currentIndex: number
  onNavigate: (index: number) => void
  variant?: "desktop" | "mobile"
}

export const QuestionNavigator = ({
  questions,
  answers,
  flaggedQuestions,
  currentIndex,
  onNavigate,
  variant = "desktop",
}: QuestionNavigatorProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false)

  const answeredCount = Object.keys(answers).length
  const flaggedCount = flaggedQuestions.size

  const getQuestionState = useCallback(
    (index: number) => {
      const question = questions[index]
      if (!question) return null

      const questionIdStr = question._id.toString()
      const isAnswered = !!answers[questionIdStr]
      const isFlagged = flaggedQuestions.has(questionIdStr)
      const isCurrent = index === currentIndex

      return { isAnswered, isFlagged, isCurrent }
    },
    [questions, answers, flaggedQuestions, currentIndex]
  )

  const filteredIndices = useMemo(
    () =>
      showFlaggedOnly
        ? questions
            .map((q, i) => ({ index: i, id: q._id }))
            .filter(({ id }) => flaggedQuestions.has(id.toString()))
            .map(({ index }) => index)
        : questions.map((_, i) => i),
    [questions, flaggedQuestions, showFlaggedOnly]
  )

  const handleNavigate = useCallback(
    (index: number, closeOnMobile = false) => {
      onNavigate(index)
      if (closeOnMobile && variant === "mobile") {
        setIsOpen(false)
      }
    },
    [onNavigate, variant]
  )

  // Shared content between desktop and mobile
  const navigatorContent = (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {answeredCount}
          </span>
          /{questions.length} répondues
        </span>
        {flaggedCount > 0 && (
          <button
            onClick={() => setShowFlaggedOnly(!showFlaggedOnly)}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              showFlaggedOnly
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            )}
          >
            <Flag
              className={cn("h-3 w-3", showFlaggedOnly && "fill-amber-500")}
            />
            {flaggedCount}
          </button>
        )}
      </div>

      {/* Grid */}
      <div
        className={cn(
          "grid gap-1.5",
          questions.length > 15 ? "grid-cols-6" : "grid-cols-5"
        )}
      >
        {filteredIndices.map((index) => {
          const state = getQuestionState(index)
          if (!state) return null

          const { isAnswered, isFlagged, isCurrent } = state

          return (
            <button
              key={index}
              onClick={() => handleNavigate(index, true)}
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition-all",
                isCurrent &&
                  "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-gray-900",
                isAnswered
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              )}
            >
              {index + 1}
              {isFlagged && (
                <Flag className="absolute -right-0.5 -top-0.5 h-3 w-3 fill-amber-500 text-amber-500" />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="space-y-2 border-t border-gray-200/60 pt-4 dark:border-gray-700/60">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Légende
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-emerald-100 dark:bg-emerald-900/40" />
            <span className="text-gray-600 dark:text-gray-400">Répondue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-gray-100 dark:bg-gray-800" />
            <span className="text-gray-600 dark:text-gray-400">
              Non répondue
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative h-3 w-3 rounded bg-gray-100 dark:bg-gray-800">
              <Flag className="absolute -right-0.5 -top-0.5 h-2 w-2 fill-amber-500 text-amber-500" />
            </div>
            <span className="text-gray-600 dark:text-gray-400">Marquée</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-gray-100 ring-2 ring-emerald-500 dark:bg-gray-800" />
            <span className="text-gray-600 dark:text-gray-400">Actuelle</span>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <strong>Astuce :</strong> Utilisez les flèches ← → pour naviguer, F
          pour marquer
        </p>
      </div>
    </div>
  )

  // Desktop variant
  if (variant === "desktop") {
    return (
      <div className="sticky top-24 overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-gray-700/60 dark:bg-gray-900/80">
        <h3 className="mb-4 font-display text-lg font-semibold text-gray-900 dark:text-white">
          Navigation
        </h3>
        {navigatorContent}
      </div>
    )
  }

  // Mobile variant - FAB with dropdown
  return (
    <>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="lg"
        className="h-14 w-14 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 shadow-lg shadow-emerald-500/30 hover:from-emerald-700 hover:to-teal-700"
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
              className="fixed bottom-24 right-6 z-50 w-72 overflow-hidden rounded-2xl border border-gray-200/60 bg-white p-5 shadow-xl dark:border-gray-700/60 dark:bg-gray-900"
            >
              <div className="mb-4 flex items-center justify-between">
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
              {navigatorContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
