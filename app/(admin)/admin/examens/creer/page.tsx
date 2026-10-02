import {
  type ExamReopeningSource,
  getEligibleSubscriberCount,
  getExamReopeningSource,
} from "@/features/exams/dal"
import { getExamSelection } from "@/features/questions/dal"
import { currentTimeMs } from "@/lib/clock"
import { isOpen } from "@/lib/exam-phase"
import { ExamForm } from "../_components/exam-form"
import {
  blankExamForm,
  examFormFromSource,
} from "../_components/exam-form-model"

/**
 * Examen source d'une réouverture (`?source=<id>`). Une source introuvable ou
 * encore ouverte donne un formulaire vide, sans erreur.
 */
const loadReopeningSource = async (
  sourceId: string | undefined,
  now: number,
): Promise<ExamReopeningSource | null> => {
  if (!sourceId) return null
  const source = await getExamReopeningSource(sourceId)
  if (!source || isOpen(source.exam, now)) return null
  return source
}

export default async function AdminCreateExamPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string | string[] }>
}) {
  const { source: param } = await searchParams
  const sourceId = typeof param === "string" ? param : undefined
  const now = currentTimeMs()
  const [subscriberCount, source] = await Promise.all([
    getEligibleSubscriberCount(),
    loadReopeningSource(sourceId, now),
  ])
  // Le résumé du jeu repris : les questions de la source, sauf les supprimées.
  const kept = new Set(source?.questionIds)
  const selection =
    source && sourceId
      ? (await getExamSelection(sourceId, { countSelf: true })).filter((q) =>
          kept.has(q.id),
        )
      : []

  return (
    <ExamForm
      key={source ? sourceId : "vierge"}
      initialNow={now}
      subscriberCount={subscriberCount}
      initialValues={source ? examFormFromSource(source) : blankExamForm()}
      saved={null}
      selection={selection}
      reopening={
        source
          ? { title: source.exam.title, questionIds: source.questionIds }
          : null
      }
    />
  )
}
