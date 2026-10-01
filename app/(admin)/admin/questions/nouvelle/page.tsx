import type { Metadata } from "next"
import { getObjectivesByDomain } from "@/features/questions/dal"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"
import { QuestionForm } from "../_components/question-form"
import { blankQuestionForm } from "../_components/question-form-model"
import {
  parseQuestionList,
  toSearchParams,
} from "../_components/question-params"

export const metadata: Metadata = { title: "Nouvelle question" }

export default async function NewQuestionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireRole(["admin"])
  const list = parseQuestionList(toSearchParams(await searchParams))
  const objectivesByDomain = await getObjectivesByDomain()

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <QuestionForm
        mode="create"
        // Réservé dès l'ouverture : les images s'envoient avant la création.
        initialQuestionId={createId()}
        initial={blankQuestionForm()}
        objectivesByDomain={objectivesByDomain}
        list={list}
        edit={null}
      />
    </div>
  )
}
