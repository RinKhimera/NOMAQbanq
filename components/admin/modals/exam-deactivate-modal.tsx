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

interface ExamDeactivateModalProps {
  exam: Doc<"exams"> | null
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading?: boolean
}

export function ExamDeactivateModal({
  exam,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: ExamDeactivateModalProps) {
  if (!exam) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>Désactiver l&apos;examen en cours</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              <div>
                ⚠️ <strong>Attention :</strong> Cet examen est actuellement en
                cours.
              </div>
              <div>
                Des étudiants pourraient déjà être en train de passer cet
                examen. La désactivation interrompra immédiatement l&apos;accès
                à l&apos;examen pour tous les utilisateurs.
              </div>
              <div>
                Êtes-vous sûr de vouloir désactiver{" "}
                <strong>&quot;{exam.title}&quot;</strong> ?
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
            {isLoading ? "Désactivation..." : "Désactiver l'examen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
