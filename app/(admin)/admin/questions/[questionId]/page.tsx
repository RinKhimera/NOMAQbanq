import type { Metadata } from "next"
import { getQuestionAnswerBreakdown } from "@/features/analytics/dal"
import {
  getQuestionById,
  getQuestionExams,
  getQuestionNeighbors,
} from "@/features/questions/dal"
import { diagnoseCorrection } from "@/features/questions/normalization"
import { requireRole } from "@/lib/auth-guards"
import { currentTimeMs } from "@/lib/clock"
import { QuestionNotFound } from "../_components/question-not-found"
import { lockingExamOf, reviewOf } from "../_components/question-page-data"
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

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <QuestionDetailClient
        file={{
          question,
          breakdown,
          exams,
          review: reviewOf(question, breakdown),
          formatIssues: diagnoseCorrection({
            explanation: question.explanation,
            references: question.references ?? [],
          }),
        }}
        list={list}
        neighbors={neighbors}
        lockingExam={lockingExamOf(exams, now)}
        initialNow={now}
      />
    </div>
  )
}
