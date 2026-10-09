"use client"

import {
  CirclePause,
  CirclePlay,
  Eye,
  EyeOff,
  List,
  ListChecks,
  Pencil,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ReopenExamButton } from "@/components/admin/reopen-exam-button"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { examComposerHref, examEditHref } from "@/constants/exam-routes"
import {
  liftExamSuspension,
  setExamHidden,
  suspendExam,
} from "@/features/exams/actions"
import { isFinalizedOpen } from "@/lib/exam-phase"
import { callAction } from "@/lib/safe-action"
import { DeleteExamDialog, SuspendExamDialog } from "./exam-detail-dialogs"
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
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pending, setPending] = useState<"lift" | "hide" | null>(null)
  // Suspension et levée ne jouent que tant que l'examen est ouvert.
  const open = isFinalizedOpen(exam, now)

  const run = async (
    kind: "lift" | "hide",
    action: () => Promise<{ success: boolean; error?: string }>,
    done: string,
  ) => {
    setPending(kind)
    const res = await callAction(action)
    setPending(null)
    if (!res.success) {
      toast.error(res.error ?? "Action impossible")
      return
    }
    toast.success(done)
    router.refresh()
  }

  const suspend = async () => {
    const res = await callAction(() => suspendExam({ examId: exam.id }))
    if (!res.success) {
      toast.error(res.error ?? "Suspension impossible")
      return false
    }
    toast.success("Examen suspendu")
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
      {exam.audienceType === "subscribers" && (
        <Button
          type="button"
          variant="ghost"
          disabled={pending !== null}
          onClick={() =>
            run(
              "hide",
              () => setExamHidden({ examId: exam.id, hidden: !exam.isHidden }),
              exam.isHidden ? "Examen affiché" : "Examen masqué",
            )
          }
          data-testid={exam.isHidden ? "btn-show-exam" : "btn-hide-exam"}
        >
          {pending === "hide" ? (
            <Spinner size="sm" />
          ) : exam.isHidden ? (
            <Eye aria-hidden />
          ) : (
            <EyeOff aria-hidden />
          )}
          {exam.isHidden ? "Afficher" : "Masquer"}
        </Button>
      )}
      {open &&
        (exam.isActive ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setSuspendOpen(true)}
            data-testid="btn-suspend-exam"
          >
            <CirclePause aria-hidden />
            Suspendre l&apos;examen
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            disabled={pending !== null}
            onClick={() =>
              run(
                "lift",
                () => liftExamSuspension({ examId: exam.id }),
                "Suspension levée",
              )
            }
            data-testid="btn-lift-suspension"
          >
            {pending === "lift" ? (
              <Spinner size="sm" />
            ) : (
              <CirclePlay aria-hidden />
            )}
            Lever la suspension
          </Button>
        ))}
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

      <SuspendExamDialog
        title={exam.title}
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        onConfirm={suspend}
      />
      <DeleteExamDialog
        exam={exam}
        participations={participations}
        suspendable={open && exam.isActive}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onSuspendInstead={() => {
          setDeleteOpen(false)
          setSuspendOpen(true)
        }}
      />
    </>
  )
}
