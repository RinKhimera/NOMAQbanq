"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { CheckCircle, Clock, Pause } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { formatExamTime } from "@/lib/exam-timer"
import type { SessionHeaderProps } from "./types"
import { accentColors } from "./types"

export const SessionHeader = ({
  config,
  currentIndex,
  totalQuestions,
  answeredCount,
  onFinish,
  title,
  icon,
  backUrl,
  examActions,
}: SessionHeaderProps) => {
  const progressPercent = (answeredCount / totalQuestions) * 100
  const colors = accentColors[config.accentColor ?? "emerald"]

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-50 border-b border-gray-200/60 bg-white/80 backdrop-blur-xl dark:border-gray-700/60 dark:bg-gray-900/80"
    >
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Left - Logo and title */}
          <Link
            href={backUrl}
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl shadow-md",
                config.accentColor === "blue"
                  ? "bg-gradient-to-br from-blue-500 to-indigo-600"
                  : "bg-gradient-to-br from-emerald-500 to-teal-600"
              )}
            >
              {icon}
            </div>
            <span className="hidden font-display text-lg font-semibold text-gray-900 sm:block dark:text-white">
              {title}
            </span>
          </Link>

          {/* Center - Progress & Timer */}
          <div className="flex flex-1 items-center justify-center gap-4">
            {/* Timer (exam only) */}
            {config.showTimer && config.timeRemaining !== undefined && (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-1.5 font-mono text-sm font-semibold shadow-sm transition-all",
                  config.isTimeCritical
                    ? "animate-pulse border-2 border-red-400 bg-red-100 text-red-700 dark:border-red-500 dark:bg-red-900/30 dark:text-red-300"
                    : config.isTimeRunningOut
                      ? "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      : "border border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                )}
              >
                <Clock className="h-4 w-4" />
                <span>{formatExamTime(config.timeRemaining)}</span>
              </div>
            )}

            {/* Question badge */}
            <Badge variant="outline" className={colors.badge}>
              Question {currentIndex + 1} / {totalQuestions}
            </Badge>

            {/* Progress bar */}
            <div className="hidden w-32 items-center gap-2 sm:flex md:w-48">
              <Progress
                value={progressPercent}
                className={cn(
                  "h-2",
                  config.accentColor === "blue"
                    ? "[&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:to-indigo-500"
                    : "[&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-teal-500"
                )}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {answeredCount}/{totalQuestions}
              </span>
            </div>
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-2">
            {/* Pause button (exam only) */}
            {examActions?.canTakePause && examActions?.onTakePause && (
              <Button
                onClick={examActions.onTakePause}
                variant="outline"
                size="sm"
                className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/30"
              >
                <Pause className="h-4 w-4" />
                <span className="hidden sm:inline">Pause</span>
              </Button>
            )}

            {/* Finish button */}
            <Button
              onClick={onFinish}
              size="sm"
              className={cn(
                "gap-2 shadow-md",
                config.accentColor === "blue"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              )}
            >
              <CheckCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Terminer</span>
            </Button>
          </div>
        </div>
      </div>
    </motion.header>
  )
}
