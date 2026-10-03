import type { Metadata } from "next"
import { getObjectiveEntries } from "@/features/objectives/dal"
import { toSearchParams } from "../_components/question-params"
import { ObjectivesClient } from "./_components/objectives-client"
import { parseObjectivesState } from "./_components/objectives-model"

export const metadata: Metadata = { title: "Objectifs du CMC" }

export default async function ObjectivesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [entries, params] = await Promise.all([
    getObjectiveEntries(),
    searchParams,
  ])

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      <ObjectivesClient
        entries={entries}
        initialState={parseObjectivesState(toSearchParams(params))}
      />
    </div>
  )
}
