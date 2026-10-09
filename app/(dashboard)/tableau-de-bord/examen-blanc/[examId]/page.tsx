import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { STUDENT_EXAMS_HREF } from "@/constants/exam-routes"
import { getMyExamPercentile } from "@/features/analytics/dal"
import { getExamRanking } from "@/features/exams/dal"
import { ExamRankingView } from "./_components/exam-ranking-view"

export const metadata: Metadata = { title: "Classement de l'examen" }

/**
 * Classement d'un examen clos, pour un candidat qui l'a terminé (ou un
 * admin). Tout autre lecteur retrouve la liste, comme avant que la page
 * n'existe.
 */
export default async function StudentExamRankingPage({
  params,
}: {
  params: Promise<{ examId: string }>
}) {
  const { examId } = await params
  const [ranking, percentile] = await Promise.all([
    getExamRanking(examId),
    getMyExamPercentile(examId),
  ])
  if (!ranking) redirect(STUDENT_EXAMS_HREF)

  return <ExamRankingView ranking={ranking} percentile={percentile} />
}
