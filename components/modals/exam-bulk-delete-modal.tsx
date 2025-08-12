"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Doc } from "@/convex/_generated/dataModel"

interface ExamBulkDeleteModalProps {
  exams: Doc<"exams">[]
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading?: boolean
}

export function ExamBulkDeleteModal({
  exams,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: ExamBulkDeleteModalProps) {
  if (exams.length === 0) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>Supprimer {exams.length} examen(s)</DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              ⚠️ <strong>Attention :</strong> Cette action est irréversible.
            </p>
            <p>
              {exams.length === 1 ? (
                <>
                  L&apos;examen &quot;{exams[0].title}&quot; et toutes ses
                  données (participants, résultats, etc.) seront définitivement
                  supprimés.
                </>
              ) : (
                <>
                  Les {exams.length} examens sélectionnés et toutes leurs
                  données (participants, résultats, etc.) seront définitivement
                  supprimés.
                </>
              )}
            </p>
            <p>Êtes-vous absolument sûr de vouloir supprimer ces examens ?</p>
            {exams.length > 1 && (
              <div className="mt-4 rounded-md bg-white p-3 dark:bg-gray-900">
                <p className="mb-2 text-sm font-medium text-white">
                  Examens à supprimer :
                </p>
                <ul className="space-y-1 text-sm">
                  {exams.slice(0, 5).map((exam) => (
                    <li key={exam._id} className="text-muted-foreground">
                      • {exam.title}
                    </li>
                  ))}
                  {exams.length > 5 && (
                    <li className="text-muted-foreground">
                      • ... et {exams.length - 5} autre(s)
                    </li>
                  )}
                </ul>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading
              ? "Suppression..."
              : `Supprimer ${exams.length} examen(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
