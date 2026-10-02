"use client"

import { Eye, EyeOff, List, ListChecks, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ReopenExamButton } from "@/components/admin/reopen-exam-button"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { examComposerHref, examEditHref } from "@/constants/exam-routes"
import { deactivateExam, reactivateExam } from "@/features/exams/actions"
import { callAction } from "@/lib/safe-action"
import { DeactivateExamDialog, DeleteExamDialog } from "./exam-detail-dialogs"
import { type DetailExam, examQuestionsHref } from "./exam-detail-model"

/** Actions de l'en-tête de la fiche et leurs dialogues. */
export const ExamDetailActions = ({
  exam,
  participations,
  now,
}: {
  exam: DetailExam
  /** Participations à effacer avec l'examen (confirmation renforcée au-delà de 0). */
  participations: number
  now: number
}) => {
  const router = useRouter()
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [reactivating, setReactivating] = useState(false)

  const reactivate = async () => {
    setReactivating(true)
    const res = await callAction(() => reactivateExam({ examId: exam.id }))
    setReactivating(false)
    if (!res.success) {
      toast.error(res.error ?? "Réactivation impossible")
      return
    }
    toast.success("Examen réactivé")
    router.refresh()
  }

  const deactivate = async () => {
    const res = await callAction(() => deactivateExam({ examId: exam.id }))
    if (!res.success) {
      toast.error(res.error ?? "Désactivation impossible")
      return false
    }
    toast.success("Examen désactivé")
    router.refresh()
  }

  return (
    <>
      <Button asChild>
        <Link href={examEditHref(exam.id)} data-testid="btn-edit-exam">
          <Pencil aria-hidden />
          Modifier
        </Link>
      </Button>
      {exam.finalizedAt === null ? (
        <Button asChild variant="outline">
          <Link
            href={examComposerHref(exam.id, "fiche")}
            data-testid="btn-compose-questions"
          >
            <ListChecks aria-hidden />
            Composer le jeu de questions
          </Link>
        </Button>
      ) : (
        <Button asChild variant="ghost">
          <Link
            href={examQuestionsHref(exam.id)}
            data-testid="btn-view-questions"
          >
            <List aria-hidden />
            Voir les questions
          </Link>
        </Button>
      )}
      <ReopenExamButton exam={exam} now={now} />
      {exam.isActive ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setDeactivateOpen(true)}
          data-testid="btn-deactivate-exam"
        >
          <EyeOff aria-hidden />
          Désactiver
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          disabled={reactivating}
          onClick={reactivate}
          data-testid="btn-reactivate-exam"
        >
          {reactivating ? <Spinner size="sm" /> : <Eye aria-hidden />}
          Réactiver
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        className="text-danger-ink hover:text-danger-ink"
        onClick={() => setDeleteOpen(true)}
        data-testid="btn-delete-exam"
      >
        <Trash2 aria-hidden />
        Supprimer
      </Button>

      <DeactivateExamDialog
        title={exam.title}
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        onConfirm={deactivate}
      />
      <DeleteExamDialog
        exam={exam}
        participations={participations}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeactivateInstead={() => {
          setDeleteOpen(false)
          setDeactivateOpen(true)
        }}
      />
    </>
  )
}
