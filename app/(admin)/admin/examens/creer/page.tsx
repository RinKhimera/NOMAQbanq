import {
  getEligibleExamCandidates,
  getExamReopeningSource,
  getExamsForPicker,
} from "@/features/exams/dal"
import { currentTimeMs } from "@/lib/clock"
import { isOpen } from "@/lib/exam-phase"
import { ExamForm, type ExamFormSource } from "../_components/exam-form"

/**
 * Examen source d'une réouverture (`?source=<id>`). Une source introuvable ou
 * encore ouverte donne un formulaire vide, sans erreur.
 */
const loadReopeningSource = async (
  sourceId: string | undefined,
): Promise<ExamFormSource | undefined> => {
  if (!sourceId) return undefined
  const source = await getExamReopeningSource(sourceId)
  if (!source || isOpen(source.exam, currentTimeMs())) return undefined
  return source
}

export default async function AdminCreateExamPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string | string[] }>
}) {
  const { source: param } = await searchParams
  const sourceId = typeof param === "string" ? param : undefined
  const [candidates, examOptions, source] = await Promise.all([
    getEligibleExamCandidates(),
    getExamsForPicker(),
    loadReopeningSource(sourceId),
  ])

  return (
    <ExamForm
      key={source ? sourceId : "vierge"}
      mode="create"
      candidates={candidates}
      examOptions={examOptions}
      source={source}
    />
  )
}
