"use client"

import { EllipsisVertical, Eye, Pencil, Plus, Trash2 } from "lucide-react"
import { Fragment } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ActionConfig } from "./types"

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

type QuestionActionsProps = {
  actions: ActionConfig[]
}

export const QuestionActions = ({ actions }: QuestionActionsProps) => {
  if (actions.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="max-md:size-11">
          <EllipsisVertical />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {actions.map((action, index) => {
          const isDestructive = action.variant === "destructive"
          const showSeparator =
            !isDestructive && actions[index + 1]?.variant === "destructive"

          return (
            <Fragment key={action.type}>
              <DropdownMenuItem
                variant={isDestructive ? "destructive" : "default"}
                onClick={action.onClick}
              >
                {action.icon}
                {action.label}
              </DropdownMenuItem>
              {showSeparator && <DropdownMenuSeparator />}
            </Fragment>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
