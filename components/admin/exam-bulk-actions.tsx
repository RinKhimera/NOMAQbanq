"use client"

import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Doc } from "@/convex/_generated/dataModel"

interface ExamBulkActionsProps {
  selectedExams: Doc<"exams">[]
  onBulkDelete: () => void
  isVisible: boolean
}

export function ExamBulkActions({
  selectedExams,
  onBulkDelete,
  isVisible,
}: ExamBulkActionsProps) {
  if (!isVisible || selectedExams.length === 0) return null

  return (
    <div className="bg-card flex items-center gap-2 rounded-md border p-2">
      <span className="text-muted-foreground text-sm">
        {selectedExams.length} examen(s) sélectionné(s)
      </span>
      <Button
        variant="destructive"
        size="sm"
        onClick={onBulkDelete}
        className="gap-2"
      >
        <Trash2 className="h-4 w-4" />
        Supprimer ({selectedExams.length})
      </Button>
    </div>
  )
}
