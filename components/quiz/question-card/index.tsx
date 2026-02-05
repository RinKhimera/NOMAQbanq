"use client"

import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Flag,
  XCircle,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { QuestionImageGallery } from "@/components/shared/question-image-gallery"
import { cn } from "@/lib/utils"
import { AnswerOption } from "./answer-option"
import {
  QuestionHeader,
  QuestionMetadata,
  createAddAction,
  createDeleteAction,
  createEditAction,
  createPermanentDeleteAction,
  createRemoveAction,
  createViewAction,
} from "./question-actions"
import type { AnswerState, QuestionCardProps } from "./types"

// ===== Re-export action creators for convenience =====
export {
  createViewAction,
  createEditAction,
  createDeleteAction,
  createAddAction,
  createPermanentDeleteAction,
  createRemoveAction,
}
export type { ActionConfig, QuestionCardProps } from "./types"

// ===== Helper Functions =====
const getAnswerState = (
  option: string,
  selectedAnswer: string | null | undefined,
  correctAnswer: string,
  showCorrectAnswer: boolean,
  userAnswer?: string | null,
  isReviewMode?: boolean,
): AnswerState => {
  // Review mode with user answer
  if (isReviewMode && userAnswer !== undefined) {
    const isCorrectAnswer = option === correctAnswer
    const isUserAnswer = option === userAnswer

    if (isCorrectAnswer) return "user-correct"
    if (isUserAnswer && !isCorrectAnswer) return "user-incorrect"
    return "default"
  }

  // Default/admin mode showing correct answer
  if (showCorrectAnswer && option === correctAnswer) {
    return "correct"
  }

  // Exam mode with selection
  if (selectedAnswer !== undefined && option === selectedAnswer) {
    return "selected"
  }

  return "default"
}

// ===== Question Explanation Component =====
type QuestionExplanationProps = {
  explanation: string
  references?: string[]
}

