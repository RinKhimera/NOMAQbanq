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
        icon: <XCircle className="h-5 w-5 text-gray-400" />,
        text: "Non répondu",
        bgColor: "bg-gray-50 dark:bg-gray-800",
        borderColor: "border-gray-200 dark:border-gray-700",
      }
    } else if (isCorrect) {
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-600" />,
        text: "Correct",
        bgColor: "bg-green-50 dark:bg-green-900/20",
        borderColor: "border-green-200 dark:border-green-800",
      }
    } else {
      return {
        icon: <XCircle className="h-5 w-5 text-red-600" />,
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
      className={`card-modern mb-6 transition-all duration-200 ${statusInfo.bgColor} ${statusInfo.borderColor}`}
    >
      <CardContent className="p-6">
        {/* Header avec toggle */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex flex-1 items-start space-x-3">
            <div className="flex-shrink-0">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold dark:bg-gray-700">
                {questionNumber}
              </span>
            </div>
            <div className="flex-1">
              <h3 className="mb-2 leading-relaxed font-semibold text-gray-900 dark:text-white">
                {question.question}
              </h3>
              <div className="flex items-center space-x-2">
                {statusInfo.icon}
                <span
                  className={`font-medium ${
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
            className="ml-2 h-8 w-8 p-2"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Contenu collapsible */}
        {isExpanded && (
          <div className="animate-in slide-in-from-top-2 space-y-4 duration-200">
            {/* Options avec feedback visuel */}
            <div className="space-y-2">
              {question.options.map((option, index) => {
                const isCorrectAnswer = option === question.correctAnswer
                const isUserAnswer = option === userAnswer

                let optionClass =
                  "p-3 rounded-lg border text-sm transition-all duration-200 "

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
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold">
                        {String.fromCharCode(65 + index)}.
                      </span>
                      <span className="flex-1">{option}</span>
                      {isCorrectAnswer && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      {isUserAnswer && !isCorrectAnswer && (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Explication */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <h4 className="mb-2 font-semibold text-blue-900 dark:text-blue-100">
                Explication :
              </h4>
              <p className="text-sm leading-relaxed whitespace-pre-line text-blue-800 dark:text-blue-200">
                {question.explanation}
              </p>
            </div>

            {/* Références */}
            {question.references && question.references.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/20">
                <h4 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">
                  Références :
                </h4>
                <div className="space-y-3">
                  {question.references.map((ref: string, index: number) => (
                    <div
                      key={index}
                      className="border-l-2 border-gray-300 pl-3 text-sm leading-relaxed whitespace-pre-line text-gray-700 dark:border-gray-600 dark:text-gray-300"
                    >
                      <span className="mr-2 font-semibold text-blue-600">
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
