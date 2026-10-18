import type { Metadata } from "next"
import { getStudentProgressList } from "@/features/analytics/dal.admin-progression"
import { STUDENT_PROGRESS_PAGE_SIZE } from "@/lib/admin-progression"
import { ProgressionListClient } from "./_components/progression-list-client"
import {
  parseProgressionList,
  toProgressFilters,
  toSearchParams,
} from "./_components/progression-params"

export const metadata: Metadata = { title: "Progression" }

// L'état du tableau (recherche, filtres, période, tri, page) vit dans l'URL :
// chaque changement recharge la page serveur, 20 lignes par page.
export default async function AdminProgressionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const state = parseProgressionList(toSearchParams(await searchParams))
  const page = await getStudentProgressList({
    ...toProgressFilters(state),
    offset: (state.page - 1) * STUDENT_PROGRESS_PAGE_SIZE,
  })

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      <ProgressionListClient state={state} page={page} />
    </div>
  )
}