const QuestionExplanation = ({
  explanation,
  references,
}: QuestionExplanationProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="space-y-4 overflow-hidden"
    >
      {/* Explanation */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 backdrop-blur-sm dark:border-blue-800 dark:bg-blue-900/20">
        <h4 className="mb-2 text-sm font-semibold text-blue-900 sm:text-base dark:text-blue-100">
          Explication :
        </h4>
        <p className="text-sm leading-relaxed whitespace-pre-line text-blue-800 dark:text-blue-200">
          {explanation}
        </p>
      </div>

      {/* References */}
      {references && references.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/50">
          <h4 className="mb-3 text-sm font-semibold text-gray-900 sm:text-base dark:text-gray-100">
            Références :
          </h4>
          <div className="space-y-2">
            {references.map((ref, index) => (
              <div
                key={index}
                className="border-l-2 border-blue-400 pl-3 text-sm leading-relaxed text-gray-700 dark:border-blue-500 dark:text-gray-300"
              >
                <span className="mr-2 font-semibold text-blue-600 dark:text-blue-400">
                  {index + 1}.
                </span>
                {ref}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ===== Main QuestionCard Component =====
export const QuestionCard = ({
  question,
  variant = "default",
  selectedAnswer,
  onAnswerSelect,
  disabled = false,
  isFlagged = false,
  onFlagToggle,
  userAnswer,
  isExpanded = false,
  onToggleExpand,
  wasFlagged,
  questionNumber,
  showImage = true,
  showCorrectAnswer = true,
  showDomainBadge = true,
  showObjectifBadge = true,
  truncateQuestion = false,
  actions = [],
  className,
}: QuestionCardProps) => {
  // Determine card styling based on variant and state
  const getCardStyles = () => {
    if (variant === "review") {
      const wasAnswered = userAnswer !== null
      const isCorrect = userAnswer === question.correctAnswer

      if (!wasAnswered) {
        return "bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700"
      } else if (isCorrect) {
        return "bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-800"
      } else {
        return "bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-800"
      }
    }

    return "bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-700"
  }

  // Review status info
  const getReviewStatus = () => {
    const wasAnswered = userAnswer !== null
    const isCorrect = userAnswer === question.correctAnswer

    if (!wasAnswered) {
      return {
        icon: <XCircle className="h-4 w-4 text-gray-400 sm:h-5 sm:w-5" />,
        text: "Non répondu",
        textColor: "text-gray-600 dark:text-gray-400",
      }
    } else if (isCorrect) {
      return {
        icon: (
          <CheckCircle className="h-4 w-4 text-green-600 sm:h-5 sm:w-5 dark:text-green-400" />
        ),
        text: "Correct",
        textColor: "text-green-600 dark:text-green-400",
      }
    } else {
      return {
        icon: (
          <XCircle className="h-4 w-4 text-red-600 sm:h-5 sm:w-5 dark:text-red-400" />
        ),
        text: "Incorrect",
        textColor: "text-red-600 dark:text-red-400",
      }
    }
  }

  const isReviewVariant = variant === "review"
  const isExamVariant = variant === "exam"
  const isDefaultVariant = variant === "default"

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "rounded-2xl border-2 p-4 transition-shadow duration-300 sm:p-5 lg:p-6",
        getCardStyles(),
        isExamVariant && "shadow-lg hover:shadow-xl",
        isDefaultVariant && "hover:shadow-md",
        className,
      )}
      id={isReviewVariant ? `question-${questionNumber}` : undefined}
    >
      {/* Header */}
      {!isReviewVariant && !isExamVariant && (
        <QuestionHeader
          questionNumber={questionNumber}
          domain={question.domain}
          showDomainBadge={showDomainBadge}
          actions={actions}
        />
      )}

      {/* Exam variant header with flag button */}
      {isExamVariant && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {questionNumber !== undefined && (
              <Badge
                variant="outline"
                className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
              >
                Question {questionNumber}
              </Badge>
            )}
            {showDomainBadge && question.domain && (
              <Badge variant="badge">{question.domain}</Badge>
            )}
          </div>

          {/* Flag button for exam mode */}
          {onFlagToggle && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onFlagToggle()
              }}
              aria-label={isFlagged ? "Retirer le marquage de la question" : "Marquer la question pour révision"}
              aria-pressed={isFlagged}
              className={cn(
                "h-8 gap-1.5 px-2 transition-colors",
                isFlagged
                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200 hover:text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
                  : "text-gray-500 hover:bg-gray-100 hover:text-amber-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-amber-400",
              )}
            >
              <Flag
                className={cn(
                  "h-4 w-4",
                  isFlagged && "fill-amber-500 dark:fill-amber-400",
                )}
                aria-hidden="true"
              />
              <span className="hidden text-xs font-medium sm:inline">
                {isFlagged ? "Marquée" : "Marquer"}
              </span>
            </Button>
          )}
        </div>
      )}

      {/* Review variant header with status */}
      {isReviewVariant && (
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {questionNumber !== undefined && (
                  <Badge
                    variant="secondary"
                    className="bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100"
                  >
                    #{questionNumber}
                  </Badge>
                )}
                <Badge
                  variant="secondary"
                  className="bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-200"
                >
                  {question.domain}
                </Badge>
                {wasFlagged && (
                  <Badge
                    variant="secondary"
                    className="bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300"
                  >
                    <Flag className="mr-1 h-3 w-3 fill-amber-500" />
                    Marquée
                  </Badge>
                )}
              </div>
            </div>

            {onToggleExpand && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpand}
                aria-label={isExpanded ? "Réduire la question" : "Développer la question"}
                aria-expanded={isExpanded}
                className="-mt-1 h-8 w-8 flex-shrink-0 p-1"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            )}
          </div>
          <h3 className="text-sm leading-relaxed font-semibold text-gray-900 sm:text-base dark:text-white">
            {question.question}
          </h3>
          {/* Objectif CMC Badge */}
          <Badge
            variant="outline"
            className="w-fit max-w-[320px] border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-200 dark:hover:bg-purple-900/20"
          >
            {question.objectifCMC}
          </Badge>
          <div className="flex items-center gap-2">
            {getReviewStatus().icon}
            <span
              className={cn(
                "text-xs font-medium sm:text-sm",
                getReviewStatus().textColor,
              )}
            >
              {getReviewStatus().text}
            </span>
          </div>
        </div>
      )}

      {/* Question text (for non-review variants) */}
      {!isReviewVariant && (
        <h2
          className={cn(
            "mb-4 leading-relaxed font-semibold text-gray-900 dark:text-white",
            isExamVariant
              ? "text-base sm:text-lg lg:text-xl"
              : "text-sm sm:text-base",
            truncateQuestion || isDefaultVariant ? "line-clamp-3" : "",
          )}
        >
          {question.question}
        </h2>
      )}

      {/* Image(s) */}
      {showImage &&
        question.images?.length &&
        (isExamVariant || (isDefaultVariant && showImage)) && (
          <div className="mb-5">
            <QuestionImageGallery
              images={question.images}
              size="md"
              maxDisplay={4}
            />
          </div>
        )}

      {/* Metadata (objectifCMC, references count) */}
      {isDefaultVariant && (
        <QuestionMetadata
          objectifCMC={question.objectifCMC}
          referencesCount={question.references?.length}
          showObjectifBadge={showObjectifBadge}
        />
      )}

      {/* Answer options */}
      <AnimatePresence mode="wait">
        {(!isReviewVariant || isExpanded) && (
          <motion.div
            initial={isReviewVariant ? { opacity: 0, height: 0 } : false}
            animate={{ opacity: 1, height: "auto" }}
            exit={isReviewVariant ? { opacity: 0, height: 0 } : undefined}
            transition={{ duration: 0.2 }}
            className={cn(
              isExamVariant
                ? "space-y-3"
                : "grid gap-2 sm:grid-cols-2 sm:gap-3",
            )}
          >
            {question.options.map((option, index) => {
              const state = getAnswerState(
                option,
                selectedAnswer,
                question.correctAnswer,
                showCorrectAnswer,
                userAnswer,
                isReviewVariant,
              )

              const isCorrectAnswer = option === question.correctAnswer
              const isUserAnswer = option === userAnswer

              return (
                <AnswerOption
                  key={index}
                  option={option}
                  index={index}
                  state={state}
                  onClick={
                    isExamVariant && onAnswerSelect
                      ? () => onAnswerSelect(index)
                      : undefined
                  }
                  disabled={disabled}
                  showCheckIcon={
                    (isReviewVariant && isCorrectAnswer) ||
                    (isDefaultVariant && showCorrectAnswer && isCorrectAnswer)
                  }
                  showXIcon={
                    isReviewVariant && isUserAnswer && !isCorrectAnswer
                  }
                  compact={isDefaultVariant}
                />
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Explanation and references (for review variant when expanded) */}
      <AnimatePresence>
        {isReviewVariant && isExpanded && (
          <div className="mt-4">
            <QuestionExplanation
              explanation={question.explanation}
              references={question.references}
            />
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default QuestionCard
