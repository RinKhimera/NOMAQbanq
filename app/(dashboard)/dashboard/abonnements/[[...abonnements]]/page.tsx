import {
  getAccessStatus,
  getAvailableProducts,
  getMyTransactions,
} from "@/features/payments/dal"
import { requireSession } from "@/lib/auth-guards"
import { AbonnementsClient } from "../_components/abonnements-client"

export default async function AbonnementsPage() {
  // Garde la page (le layout dashboard ne force pas l'auth côté serveur).
  await requireSession()

  const [accessStatus, initialTransactions, products] = await Promise.all([
    getAccessStatus(),
    getMyTransactions({ limit: 5 }),
    getAvailableProducts(),
  ])

  return (
    <AbonnementsClient
      accessStatus={accessStatus ?? { examAccess: null, trainingAccess: null }}
      initialTransactions={initialTransactions}
      products={products}
    />
  )
}
