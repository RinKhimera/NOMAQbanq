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

interface ExamDeleteModalProps {
  exam: Doc<"exams"> | null
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading?: boolean
}

export function ExamDeleteModal({
  exam,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: ExamDeleteModalProps) {
  if (!exam) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>Supprimer l&apos;examen</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              <div>
                ⚠️ <strong>Attention :</strong> Cette action est irréversible.
              </div>
              <div>
                L&apos;examen &quot;{exam.title}&quot; et toutes ses données
                (participants, résultats, etc.) seront définitivement supprimés.
              </div>
              <div>
                Êtes-vous absolument sûr de vouloir supprimer cet examen ?
              </div>
            </div>
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
            {isLoading ? "Suppression..." : "Supprimer définitivement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
