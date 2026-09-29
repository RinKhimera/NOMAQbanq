"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { ExamConsignesForm } from "@/components/quiz/session/exam-consignes"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { startExam } from "@/features/exams/actions"
import type { ExamListItem } from "@/features/exams/dal"
import { callAction } from "@/lib/safe-action"

type ExamStartDialogProps = {
  exam: ExamListItem | null
  now: number
  onClose: () => void
}

/**
 * Consignes d'un examen blanc, à lire avant de le commencer. La participation
 * se crée ici (`startExam`) : la page de passation ne reçoit les questions
 * qu'une fois la participation ouverte.
 */
export const ExamStartDialog = ({
  exam,
  now,
  onClose,
}: ExamStartDialogProps) => {
  const router = useRouter()
  const [ack, setAck] = useState(false)
  const [isStarting, startTransition] = useTransition()

  const close = () => {
    if (isStarting) return
    setAck(false)
    onClose()
  }

  const start = () => {
    if (!exam || !ack) return
    startTransition(async () => {
      const res = await callAction(() => startExam({ examId: exam.id }))
      if (!res.success) {
        toast.error(res.error)
        // La liste peut avoir changé (examen fermé, accès échu) : la relire.
        router.refresh()
        setAck(false)
        onClose()
        return
      }
      router.push(`/tableau-de-bord/examen-blanc/${exam.id}/evaluation`)
    })
  }

  return (
    <Dialog open={exam !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent data-testid="exam-start-dialog" className="sm:max-w-xl">
        {exam && (
          <>
            <DialogHeader>
              <DialogTitle>Commencer {exam.title} ?</DialogTitle>
              <DialogDescription>
                Prévoyez un moment sans interruption.
              </DialogDescription>
            </DialogHeader>
            <ExamConsignesForm
              exam={{
                questionCount: exam.questionCount,
                completionTime: exam.completionTime,
                pauseDurationMinutes: exam.enablePause
                  ? exam.pauseDurationMinutes
                  : null,
                endDate: exam.endDate,
              }}
              now={now}
              acknowledged={ack}
              onAcknowledgedChange={setAck}
              disabled={isStarting}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={close}
                disabled={isStarting}
                className="max-md:h-11"
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={start}
                disabled={!ack || isStarting}
                data-testid="btn-start-exam"
                className="max-md:h-11"
              >
                {isStarting && <Spinner size="sm" />}
                Commencer l&apos;examen
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
