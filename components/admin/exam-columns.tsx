"use client"

import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Calendar, Clock, Eye, Users } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Doc, Id } from "@/convex/_generated/dataModel"
import { getExamStatus } from "@/lib/exam-status"
import { ExamActions } from "./exam-actions"
import ExamStatusBadge from "./exam-status-badge"

export const createExamColumns = (
  onDeactivate: (exam: Doc<"exams">) => void,
  onReactivate: (examId: Id<"exams">) => void,
  onEdit: (exam: Doc<"exams">) => void,
  onDelete: (exam: Doc<"exams">) => void,
  isMobile: boolean = false,
): ColumnDef<Doc<"exams">>[] => {
  const baseColumns: ColumnDef<Doc<"exams">>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          className="border-muted-foreground dark:data-[state=checked]:bg-muted-foreground/10 data-[state=checked]:bg-blue-500 dark:text-white"
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Sélectionner tout"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          className="border-muted-foreground dark:data-[state=checked]:bg-muted-foreground/10 data-[state=checked]:bg-blue-500 dark:text-white"
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Sélectionner la ligne"
        />
      ),
      enableSorting: false,
      // Allow programmatic hiding and mark to hide on mobile
      meta: {
        hideOnMobile: true,
      },
    },
    {
      accessorKey: "title",
      header: "Titre",
      cell: ({ row }) => {
        const exam = row.original
        return (
          <div>
            <p className="font-medium">{exam.title}</p>
            {exam.description && (
              <p className="text-muted-foreground text-sm">
                {exam.description}
              </p>
            )}
          </div>
        )
      },
    },
  ]

  // Colonnes pour desktop (≥ md) - masquées sur mobile
  const desktopColumns: ColumnDef<Doc<"exams">>[] = [
    {
      accessorKey: "startDate",
      header: "Date de début",
      cell: ({ row }) => {
        const exam = row.original
        return (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {format(new Date(exam.startDate), "PPP", { locale: fr })}
          </div>
        )
      },
      meta: {
        hideOnMobile: true,
      },
    },
    {
      accessorKey: "endDate",
      header: "Date de fin",
      cell: ({ row }) => {
        const exam = row.original
        return (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {format(new Date(exam.endDate), "PPP", { locale: fr })}
          </div>
        )
      },
      meta: {
        hideOnMobile: true,
      },
    },
    {
      accessorKey: "questionIds",
      header: "Questions",
      cell: ({ row }) => {
        const exam = row.original
        return (
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            {exam.questionIds.length}
          </div>
        )
      },
      meta: {
        hideOnMobile: true,
      },
    },
    {
      accessorKey: "participants",
      header: "Participants",
      cell: ({ row }) => {
        const exam = row.original
        return (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {exam.participants.length}
          </div>
        )
      },
      meta: {
        hideOnMobile: true,
      },
    },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) => {
        const exam = row.original
        const status = getExamStatus(exam)
        return <ExamStatusBadge status={status} />
      },
      meta: {
        hideOnMobile: true,
      },
    },
  ]

  // Colonne d'actions
  const actionsColumn: ColumnDef<Doc<"exams">>[] = [
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const exam = row.original
        return (
          <ExamActions
            exam={exam}
            onDeactivate={onDeactivate}
            onReactivate={onReactivate}
            onEdit={onEdit}
            onDelete={onDelete}
            isMobile={isMobile}
          />
        )
      },
      enableSorting: false,
      enableHiding: false,
    },
  ]

  // Retourner toutes les colonnes, la logique de masquage sera gérée par la DataTable
  return [...baseColumns, ...desktopColumns, ...actionsColumn]
}
