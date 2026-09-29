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

export default async function AbonnementsPage() {
  await requireSession()

  const [accessStatus, lapsed, initialTransactions, products] =
    await Promise.all([
      getAccessStatus(),
      getMyLapsedAccess(),
      getMyTransactions({ limit: 5 }),
      getAvailableProducts(),
    ])

  return (
    <AbonnementsClient
      accessStatus={accessStatus ?? { examAccess: null, trainingAccess: null }}
      lapsed={lapsed}
      initialTransactions={initialTransactions}
      products={products}
    />
  )
}
