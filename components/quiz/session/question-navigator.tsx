"use client"

import { useState, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { List, Flag, X, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { QuestionNavigatorProps } from "./types"
import { accentColors } from "./types"

export const QuestionNavigator = ({
  questions,
  answers,
  flaggedQuestions,
  currentIndex,
  onNavigate,
  variant = "desktop",
  isQuestionLocked,
  accentColor = "emerald",
}: QuestionNavigatorProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false)

  const colors = accentColors[accentColor]
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
      const isLocked = isQuestionLocked?.(index) ?? false

      return { isAnswered, isFlagged, isCurrent, isLocked }
    },
    [questions, answers, flaggedQuestions, currentIndex, isQuestionLocked]
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
      const state = getQuestionState(index)
      if (state?.isLocked) return

      onNavigate(index)
      if (closeOnMobile && variant === "mobile") {
        setIsOpen(false)
      }
    },
    [onNavigate, variant, getQuestionState]
  )

  // Stats section - shared between desktop and mobile
  const statsSection = (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600 dark:text-gray-400">
        <span className={cn("font-semibold", accentColor === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400")}>
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
              ? colors.flagFilter
              : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          )}
        >
          <Flag className={cn("h-3 w-3", showFlaggedOnly && "fill-amber-500")} />
          {flaggedCount}
        </button>
      )}
    </div>
  )

  // Grid section - scrollable on mobile
  const gridSection = (
    <div
      className={cn(
        "grid gap-1.5",
        questions.length > 15 ? "grid-cols-6" : "grid-cols-5"
      )}
    >
      {filteredIndices.map((index) => {
        const state = getQuestionState(index)
        if (!state) return null

        const { isAnswered, isFlagged, isCurrent, isLocked } = state

        return (
          <button
            key={index}
            onClick={() => handleNavigate(index, true)}
            disabled={isLocked}
            className={cn(
              "relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-xs font-medium transition-all",
              isCurrent && `ring-2 ${colors.ring} ${colors.ringOffset} dark:ring-offset-gray-900`,
              isLocked
                ? "cursor-not-allowed bg-gray-200 text-gray-400 opacity-60 dark:bg-gray-700 dark:text-gray-500"
                : isAnswered
                  ? colors.answered
                  : colors.unanswered
            )}
          >
            {isLocked ? (
              <Lock className="h-3.5 w-3.5" />
            ) : (
              index + 1
            )}
            {isFlagged && !isLocked && (
              <Flag className="absolute -right-0.5 -top-0.5 h-3 w-3 fill-amber-500 text-amber-500" />
            )}
          </button>
        )
      })}
    </div>
  )

  // Legend section - shared between desktop and mobile
  const legendSection = (
    <div className="space-y-2 border-t border-gray-200/60 pt-4 dark:border-gray-700/60">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
        Légende
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className={cn("h-3 w-3 rounded", accentColor === "emerald" ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-green-100 dark:bg-green-900/40")} />
          <span className="text-gray-600 dark:text-gray-400">Répondue</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-gray-100 dark:bg-gray-800" />
          <span className="text-gray-600 dark:text-gray-400">Non répondue</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative h-3 w-3 rounded bg-gray-100 dark:bg-gray-800">
            <Flag className="absolute -right-0.5 -top-0.5 h-2 w-2 fill-amber-500 text-amber-500" />
          </div>
          <span className="text-gray-600 dark:text-gray-400">Marquée</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("h-3 w-3 rounded bg-gray-100 ring-2 dark:bg-gray-800", colors.ring)} />
          <span className="text-gray-600 dark:text-gray-400">Actuelle</span>
        </div>
        {isQuestionLocked && (
          <div className="flex items-center gap-2">
            <div className="flex h-3 w-3 items-center justify-center rounded bg-gray-200 dark:bg-gray-700">
              <Lock className="h-2 w-2 text-gray-400" />
            </div>
            <span className="text-gray-600 dark:text-gray-400">Verrouillée</span>
          </div>
        )}
      </div>
    </div>
  )

  // Tips section
  const tipsSection = (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        <strong>Astuce :</strong> Utilisez les flèches ← → pour naviguer, F pour marquer
      </p>
    </div>
  )

  // Desktop variant
  if (variant === "desktop") {
    return (
      <div className="sticky top-24 flex max-h-[calc(100vh-8rem)] flex-col overflow-clip rounded-2xl border border-gray-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-gray-700/60 dark:bg-gray-900/80">
        {/* Fixed header */}
        <div className="shrink-0">
          <h3 className="mb-4 font-display text-lg font-semibold text-gray-900 dark:text-white">
            Navigation
          </h3>
          {statsSection}
        </div>

        {/* Scrollable grid */}
        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
          {gridSection}
        </div>

        {/* Fixed footer */}
        <div className="shrink-0">
          {legendSection}
          <div className="mt-3">{tipsSection}</div>
        </div>
      </div>
    )
  }

  // Mobile variant - FAB with dropdown
  return (
    <>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="lg"
        className={cn(
          "h-12 w-12 rounded-full shadow-lg",
          accentColor === "emerald"
            ? "bg-linear-to-r from-emerald-600 to-teal-600 shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700"
            : "bg-linear-to-r from-blue-600 to-indigo-600 shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700"
        )}
      >
        <List className="h-5 w-5" />
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              className="fixed bottom-68 right-6 z-50 w-72 overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-xl dark:border-gray-700/60 dark:bg-gray-900"
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
                <div className="mt-2">{statsSection}</div>
              </div>

              {/* Scrollable grid area */}
              <div className="max-h-[50vh] overflow-y-auto p-4">
                {gridSection}
              </div>

              {/* Footer - fixed legend */}
              <div className="border-t border-gray-200/60 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-900">
                {legendSection}
                <div className="mt-3">{tipsSection}</div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
