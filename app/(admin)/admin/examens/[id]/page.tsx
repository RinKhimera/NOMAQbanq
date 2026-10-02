import { notFound } from "next/navigation"
import {
  getAdminExam,
  getEligibleExamCandidates,
  getExamAudience,
  getExamLeaderboard,
} from "@/features/exams/dal"
import { currentTimeMs } from "@/lib/clock"
import { getCurrentSession } from "@/lib/dal"
import { ExamDetailsClient } from "./_components/exam-details-client"

export default async function AdminExamDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getAdminExam(id)
  if (!data) notFound()

  const [leaderboard, candidates, audience, session] = await Promise.all([
    getExamLeaderboard(id),
    getEligibleExamCandidates(),
    getExamAudience(id),
    getCurrentSession(),
  ])

  return (
    <ExamDetailsClient
      examId={id}
      exam={data.exam}
      questions={data.questions}
      leaderboard={leaderboard}
      candidates={candidates}
      audience={audience}
      currentUserId={session?.user?.id}
      initialNow={currentTimeMs()}
    />
  )
}
