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

interface ExamEditModalProps {
  exam: Doc<"exams"> | null
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ExamEditModal({
  exam,
  isOpen,
  onClose,
  onConfirm,
}: ExamEditModalProps) {
  if (!exam) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier l&apos;examen en cours</DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              ⚠️ <strong>Attention :</strong> Cet examen est actuellement en
              cours.
            </p>
            <p>
              Des étudiants pourraient déjà être en train de passer cet examen.
              Modifier l&apos;examen pendant qu&apos;il est en cours peut
              affecter l&apos;expérience des utilisateurs.
            </p>
            <p>
              Êtes-vous sûr de vouloir modifier{" "}
              <strong>&quot;{exam.title}&quot;</strong> ?
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={onConfirm}>Continuer la modification</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
