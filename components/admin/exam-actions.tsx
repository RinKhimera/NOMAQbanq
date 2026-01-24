"use client"

import { Edit, Eye, MoreHorizontal, Pause, Play, Trash2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Id } from "@/convex/_generated/dataModel"
import { ExamWithoutParticipants } from "@/types"

interface ExamActionsProps {
  exam: ExamWithoutParticipants
  onDeactivate: (exam: ExamWithoutParticipants) => void
  onReactivate: (examId: Id<"exams">) => void
  onEdit: (exam: ExamWithoutParticipants) => void
  onDelete: (exam: ExamWithoutParticipants) => void
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
          className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link
            href={`/admin/exams/${exam._id}`}
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
          <Edit className="h-4 w-4" />
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
            onClick={() => onReactivate(exam._id)}
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
