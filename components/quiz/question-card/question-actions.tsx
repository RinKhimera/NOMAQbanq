"use client"

import { Eye, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ActionConfig } from "./types"

// ===== Action Creator Helpers =====
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

// ===== Actions Dropdown Component =====
type QuestionActionsProps = {
  actions: ActionConfig[]
}

export const QuestionActions = ({ actions }: QuestionActionsProps) => {
  if (actions.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {actions.map((action, index) => {
          const isDestructive = action.variant === "destructive"
          const nextAction = actions[index + 1]
          const showSeparator =
            index < actions.length - 1 &&
            nextAction?.variant === "destructive" &&
            !isDestructive

          return (
            <div key={action.type}>
              <DropdownMenuItem
                onClick={action.onClick}
                className={
                  isDestructive
                    ? "text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
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
  )
}

// ===== Question Header Component =====
type QuestionHeaderProps = {
  questionNumber?: number
  domain?: string
  showDomainBadge?: boolean
  actions?: ActionConfig[]
}

export const QuestionHeader = ({
  questionNumber,
  domain,
  showDomainBadge = true,
  actions = [],
}: QuestionHeaderProps) => {
  return (
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
        {showDomainBadge && domain && <Badge variant="badge">{domain}</Badge>}
      </div>

      <QuestionActions actions={actions} />
    </div>
  )
}

// ===== Question Metadata Component =====
type QuestionMetadataProps = {
  objectifCMC?: string
  referencesCount?: number
  showObjectifBadge?: boolean
}

export const QuestionMetadata = ({
  objectifCMC,
  referencesCount,
  showObjectifBadge = true,
}: QuestionMetadataProps) => {
  if (!showObjectifBadge || !objectifCMC) return null

  return (
    <div className="mb-3 flex flex-col gap-2 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between dark:text-gray-400">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <Badge variant="outline" className="max-w-100 truncate">
          {objectifCMC}
        </Badge>
      </div>

      {referencesCount !== undefined && referencesCount > 0 && (
        <div className="flex shrink-0 items-center gap-1.5">
          <Eye className="h-4 w-4 text-gray-400" />
          <Badge variant="outline" className="whitespace-nowrap">
            {referencesCount} réf.
          </Badge>
        </div>
      )}
    </div>
  )
}

export default QuestionActions
