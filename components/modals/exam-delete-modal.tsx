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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer l&apos;examen</DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              ⚠️ <strong>Attention :</strong> Cette action est irréversible.
            </p>
            <p>
              L&apos;examen &quot;{exam.title}&quot; et toutes ses données
              (participants, résultats, etc.) seront définitivement supprimés.
            </p>
            <p>Êtes-vous absolument sûr de vouloir supprimer cet examen ?</p>
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
