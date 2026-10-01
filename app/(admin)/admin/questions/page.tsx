import type { Metadata } from "next"
import { getExamsForPicker } from "@/features/exams/dal"
import {
  getObjectivesByDomain,
  getQuestionList,
} from "@/features/questions/dal"
import { currentTimeMs } from "@/lib/clock"
import {
  parseQuestionList,
  toQuestionFilters,
  toSearchParams,
} from "./_components/question-params"
import { QuestionsClient } from "./_components/questions-client"

export const metadata: Metadata = { title: "Questions" }

// L'état de la liste (onglet, recherche, filtres, tri, page) vit dans l'URL :
// chaque changement recharge la page serveur, 20 lignes par page.
export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const state = parseQuestionList(toSearchParams(await searchParams))

  const [list, objectivesByDomain, exams] = await Promise.all([
    getQuestionList(toQuestionFilters(state)),
    getObjectivesByDomain(),
    getExamsForPicker(),
  ])

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      <QuestionsClient
        state={state}
        list={list}
        objectivesByDomain={objectivesByDomain}
        exams={exams}
        initialNow={currentTimeMs()}
      />
    </div>
  )
}
