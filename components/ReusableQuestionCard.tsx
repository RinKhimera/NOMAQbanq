"use client"

import {
  CheckCircle,
  Eye,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Doc } from "@/convex/_generated/dataModel"

type QuestionAction =
  | "view"
  | "edit"
  | "delete"
  | "add"
  | "remove"
  | "permanent-delete"

type ActionConfig = {
  type: QuestionAction
  label: string
  icon: React.ReactNode
  variant?: "default" | "destructive"
  onClick: () => void
}

type ReusableQuestionCardProps = {
  question: Doc<"questions">
  actions?: ActionConfig[]
  showCorrectAnswer?: boolean
  showImage?: boolean
  questionNumber?: number
}

const ReusableQuestionCard = ({
  question,
  actions = [],
  showCorrectAnswer = true,
  showImage = false,
  questionNumber,
}: ReusableQuestionCardProps) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 transition-all duration-200 dark:border-gray-700 dark:bg-gray-900">
      {/* Header avec badge et actions */}
      <div className="mb-2 flex items-end justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {questionNumber !== undefined && (
            <Badge variant="outline">Question {questionNumber}</Badge>
          )}
          <Badge variant="badge">{question.domain}</Badge>
        </div>

        {actions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {actions.map((action, index) => {
                const isDestructive = action.variant === "destructive"
                const showSeparator =
                  index < actions.length - 1 &&
                  actions[index + 1]?.variant === "destructive" &&
                  !isDestructive

                return (
                  <div key={action.type}>
                    <DropdownMenuItem
                      onClick={action.onClick}
                      className={
                        isDestructive
                          ? "text-red-600 focus:text-red-600 dark:text-red-400"
                          : ""
                      }
                    >
                      <span className="mr-2">{action.icon}</span>
                      {action.label}
                    </DropdownMenuItem>
                    {showSeparator && <DropdownMenuSeparator />}
                  </div>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Image (optionnelle) */}
      {showImage && question.imageSrc && question.imageSrc.trim() !== "" && (
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

      {/* Question */}
      <h2 className="mb-2 line-clamp-5 text-sm leading-relaxed font-medium text-gray-900 @lg:line-clamp-3 dark:text-white">
        {question.question}
      </h2>

      {/* Métadonnées (objectif CMC et références) */}
      {question.objectifCMC && (
        <div className="mb-2 flex flex-col gap-2 text-sm text-gray-600 @[400px]:flex-row @[400px]:items-center @[400px]:justify-between dark:text-gray-300">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <Badge variant="outline" className="max-w-[400px]">
              {question.objectifCMC}
            </Badge>
          </div>

          {question.references && question.references.length > 0 && (
            <div className="flex flex-shrink-0 items-center gap-1">
              <Eye className="h-4 w-4" />
              <Badge variant="outline" className="whitespace-nowrap">
                {question.references.length} réf.
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Options de réponse - Grille 2 colonnes */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {question.options.map((option, index) => {
          const isCorrect = option === question.correctAnswer
          const showAsCorrect = showCorrectAnswer && isCorrect

          return (
            <div
              key={index}
              className={`flex items-center gap-1.5 rounded-lg border-2 p-2 text-xs transition-all duration-200 sm:p-2.5 sm:text-sm ${
                showAsCorrect
                  ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                  : "border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800"
              }`}
            >
              <span
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  showAsCorrect
                    ? "bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100"
                    : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                }`}
              >
                {String.fromCharCode(65 + index)}
              </span>
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <span
                  className={`line-clamp-2 flex-1 ${showAsCorrect ? "font-medium text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"}`}
                >
                  {option}
                </span>
                {showAsCorrect && (
                  <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-green-600 dark:text-green-400" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Composants helper pour créer facilement les actions communes
export const createViewAction = (onClick: () => void): ActionConfig => ({
  type: "view",
  label: "Voir les détails",
  icon: <Eye className="h-4 w-4" />,
  onClick,
})

export const createEditAction = (onClick: () => void): ActionConfig => ({
  type: "edit",
  label: "Modifier",
  icon: <Pencil className="h-4 w-4" />,
  onClick,
})

export const createDeleteAction = (onClick: () => void): ActionConfig => ({
  type: "delete",
  label: "Retirer de la banque",
  icon: <Trash2 className="h-4 w-4" />,
  variant: "destructive",
  onClick,
})

export const createAddAction = (onClick: () => void): ActionConfig => ({
  type: "add",
  label: "Ajouter à la banque",
  icon: <Plus className="h-4 w-4" />,
  onClick,
})

export const createPermanentDeleteAction = (
  onClick: () => void,
): ActionConfig => ({
  type: "permanent-delete",
  label: "Supprimer définitivement",
  icon: <Trash2 className="h-4 w-4" />,
  variant: "destructive",
  onClick,
})

export const createRemoveAction = (onClick: () => void): ActionConfig => ({
  type: "remove",
  label: "Retirer de l'examen",
  icon: <Trash2 className="h-4 w-4" />,
  variant: "destructive",
  onClick,
})

export default ReusableQuestionCard
