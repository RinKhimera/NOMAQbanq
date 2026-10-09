"use client"

import { CirclePause, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { formatCount } from "@/components/admin/question-detail/labels"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EXAMS_HREF } from "@/constants/exam-routes"
import { deleteExam } from "@/features/exams/actions"
import { NBSP } from "@/lib/format"
import { callAction } from "@/lib/safe-action"
import { type DetailExam, SUSPENSION_EFFECT } from "./exam-detail-model"

export const SuspendExamDialog = ({
  title,
  open,
  onOpenChange,
  onConfirm,
}: {
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<unknown>
}) => (
  <ConfirmDialog
    open={open}
    onOpenChange={onOpenChange}
    variant="destructive"
    title={`Suspendre ${title}${NBSP}?`}
    description={SUSPENSION_EFFECT}
    confirmLabel={
      <>
        <CirclePause aria-hidden />
        Suspendre l&apos;examen
      </>
    }
    pendingLabel="Suspension…"
    confirmTestId="btn-suspend-exam-confirm"
    onConfirm={onConfirm}
  />
)

/**
 * Suppression définitive. Avec des participations, l'identifiant de l'examen
 * se saisit pour confirmer, et la suspension est proposée à la place pour un
 * examen ouvert qui ne l'est pas déjà.
 */
export const DeleteExamDialog = ({
  exam,
  participations,
  suspendable,
  open,
  onOpenChange,
  onSuspendInstead,
}: {
  exam: DetailExam
  participations: number
  /** Examen finalisé, ouvert et pas déjà suspendu. */
  suspendable: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuspendInstead: () => void
}) => {
  const router = useRouter()
  const [confirmation, setConfirmation] = useState("")
  const guarded = participations > 0

  const setOpen = (next: boolean) => {
    if (!next) setConfirmation("")
    onOpenChange(next)
  }

  const remove = async () => {
    const res = await callAction(() =>
      deleteExam({ examId: exam.id, expectedParticipations: participations }),
    )
    if (!res.success) {
      toast.error(res.error ?? "Suppression impossible")
      return false
    }
    toast.success("Examen supprimé")
    router.push(EXAMS_HREF)
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      variant="destructive"
      title={`Supprimer ${exam.title}${NBSP}?`}
      description={
        guarded
          ? "Cette action est définitive et ne peut pas être annulée."
          : "Aucune participation : l'examen et son jeu de questions seront retirés."
      }
      confirmLabel={
        <>
          <Trash2 aria-hidden />
          Supprimer définitivement
        </>
      }
      pendingLabel="Suppression…"
      confirmDisabled={guarded && confirmation.trim() !== exam.id}
      confirmTestId="btn-delete-exam-confirm"
      onConfirm={remove}
    >
      {guarded && (
        <div className="flex flex-col gap-3.5">
          <Alert variant="destructive">
            <AlertTitle>
              {participations > 1
                ? `${formatCount(participations)} participations seront effacées`
                : "1 participation sera effacée"}
            </AlertTitle>
            <AlertDescription>
              Les copies, les réponses et les scores de ces étudiants
              disparaîtront, y compris de leur historique et de leur
              progression.
            </AlertDescription>
          </Alert>
          {suspendable && (
            <div className="text-ink-2 flex flex-wrap items-center gap-2 text-sm">
              Pour arrêter l&apos;examen sans perdre les résultats, préférez la
              suspension.
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setConfirmation("")
                  onSuspendInstead()
                }}
                data-testid="btn-suspend-instead"
              >
                Suspendre à la place
              </Button>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="delete-exam-confirm" className="text-ink text-sm">
              Saisissez{" "}
              <span className="text-ink font-mono break-all select-all">
                {exam.id}
              </span>{" "}
              pour confirmer
            </label>
            <Input
              id="delete-exam-confirm"
              value={confirmation}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setConfirmation(event.target.value)}
              data-testid="delete-exam-confirm-input"
            />
          </div>
        </div>
      )}
    </ConfirmDialog>
  )
}
