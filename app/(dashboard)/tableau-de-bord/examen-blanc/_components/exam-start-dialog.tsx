"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { closesBeforeBudget } from "@/lib/exam-list"
import { formatCountdown, formatShortDuration } from "@/lib/format"
import { callAction } from "@/lib/safe-action"
import { TONE_SOFT } from "@/lib/tone"
import { ExamConsignes } from "./exam-consignes"

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

  const closingSoon = exam ? closesBeforeBudget(exam, now) : false

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
            <div className="flex flex-col gap-3.5">
              {closingSoon && (
                <Alert className={TONE_SOFT.warning}>
                  <AlertDescription className="text-warning-ink">
                    Cet examen ferme dans {formatCountdown(exam.endDate - now)},
                    avant la fin des{" "}
                    {formatShortDuration(exam.completionTime * 1000)} prévues :
                    il sera soumis à la fermeture.
                  </AlertDescription>
                </Alert>
              )}
              <ExamConsignes
                questionCount={exam.questionCount}
                completionTime={exam.completionTime}
                pauseDurationMinutes={
                  exam.enablePause ? exam.pauseDurationMinutes : null
                }
                endDate={exam.endDate}
              />
              <label className="text-ink flex cursor-pointer items-center gap-2.5 text-sm max-md:min-h-11">
                <Checkbox
                  checked={ack}
                  onCheckedChange={(v) => setAck(v === true)}
                  disabled={isStarting}
                  data-testid="exam-consignes-ack"
                />
                J&apos;ai lu les consignes.
              </label>
            </div>
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
