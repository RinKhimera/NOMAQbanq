"use client"

import { CheckCircle, ChevronDown, ChevronUp, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Doc } from "@/convex/_generated/dataModel"

interface QuestionReviewProps {
  question: Doc<"questions">
  userAnswer: string | null
  questionNumber: number
  isExpanded: boolean
  onToggleExpand: () => void
}

export default function QuestionReview({
  question,
  userAnswer,
  questionNumber,
  isExpanded,
  onToggleExpand,
}: QuestionReviewProps) {
  const isCorrect = userAnswer === question.correctAnswer
  const wasAnswered = userAnswer !== null

  const getStatusInfo = () => {
    if (!wasAnswered) {
      return {
        icon: <XCircle className="h-4 w-4 text-gray-400 sm:h-5 sm:w-5" />,
        text: "Non répondu",
        bgColor: "bg-gray-50 dark:bg-gray-800",
        borderColor: "border-gray-200 dark:border-gray-700",
      }
    } else if (isCorrect) {
      return {
        icon: <CheckCircle className="h-4 w-4 text-green-600 sm:h-5 sm:w-5" />,
        text: "Correct",
        bgColor: "bg-green-50 dark:bg-green-900/20",
        borderColor: "border-green-200 dark:border-green-800",
      }
    } else {
      return {
        icon: <XCircle className="h-4 w-4 text-red-600 sm:h-5 sm:w-5" />,
        text: "Incorrect",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        borderColor: "border-red-200 dark:border-red-800",
      }
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <Card
      id={`question-${questionNumber}`}
      className={`card-modern mb-4 transition-all duration-200 sm:mb-6 ${statusInfo.bgColor} ${statusInfo.borderColor}`}
    >
      <CardContent className="p-3 sm:p-6">
        {/* Header avec toggle - Mobile optimized */}
        <div className="mb-3 flex items-start justify-between sm:mb-4">
          <div className="flex flex-1 items-start space-x-2 pr-1 sm:space-x-3 sm:pr-2">
            <div className="flex-shrink-0">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold sm:h-8 sm:w-8 sm:text-sm dark:bg-gray-700">
                {questionNumber}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="mb-2 text-sm leading-relaxed font-semibold break-words text-gray-900 sm:text-base dark:text-white">
                {question.question}
              </h3>
              <div className="flex items-center space-x-2">
                {statusInfo.icon}
                <span
                  className={`text-xs font-medium sm:text-sm ${
                    !wasAnswered
                      ? "text-gray-600 dark:text-gray-400"
                      : isCorrect
                        ? "text-green-600"
                        : "text-red-600"
                  }`}
                >
                  {statusInfo.text}
                </span>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
            className="h-7 w-7 flex-shrink-0 p-1 sm:h-8 sm:w-8 sm:p-2"
          >
            {isExpanded ? (
              <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" />
            ) : (
              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
            )}
          </Button>
        </div>

        {/* Contenu collapsible */}
        {isExpanded && (
          <div className="animate-in slide-in-from-top-2 space-y-3 duration-200 sm:space-y-4">
            {/* Options avec feedback visuel */}
            <div className="space-y-2">
              {question.options.map((option, index) => {
                const isCorrectAnswer = option === question.correctAnswer
                const isUserAnswer = option === userAnswer

                let optionClass =
                  "p-2 sm:p-3 rounded-lg border text-xs sm:text-sm transition-all duration-200 "

                if (isCorrectAnswer) {
                  optionClass +=
                    "bg-green-100 border-green-400 text-green-800 dark:bg-green-900/30 dark:border-green-600 dark:text-green-300"
                } else if (isUserAnswer && !isCorrectAnswer) {
                  optionClass +=
                    "bg-red-100 border-red-400 text-red-800 dark:bg-red-900/30 dark:border-red-600 dark:text-red-300"
                } else {
                  optionClass +=
                    "bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
                }

                return (
                  <div key={index} className={optionClass}>
                    <div className="flex items-start space-x-2">
                      <span className="flex-shrink-0 font-semibold">
                        {String.fromCharCode(65 + index)}.
                      </span>
                      <span className="flex-1 break-words">{option}</span>
                      {isCorrectAnswer && (
                        <CheckCircle className="h-3 w-3 flex-shrink-0 text-green-600 sm:h-4 sm:w-4" />
                      )}
                      {isUserAnswer && !isCorrectAnswer && (
                        <XCircle className="h-3 w-3 flex-shrink-0 text-red-600 sm:h-4 sm:w-4" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Explication */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 sm:p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <h4 className="mb-2 text-sm font-semibold text-blue-900 sm:text-base dark:text-blue-100">
                Explication :
              </h4>
              <div className="text-xs leading-relaxed break-words whitespace-pre-line text-blue-800 sm:text-sm dark:text-blue-200">
                {question.explanation}
              </div>
            </div>

            {/* Références */}
            {question.references && question.references.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4 dark:border-gray-800 dark:bg-gray-900/20">
                <h4 className="mb-3 text-sm font-semibold text-gray-900 sm:text-base dark:text-gray-100">
                  Références :
                </h4>
                <div className="space-y-2 sm:space-y-3">
                  {question.references.map((ref: string, index: number) => (
                    <div
                      key={index}
                      className="border-l-2 border-gray-300 pl-2 text-xs leading-relaxed break-words whitespace-pre-line text-gray-700 sm:pl-3 sm:text-sm dark:border-gray-600 dark:text-gray-300"
                    >
                      <span className="mr-1 font-semibold text-blue-600 sm:mr-2">
                        {index + 1}.
                      </span>
                      {ref}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
