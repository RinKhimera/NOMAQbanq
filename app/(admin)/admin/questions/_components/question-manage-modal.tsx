"use client"

import { Pencil, Trash2, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import {
  QuestionDetailModal,
  useQuestionBrowser,
} from "@/components/admin/question-browser"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { deleteQuestion } from "@/features/questions/actions"
import { callAction } from "@/lib/safe-action"
import { QuestionAnswerBreakdown } from "./question-answer-breakdown"

interface QuestionManageModalProps {
  questionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

function ManageActions({
  questionId,
  isLoading,
  onDeleted,
}: {
  questionId: string
  isLoading: boolean
  onDeleted?: () => void
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  // Rendu via renderPanel, donc à l'intérieur du QuestionBrowserProvider.
  const { reload } = useQuestionBrowser()

  const handleDelete = async () => {
    setIsDeleting(true)
    const res = await callAction(() => deleteQuestion(questionId))
    setIsDeleting(false)
    if (!res.success) {
      toast.error(res.error ?? "Erreur lors de la suppression")
      return
    }
    toast.success(
      res.mode === "hard"
        ? "Question supprimée définitivement"
        : "Question archivée : référencée par des examens ou entraînements — médias conservés",
    )
    setShowDeleteDialog(false)
    reload()
    onDeleted?.()
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
        onClick={() => setShowDeleteDialog(true)}
        disabled={isLoading}
      >
        <Trash2 className="h-4 w-4" />
        Supprimer
      </Button>
      <Button asChild className="gap-2">
        <Link href={`/admin/questions/${questionId}/modifier`}>
          <Pencil className="h-4 w-4" />
          Modifier
        </Link>
      </Button>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-red-500" />
              Supprimer cette question ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La question sera définitivement
              supprimée de la banque de questions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Radix ferme l'alerte au clic : elle doit rester ouverte, le
                // spinner visible, jusqu'à la réponse.
                event.preventDefault()
                handleDelete()
              }}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Spinner size="sm" />
                  Suppression…
                </>
              ) : (
                "Supprimer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Détail d'une question dans le navigateur de questions. */
export function QuestionManageModal({
  onDeleted,
  ...props
}: QuestionManageModalProps) {
  return (
    <QuestionDetailModal
      {...props}
      insights={(questionId) => (
        <QuestionAnswerBreakdown questionId={questionId} />
      )}
      footer={(questionId, isLoading) => (
        <ManageActions
          questionId={questionId}
          isLoading={isLoading}
          onDeleted={onDeleted}
        />
      )}
    />
  )
}
