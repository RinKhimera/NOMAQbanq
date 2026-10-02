import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  getAdminExam,
  getExamAudience,
  getExamFigures,
  getExamLeaderboard,
} from "@/features/exams/dal"
import { currentTimeMs } from "@/lib/clock"
import { ExamDetailClient } from "./_components/exam-detail-client"

export const metadata: Metadata = { title: "Examen blanc" }

export default async function AdminExamDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [data, figures, leaderboard] = await Promise.all([
    getAdminExam(id),
    getExamFigures(id),
    getExamLeaderboard(id),
  ])
  if (!data || !figures) notFound()

  const audience =
    data.exam.audienceType === "restricted" ? await getExamAudience(id) : []

  return (
    <ExamDetailClient
      exam={data.exam}
      figures={figures}
      leaderboard={leaderboard}
      audience={audience}
      initialNow={currentTimeMs()}
    />
  )
}
