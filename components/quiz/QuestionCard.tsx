"use client"

import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Doc } from "@/convex/_generated/dataModel"

interface QuestionCardProps {
  question: Doc<"questions">
  selectedAnswer: string | null
  onAnswerSelect: (answerIndex: number) => void
  disabled?: boolean
}

export default function QuestionCard({
  question,
  selectedAnswer,
  onAnswerSelect,
  disabled = false,
}: QuestionCardProps) {
  return (
    <Card className="card-modern mb-6 sm:mb-8">
      <CardContent className="p-4 sm:p-6 lg:p-8">
        {question.imageSrc && question.imageSrc.trim() !== "" && (
          <div className="mb-4 overflow-hidden rounded-xl sm:mb-6">
            <Image
              src={question.imageSrc}
              alt="Question illustration"
              width={800}
              height={256}
              className="h-48 w-full object-cover sm:h-64"
            />
          </div>
        )}
        <h2 className="mb-4 text-base leading-relaxed font-semibold text-gray-900 sm:mb-6 sm:text-xl dark:text-white">
          {question.question}
        </h2>

        <div className="space-y-3">
          {question.options.map((option, index) => {
            let buttonClass =
              "w-full p-3 sm:p-4 text-left rounded-xl border-2 transition-all duration-200 text-sm sm:text-base"

            const isSelected = option === selectedAnswer

            if (isSelected) {
              buttonClass +=
                " bg-blue-100 border-blue-400 text-blue-800 dark:bg-blue-900/20 dark:border-blue-600 dark:text-blue-300"
            } else {
              buttonClass +=
                " bg-white border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
            }

            return (
              <button
                key={index}
                onClick={() => !disabled && onAnswerSelect(index)}
                disabled={disabled}
                className={buttonClass}
              >
                <div className="flex items-center space-x-3">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold dark:bg-gray-700">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="flex-1">{option}</span>
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
