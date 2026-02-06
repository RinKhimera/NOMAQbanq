"use client"

import { Timer } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface QuizProgressProps {
  currentQuestion: number
  totalQuestions: number
  timeRemaining: number
  domain: string
  objectifCMC: string
}

export default function QuizProgress({
  currentQuestion,
  totalQuestions,
  timeRemaining,
  domain,
  objectifCMC,
}: QuizProgressProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const progress = ((currentQuestion + 1) / totalQuestions) * 100

  return (
    <div className="mb-6 sm:mb-8">
      <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="w-fit px-2 py-1 text-xs sm:px-3 sm:text-sm"
          >
            Question {currentQuestion + 1} sur {totalQuestions}
          </Badge>
          <Badge className="w-fit bg-linear-to-r from-purple-500 to-pink-500 px-2 py-1 text-xs text-white capitalize sm:px-3 sm:text-sm">
            {domain}
          </Badge>
          <Badge
            variant="outline"
            className="w-fit border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 sm:px-3 sm:text-sm dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
          >
            {objectifCMC}
          </Badge>
        </div>
        <div className="flex items-center space-x-2 text-base font-semibold sm:text-lg">
          <Timer className="h-4 w-4 sm:h-5 sm:w-5" />
          <span
            className={
              timeRemaining <= 30
                ? "text-red-600"
                : "text-gray-700 dark:text-gray-300"
            }
          >
            {formatTime(timeRemaining)}
          </span>
        </div>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  )
}
