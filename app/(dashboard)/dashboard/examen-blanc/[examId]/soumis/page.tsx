import { redirect } from "next/navigation"
import { getExamSubmissionSummary } from "@/features/exams/dal"
import { formatExpiration } from "@/lib/format"
import { ConfirmationClient } from "./_components/confirmation-client"

interface SubmittedPageProps {
  params: Promise<{ examId: string }>
}

/**
 * Écran de confirmation post-soumission d'examen.
 * Si l'utilisateur n'a pas de participation complétée/auto-soumise → redirect.
 */
export default async function ExamSubmittedPage({
  params,
}: SubmittedPageProps) {
  const { examId } = await params
  const summary = await getExamSubmissionSummary(examId)

  if (!summary) {
    redirect("/dashboard/examen-blanc")
  }

  const endDateFormatted = formatExpiration(summary.endDate)

  return (
    <ConfirmationClient
      examTitle={summary.examTitle}
      answeredCount={summary.answeredCount}
      flaggedCount={summary.flaggedCount}
      endDateFormatted={endDateFormatted}
      isAutoSubmitted={summary.status === "auto_submitted"}
    />
  )
}
