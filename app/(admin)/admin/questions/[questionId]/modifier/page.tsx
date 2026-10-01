import type { Metadata } from "next"
import { questionTitle } from "@/components/admin/question-detail/labels"
import { getQuestionAnswerBreakdown } from "@/features/analytics/dal"
import {
  type QuestionImageView,
  getObjectivesByDomain,
  getQuestionById,
  getQuestionExams,
} from "@/features/questions/dal"
import { requireRole } from "@/lib/auth-guards"
import { cdnUrl } from "@/lib/cdn"
import { currentTimeMs } from "@/lib/clock"
import { QuestionForm } from "../../_components/question-form"
import { QuestionNotFound } from "../../_components/question-not-found"
import { lockingExamOf, reviewOf } from "../../_components/question-page-data"
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

  if (!question) return <QuestionNotFound listHref={questionListHref(list)} />

  const now = currentTimeMs()
  const lockingExam = lockingExamOf(exams, now)
  const review = reviewOf(question, breakdown)

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
          // Une clé absente des choix (donnée héritée) n'en désigne aucun.
          keyIndex: question.options.includes(question.correctAnswer)
            ? question.options.indexOf(question.correctAnswer)
            : null,
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
