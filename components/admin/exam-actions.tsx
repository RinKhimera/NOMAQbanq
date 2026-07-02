"use client"

import { Ellipsis, Eye, Pause, Play, SquarePen, Trash2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AdminExamListItem } from "@/features/exams/dal"

interface ExamActionsProps {
  exam: AdminExamListItem
  onDeactivate: (exam: AdminExamListItem) => void
  onReactivate: (examId: string) => void
  onEdit: (exam: AdminExamListItem) => void
  onDelete: (exam: AdminExamListItem) => void
}

export function ExamActions({
  exam,
  onDeactivate,
  onReactivate,
  onEdit,
  onDelete,
}: ExamActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Actions de l'examen"
          className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          <Ellipsis className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link
            href={`/admin/examens/${exam.id}`}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            Voir les détails
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onEdit(exam)}
          className="flex items-center gap-2"
        >
          <SquarePen className="h-4 w-4" />
          Modifier
        </DropdownMenuItem>

        {exam.isActive ? (
          <DropdownMenuItem
            onClick={() => onDeactivate(exam)}
            className="flex items-center gap-2"
          >
            <Pause className="h-4 w-4" />
            Désactiver
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => onReactivate(exam.id)}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Réactiver
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDelete(exam)}
          className="flex items-center gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
