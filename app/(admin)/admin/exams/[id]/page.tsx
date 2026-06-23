import { notFound } from "next/navigation"
import {
  getEligibleExamCandidates,
  getExamLeaderboard,
  getExamWithQuestions,
} from "@/features/exams/dal"
import { getCurrentSession } from "@/lib/dal"
import { ExamDetailsClient } from "./_components/exam-details-client"

export default async function AdminExamDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getExamWithQuestions(id)
  if (!data) notFound()

  const [leaderboard, candidates, session] = await Promise.all([
    getExamLeaderboard(id),
    getEligibleExamCandidates(),
    getCurrentSession(),
  ])

  return (
    <ExamDetailsClient
      examId={id}
      exam={data.exam}
      questions={data.questions}
      leaderboard={leaderboard}
      candidates={candidates}
      currentUserId={session?.user?.id}
    />
  )
}
