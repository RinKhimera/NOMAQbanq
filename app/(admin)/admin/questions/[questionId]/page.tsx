import { FileQuestion } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { getQuestionAnswerBreakdown } from "@/features/analytics/dal"
import {
  getQuestionById,
  getQuestionExams,
  getQuestionNeighbors,
} from "@/features/questions/dal"
import { keyReview } from "@/features/questions/key-review"
import { diagnoseCorrection } from "@/features/questions/normalization"
import { requireRole } from "@/lib/auth-guards"
import { currentTimeMs } from "@/lib/clock"
import { isOpen } from "@/lib/exam-phase"
import {
  parseQuestionList,
  questionListHref,
  toQuestionFilters,
  toSearchParams,
} from "../_components/question-params"
import { QuestionDetailClient } from "./_components/question-detail-client"

export const metadata: Metadata = { title: "Question" }

export default async function AdminQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ questionId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireRole(["admin"])
  const { questionId } = await params
  const list = parseQuestionList(toSearchParams(await searchParams))

  const [question, breakdown, exams, neighbors] = await Promise.all([
    getQuestionById(questionId),
    getQuestionAnswerBreakdown(questionId),
    getQuestionExams(questionId),
    getQuestionNeighbors(questionId, toQuestionFilters(list)),
  ])

  if (!question) return <QuestionNotFound listHref={questionListHref(list)} />

  const now = currentTimeMs()
  // Choix figés : l'examen ouvert qui ferme le plus tard les tient verrouillés.
  const lockingExam =
    exams
      .filter((e) => isOpen(e, now))
      .sort((a, b) => b.endDate - a.endDate)[0] ?? null

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <QuestionDetailClient
        file={{
          question,
          breakdown,
          exams,
          review: keyReview({
            answerCount: breakdown.answerCount,
            keySuspect: breakdown.keySuspect,
            confirmation: question.keyConfirmation,
          }),
          formatIssues: diagnoseCorrection({
            explanation: question.explanation,
            references: question.references ?? [],
          }),
        }}
        list={list}
        neighbors={neighbors}
        lockingExam={lockingExam}
        initialNow={now}
      />
    </div>
  )
}

const QuestionNotFound = ({ listHref }: { listHref: string }) => (
  <div className="flex flex-col gap-4 p-4 lg:p-6">
    <nav aria-label="Fil d'Ariane" className="text-ink-3 text-sm">
      <Link href={listHref} className="hover:text-ink">
        Questions
      </Link>{" "}
      › <span className="text-ink">Introuvable</span>
    </nav>
    <div className="bg-surface border-line rounded-lg border py-12">
      <EmptyState
        size="compact"
        icons={[FileQuestion]}
        title="Question introuvable"
        description="Cette question n'existe pas ou a été supprimée."
      >
        <Button asChild variant="outline">
          <Link href={listHref}>Retour aux questions</Link>
        </Button>
      </EmptyState>
    </div>
  </div>
)
