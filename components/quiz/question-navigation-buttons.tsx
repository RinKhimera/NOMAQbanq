"use client"

import { ArrowUp, List } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type QuestionResult = {
  isCorrect?: boolean
  isAnswered: boolean
}

type QuestionNavigationButtonsProps = {
  questionResults?: QuestionResult[]
  onNavigateToQuestion?: (index: number) => void
  showNavButton?: boolean
  variant?: "exam" | "review"
  currentQuestionIndex?: number
}

export const QuestionNavigationButtons = ({
  questionResults,
  onNavigateToQuestion,
  showNavButton = true,
  variant = "review",
  currentQuestionIndex,
}: QuestionNavigationButtonsProps) => {
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [isNavOpen, setIsNavOpen] = useState(false)

  // Track scroll position to show/hide scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400)
    }

    handleScroll()

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const canShowNav =
    showNavButton &&
    questionResults &&
    questionResults.length > 0 &&
    onNavigateToQuestion

  // Determine badge styling based on variant and state
  const getBadgeStyle = (result: QuestionResult, index: number) => {
    if (variant === "exam") {
      // Exam mode: highlight current question, show answered/unanswered
      const isCurrent = index === currentQuestionIndex
      if (isCurrent) {
        return "bg-blue-600 text-white"
      }
      return result.isAnswered
        ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
        : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
    }

    // Review mode: correct/incorrect/unanswered
    return result.isCorrect
      ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
      : result.isAnswered
        ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
        : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400"
  }

  return (
    <div
      className={cn(
        "fixed right-4 bottom-6 z-50 flex flex-col items-end gap-3",
        "touch-none",
      )}
    >
      {/* Scroll to top button - only visible after scrolling */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <Button
              size="lg"
              onClick={scrollToTop}
              className="h-12 w-12 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 shadow-lg hover:from-gray-700 hover:to-gray-900 dark:from-gray-500 dark:to-gray-700 dark:hover:from-gray-400 dark:hover:to-gray-600"
              aria-label="Retourner en haut de page"
            >
              <ArrowUp className="h-5 w-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation button with dropdown (mobile-first) */}
      {canShowNav && (
        <div className="lg:hidden">
          <DropdownMenu open={isNavOpen} onOpenChange={setIsNavOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                size="lg"
                className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 shadow-xl hover:from-blue-700 hover:to-indigo-700"
                aria-label="Ouvrir la navigation des questions"
              >
                <List className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={8}
              className="max-h-[60vh] w-72 overflow-y-auto p-3"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <div className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Aller à la question
              </div>
              <div className="grid grid-cols-6 gap-2">
                {questionResults?.map((result, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => {
                      onNavigateToQuestion?.(index)
                      setIsNavOpen(false)
                    }}
                    className={cn(
                      "flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg p-0 text-sm font-medium transition-colors",
                      getBadgeStyle(result, index),
                    )}
                  >
                    {index + 1}
                  </DropdownMenuItem>
                ))}
              </div>

              {variant === "review" && (
                <div className="mt-4 space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                    <span>Correct</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    <span>Incorrect</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <div className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                    <span>Sans réponse</span>
                  </div>
                </div>
              )}

              {variant === "exam" && (
                <div className="mt-4 space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <span>Question actuelle</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                    <span>Répondu</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <div className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                    <span>Non répondu</span>
                  </div>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}
