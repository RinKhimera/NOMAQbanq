import { FileQuestion } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { questionTitle } from "@/components/admin/question-detail/labels"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { getQuestionAnswerBreakdown } from "@/features/analytics/dal"
import {
  type QuestionImageView,
  getObjectivesByDomain,
  getQuestionById,
  getQuestionExams,
} from "@/features/questions/dal"
import { keyReview } from "@/features/questions/key-review"
import { requireRole } from "@/lib/auth-guards"
import { cdnUrl } from "@/lib/cdn"
import { currentTimeMs } from "@/lib/clock"
import { isOpen } from "@/lib/exam-phase"
import { QuestionForm } from "../../_components/question-form"
import {
  parseQuestionList,
  questionListHref,
  toSearchParams,
} from "../../_components/question-params"

export const metadata: Metadata = { title: "Modifier la question" }

const toFormImages = (images: QuestionImageView[]) =>
  images.map((img) => ({
    url: cdnUrl(img.storagePath),
    storagePath: img.storagePath,
    order: img.position,
  }))

export default async function EditQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ questionId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireRole(["admin"])
  const { questionId } = await params
  const list = parseQuestionList(toSearchParams(await searchParams))

  const [question, breakdown, exams, objectivesByDomain] = await Promise.all([
    getQuestionById(questionId),
    getQuestionAnswerBreakdown(questionId),
    getQuestionExams(questionId),
    getObjectivesByDomain(),
  ])

  if (!question)
    return (
      <div className="flex flex-col gap-4 p-4 lg:p-6">
        <nav aria-label="Fil d'Ariane" className="text-ink-3 text-sm">
          <Link href={questionListHref(list)} className="hover:text-ink">
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
              <Link href={questionListHref(list)}>Retour aux questions</Link>
            </Button>
          </EmptyState>
        </div>
      </div>
    )

  const now = currentTimeMs()
  const lockingExam =
    exams
      .filter((e) => isOpen(e, now))
      .sort((a, b) => b.endDate - a.endDate)[0] ?? null
  const review = keyReview({
    answerCount: breakdown.answerCount,
    keySuspect: breakdown.keySuspect,
    confirmation: question.keyConfirmation,
  })

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <QuestionForm
        mode="edit"
        initialQuestionId={question.id}
        initial={{
          domain: question.domain,
          objective: question.objectifCMC,
          question: question.question,
          options: question.options,
          sources: question.options.map((_, i) => i),
          keyIndex: Math.max(
            0,
            question.options.indexOf(question.correctAnswer),
          ),
          explanation: question.explanation,
          references: question.references?.length ? question.references : [""],
          statementImages: toFormImages(question.images),
          explanationImages: toFormImages(question.explanationImages),
        }}
        objectivesByDomain={objectivesByDomain}
        list={list}
        edit={{
          title: questionTitle(question.createdAt),
          pastCounts: breakdown.options.map((o) => o.count),
          originalOptions: question.options,
          originalKeyIndex: question.options.indexOf(question.correctAnswer),
          confirmation: review.confirmation,
          lockingExam: lockingExam
            ? { title: lockingExam.title, endDate: lockingExam.endDate }
            : null,
        }}
      />
    </div>
  )
}
