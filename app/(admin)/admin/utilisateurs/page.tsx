import type { Metadata } from "next"
import { getUsersHeadline, getUsersWithFilters } from "@/features/users/dal"
import { currentTimeMs } from "@/lib/clock"
import { parseUserList, toUsersFilters } from "./_components/user-params"
import { UsersClient } from "./_components/users-client"

export const metadata: Metadata = { title: "Utilisateurs" }

// L'état de la liste (recherche, filtres, segment, tri, page) vit dans l'URL :
// chaque changement recharge la page serveur, 20 lignes par page.
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  const params = new URLSearchParams(
    Object.entries(raw).flatMap(([k, v]) =>
      typeof v === "string" ? [[k, v]] : [],
    ),
  )
  const state = parseUserList(params)
  const now = currentTimeMs()

  const [page, headline] = await Promise.all([
    getUsersWithFilters({
      ...toUsersFilters(state, now),
      sortBy: state.sort,
      sortOrder: state.order,
      offset: (state.page - 1) * 20,
    }),
    getUsersHeadline(),
  ])

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      <UsersClient
        state={state}
        page={page}
        headline={headline}
        initialNow={now}
      />
    </div>
  )
}
