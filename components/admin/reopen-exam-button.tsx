"use client"

import { RotateCcw } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { examCreateHref } from "@/constants/exam-routes"
import { type ExamSchedule, isFinalizedClosed } from "@/lib/exam-phase"

/** Un examen clos se rouvre ; un examen en préparation n'a jamais été ouvert. */
export const canReopen = isFinalizedClosed

/** « Rouvrir », rendu seulement sur un examen clos. */
export function ReopenExamButton({
  exam,
  now,
  className,
}: {
  exam: ExamSchedule & { id: string }
  now: number
  className?: string
}) {
  if (!canReopen(exam, now)) return null
  return (
    <Button asChild variant="ghost" className={className}>
      <Link href={examCreateHref(exam.id)} data-testid="btn-reopen-exam">
        <RotateCcw aria-hidden />
        Rouvrir
      </Link>
    </Button>
  )
}
