"use client"

import { CheckCircle, XCircle } from "lucide-react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import type { AnswerOptionProps, AnswerState } from "./types"

const stateStyles: Record<AnswerState, string> = {
  default:
    "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50",
  selected:
    "bg-blue-50 border-blue-400 text-blue-800 ring-2 ring-blue-400/20 dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-200",
  correct:
    "bg-green-50 border-green-400 text-green-800 dark:bg-green-900/30 dark:border-green-500 dark:text-green-200",
  incorrect:
    "bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300",
  "user-correct":
    "bg-green-100 border-green-500 text-green-800 dark:bg-green-900/40 dark:border-green-400 dark:text-green-200",
  "user-incorrect":
    "bg-red-100 border-red-500 text-red-800 dark:bg-red-900/40 dark:border-red-400 dark:text-red-200",
}

const badgeStyles: Record<AnswerState, string> = {
  default: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  selected: "bg-blue-200 text-blue-800 dark:bg-blue-700 dark:text-blue-100",
  correct: "bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100",
  incorrect: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  "user-correct":
    "bg-green-300 text-green-900 dark:bg-green-600 dark:text-green-100",
  "user-incorrect": "bg-red-300 text-red-900 dark:bg-red-600 dark:text-red-100",
}

export const AnswerOption = ({
  option,
  index,
  state,
  onClick,
  disabled = false,
  showCheckIcon = false,
  showXIcon = false,
  compact = false,
}: AnswerOptionProps) => {
  const letter = String.fromCharCode(65 + index)
  const isInteractive = onClick && !disabled

  const content = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border-2 transition-all duration-200",
        compact ? "p-2.5 text-sm" : "p-3.5 sm:p-4",
        stateStyles[state],
        isInteractive && "cursor-pointer",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {/* Letter badge */}
      <span
        className={cn(
          "flex flex-shrink-0 items-center justify-center rounded-full font-semibold",
          compact ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm",
          badgeStyles[state],
        )}
      >
        {letter}
      </span>

      {/* Option text */}
      <span
        className={cn(
          "min-w-0 flex-1 leading-relaxed",
          compact ? "line-clamp-2" : "",
          state === "correct" || state === "user-correct"
            ? "font-medium"
            : "font-normal",
        )}
      >
        {option}
      </span>

      {/* Status icons */}
      {showCheckIcon && (
        <CheckCircle
          className={cn(
            "flex-shrink-0 text-green-600 dark:text-green-400",
            compact ? "h-4 w-4" : "h-5 w-5",
          )}
          aria-hidden="true"
        />
      )}
      {showXIcon && (
        <XCircle
          className={cn(
            "flex-shrink-0 text-red-600 dark:text-red-400",
            compact ? "h-4 w-4" : "h-5 w-5",
          )}
          aria-hidden="true"
        />
      )}
    </div>
  )

  if (isInteractive) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        disabled={disabled}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="w-full text-left"
      >
        {content}
      </motion.button>
    )
  }

  return content
}

export default AnswerOption
