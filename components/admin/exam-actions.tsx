"use client"

import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Edit, Eye, MoreHorizontal, Pause, Play, Trash2 } from "lucide-react"
import { Calendar, Clock, Eye as EyeIcon, Users } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Doc, Id } from "@/convex/_generated/dataModel"
import { getExamStatus } from "@/lib/exam-status"
import { cn } from "@/lib/utils"
import { sidebarMenuButtonVariants } from "../ui/sidebar"
import ExamStatusBadge from "./exam-status-badge"

interface ExamActionsProps {
  exam: Doc<"exams">
  onDeactivate: (exam: Doc<"exams">) => void
  onReactivate: (examId: Id<"exams">) => void
  onEdit: (exam: Doc<"exams">) => void
  onDelete: (exam: Doc<"exams">) => void
  isMobile?: boolean
}

export function ExamActions({
  exam,
  onDeactivate,
  onReactivate,
  onEdit,
  onDelete,
  isMobile = false,
}: ExamActionsProps) {
  const status = getExamStatus(exam)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn("bg-sidebar", isMobile ? "w-64" : "w-48")}
      >
        {/* Informations de l'examen en version mobile */}
        {isMobile && (
          <>
            <div className="border-b p-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">
                    {format(new Date(exam.startDate), "PPP", { locale: fr })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">
                    {format(new Date(exam.endDate), "PPP", { locale: fr })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <EyeIcon className="h-4 w-4" />
                  <span className="text-sm">
                    {exam.questionIds.length} questions
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">
                    {exam.participants.length} participants
                  </span>
                </div>
                <ExamStatusBadge status={status} />
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Actions */}
        <DropdownMenuItem
          className={sidebarMenuButtonVariants({ variant: "link" })}
          asChild
        >
          <Link className="" href={`/admin/exams/${exam._id}`}>
            <Eye className="mr-2 h-4 w-4" />
            Voir les détails
          </Link>
        </DropdownMenuItem>

        {exam.isActive ? (
          <DropdownMenuItem
            className={sidebarMenuButtonVariants({ variant: "link" })}
            onClick={() => onDeactivate(exam)}
          >
            <Pause className="mr-2 h-4 w-4" />
            Désactiver
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className={sidebarMenuButtonVariants({ variant: "link" })}
            onClick={() => onReactivate(exam._id)}
          >
            <Play className="mr-2 h-4 w-4" />
            Réactiver
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          className={sidebarMenuButtonVariants({ variant: "link" })}
          onClick={() => onEdit(exam)}
        >
          <Edit className="mr-2 h-4 w-4" />
          Modifier
        </DropdownMenuItem>

        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDelete(exam)}
          className=""
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
