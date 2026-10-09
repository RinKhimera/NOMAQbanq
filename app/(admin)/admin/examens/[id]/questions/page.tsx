import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getAdminExam, getExamFigures } from "@/features/exams/dal"
import {
  BANK_PAGE_SIZE,
  getDomainPlan,
  getExamBank,
  getExamSelection,
} from "@/features/questions/dal"
import { currentTimeMs } from "@/lib/clock"
import { adminPhaseOf, isFinalizedOpen } from "@/lib/exam-phase"
import { toSearchParams } from "../../../questions/_components/question-params"
import { ComposerClient } from "./_components/composer-client"
import { parseComposer, toBankFilters } from "./_components/composer-params"

export const metadata: Metadata = { title: "Jeu de questions" }

// L'état de la banque (recherche, domaine, dernière utilisation, tri, page)
// vit dans l'URL : chaque changement recharge la page serveur.
export default async function ExamComposerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const state = parseComposer(toSearchParams(await searchParams))

  const [data, figures] = await Promise.all([
    getAdminExam(id),
    getExamFigures(id),
  ])
  if (!data || !figures) notFound()

  // Le jeu est figé dès la première participation, admin compris : la banque
  // ne sert plus.
  const frozen = figures.locked
  const [selection, plan, bank] = await Promise.all([
    getExamSelection(id),
    getDomainPlan(id),
    frozen ? null : getExamBank(id, toBankFilters(state)),
  ])

  const { exam } = data
  const now = currentTimeMs()

  return (
    <div className="flex flex-col p-4 lg:p-6">
      <ComposerClient
        exam={{
          id: exam.id,
          title: exam.title,
          targetQuestionCount: exam.targetQuestionCount,
          finalized: exam.finalizedAt !== null,
          openToStudents: isFinalizedOpen(exam, now),
          phase: adminPhaseOf(exam, now),
        }}
        frozen={frozen}
        state={state}
        selection={selection}
        plan={plan}
        bank={bank}
        bankPageSize={BANK_PAGE_SIZE}
        initialNow={now}
      />
    </div>
  )
}
