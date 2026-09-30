import type { Metadata } from "next"
import {
  getAccessStatus,
  getAvailableProducts,
  getMyLapsedAccess,
  getMyTransactions,
} from "@/features/payments/dal"
import { requireSession } from "@/lib/auth-guards"
import { AbonnementsClient } from "../_components/abonnements-client"

export const metadata: Metadata = { title: "Abonnements" }

const one = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined

// La page de l'historique vit dans l'URL : `apres` / `avant` portent le
// curseur keyset du bord de la page voisine.
export default async function AbonnementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireSession()
  const params = await searchParams

  const [accessStatus, lapsed, transactions, products] = await Promise.all([
    getAccessStatus(),
    getMyLapsedAccess(),
    getMyTransactions({
      after: one(params.apres),
      before: one(params.avant),
    }),
    getAvailableProducts(),
  ])

  return (
    <AbonnementsClient
      accessStatus={accessStatus ?? { examAccess: null, trainingAccess: null }}
      lapsed={lapsed}
      transactions={transactions}
      products={products}
    />
  )
}
