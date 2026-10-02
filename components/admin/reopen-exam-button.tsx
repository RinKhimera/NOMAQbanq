"use client"

import { CopyPlus } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { isOpen } from "@/lib/exam-phase"
import { cn } from "@/lib/utils"

/** Création pré-remplie depuis un examen clos (`CONTEXT.md`, « Réouverture »). */
export const reopenExamHref = (examId: string) =>
  `/admin/examens/creer?source=${examId}`

/** Un examen clos se rouvre ; un examen en préparation n'a jamais été ouvert. */
export const canReopen = (
  exam: { endDate: number | null; finalizedAt: number | null },
  now: number,
) =>
  exam.finalizedAt !== null &&
  exam.endDate !== null &&
  !isOpen({ endDate: exam.endDate }, now)

/** « Rouvrir », rendu seulement sur un examen clos. */
export function ReopenExamButton({
  exam,
  now,
  className,
}: {
  exam: { id: string; endDate: number | null; finalizedAt: number | null }
  now: number
  className?: string
}) {
  if (!canReopen(exam, now)) return null
  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className={cn("hover:text-blue-700 dark:hover:text-white", className)}
    >
      <Link href={reopenExamHref(exam.id)}>
        <CopyPlus className="mr-2 h-4 w-4" />
        Rouvrir
      </Link>
    </Button>
  )
}
