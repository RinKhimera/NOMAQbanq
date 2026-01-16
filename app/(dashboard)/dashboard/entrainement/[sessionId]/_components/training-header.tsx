"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { Brain, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface TrainingHeaderProps {
  currentIndex: number
  totalQuestions: number
  answeredCount: number
  onFinish: () => void
}

export const TrainingHeader = ({
  currentIndex,
  totalQuestions,
  answeredCount,
  onFinish,
}: TrainingHeaderProps) => {
  const progressPercent = (answeredCount / totalQuestions) * 100

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
            href="/dashboard/entrainement"
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="hidden font-display text-lg font-semibold text-gray-900 sm:block dark:text-white">
              Entraînement
            </span>
          </Link>

          {/* Center - Progress */}
          <div className="flex flex-1 items-center justify-center gap-4">
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
            >
              Question {currentIndex + 1} / {totalQuestions}
            </Badge>

            <div className="hidden w-32 items-center gap-2 sm:flex md:w-48">
              <Progress
                value={progressPercent}
                className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-teal-500"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {answeredCount}/{totalQuestions}
              </span>
            </div>
          </div>

          {/* Right - Finish button */}
          <Button
            onClick={onFinish}
            size="sm"
            className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md hover:from-emerald-700 hover:to-teal-700"
          >
            <CheckCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Terminer</span>
          </Button>
        </div>
      </div>
    </motion.header>
  )
}
