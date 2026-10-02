"use client"

import { RotateCcw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import type { QuizQuestion } from "@/components/quiz/runner/types"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ScoreRing } from "@/components/shared/score-ring"
import { StatusPill } from "@/components/shared/status-pill"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Button } from "@/components/ui/button"
import { deleteParticipation } from "@/features/exams/actions"
import { NBSP, formatClockTime, formatDayMonth } from "@/lib/format"
import { callAction } from "@/lib/safe-action"
import { summarize } from "@/lib/score"
import { TOUCH_HEIGHT } from "@/lib/touch-target"
import { examHref } from "../../../../_components/exam-routes"
import { DetailCard } from "../../../_components/detail-card"
import { ExamBreadcrumb } from "../../../_components/exam-breadcrumb"
import { CopyAnswers } from "./copy-answers"
import { type CopyAnswer, copyRows, toAnswersMap } from "./copy-model"

export type CopyParticipant = {
  participationId: string
  name: string
  image: string | null
  score: number | null
  completedAt: number | null
  status: "completed" | "auto_submitted"
  answers: CopyAnswer[]
}

/** Copie d'un étudiant (admin) : bilan, réponses et suppression de la participation. */
export function ExamCopyClient({
  exam,
  participant,
  questions,
  rank,
}: {
  exam: { id: string; title: string }
  participant: CopyParticipant
  questions: QuizQuestion[]
  rank: { rank: number; total: number } | null
}) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const rows = useMemo(
    () => copyRows(questions, participant.answers),
    [questions, participant.answers],
  )
  const counts = useMemo(
    () => summarize(questions, toAnswersMap(participant.answers)),
    [questions, participant.answers],
  )

  const remove = async () => {
    const res = await callAction(() =>
      deleteParticipation({ participationId: participant.participationId }),
    )
    if (!res.success) {
      toast.error(res.error ?? "Suppression impossible")
      return false
    }
    toast.success("Participation supprimée")
    router.push(examHref(exam.id))
  }

  const cells = [
    { label: "Correctes", value: counts.correct, testId: "copy-correct" },
    { label: "Incorrectes", value: counts.incorrect, testId: "copy-incorrect" },
    {
      label: "Non répondues",
      value: counts.unanswered,
      testId: "copy-unanswered",
    },
  ]

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      <ExamBreadcrumb
        items={[
          { label: exam.title, href: examHref(exam.id) },
          { label: participant.name },
        ]}
      />

      <div
        className="flex flex-wrap items-center gap-5"
        data-testid="copy-header"
      >
        <div className="flex min-w-0 flex-[1_1_320px] items-center gap-4">
          <UserAvatar
            name={participant.name}
            image={participant.image}
            className="size-12 shrink-0"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="type-label">Copie · {exam.title}</p>
            <h1 className="type-h2 text-ink wrap-anywhere">
              {participant.name}
            </h1>
            <p className="text-ink-3 flex flex-wrap items-center gap-2 text-[0.8125rem]">
              {rank && (
                <span data-testid="copy-rank">
                  Rang {rank.rank} sur {rank.total}
                </span>
              )}
              {participant.status === "auto_submitted" ? (
                <StatusPill tone="warning" data-testid="copy-auto-submitted">
                  Soumission automatique
                </StatusPill>
              ) : (
                participant.completedAt !== null && (
                  <span data-testid="copy-submitted-at">
                    {rank ? "· " : ""}soumise le{" "}
                    {formatDayMonth(participant.completedAt)} à{" "}
                    {formatClockTime(participant.completedAt)}
                  </span>
                )
              )}
            </p>
          </div>
        </div>

        <div className="bg-line border-line grid min-w-0 flex-[1_1_420px] grid-cols-3 gap-px overflow-hidden rounded-lg border sm:grid-cols-[auto_repeat(3,minmax(0,1fr))]">
          <div className="bg-surface col-span-3 grid place-items-center p-4 sm:col-span-1">
            <ScoreRing
              value={participant.score}
              label="Score"
              size={116}
              strokeWidth={9}
              valueTestId="copy-score"
            />
          </div>
          {cells.map((cell) => (
            <div
              key={cell.label}
              className="bg-surface flex flex-col justify-center gap-0.5 px-4.5 py-4"
            >
              <span
                data-testid={cell.testId}
                className="text-ink font-mono text-[1.375rem] tabular-nums"
              >
                {cell.value.toLocaleString("fr-CA")}
              </span>
              <span className="text-ink-3 text-xs">{cell.label}</span>
            </div>
          ))}
        </div>
      </div>

      <DetailCard
        eyebrow="Réponses"
        title="Question par question"
        action={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={`max-sm:w-full ${TOUCH_HEIGHT}`}
            onClick={() => setDeleteOpen(true)}
            data-testid="btn-delete-participation"
          >
            <RotateCcw aria-hidden />
            Supprimer la participation
          </Button>
        }
        bodyClassName="px-5 pb-5 md:px-6"
      >
        <CopyAnswers rows={rows} />
      </DetailCard>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        variant="destructive"
        title={`Supprimer cette participation${NBSP}?`}
        description={`${participant.name} pourra repasser ${exam.title} tant qu'il est ouvert. Ses réponses et son score sont effacés, et le classement est recalculé.`}
        confirmLabel="Supprimer"
        pendingLabel="Suppression…"
        confirmTestId="btn-delete-participation-confirm"
        onConfirm={remove}
      />
    </div>
  )
}
