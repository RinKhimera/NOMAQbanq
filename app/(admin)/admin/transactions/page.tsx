import {
  getAllTransactions,
  getAvailableProducts,
  getTransactionStats,
} from "@/features/payments/dal"
import { getSelectableUsers } from "@/features/users/dal"
import { TransactionsManager } from "./_components/transactions-manager"

const TYPES = ["stripe", "manual"] as const
const STATUSES = ["pending", "completed", "failed", "refunded"] as const

// Données initiales chargées côté serveur (DAL admin, garde `requireRole` interne).
// Les filtres type/status sont dérivés de l'URL (deep-linking, rechargement sans
// perte) ; le manager client gère ensuite pagination / mutations via Server Actions.
export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>
}) {
  const params = await searchParams
  const type = TYPES.find((t) => t === params.type)
  const status = STATUSES.find((s) => s === params.status)

  const [initialPage, stats, products, users] = await Promise.all([
    getAllTransactions({ limit: 20, type, status }),
    getTransactionStats(),
    getAvailableProducts(),
    getSelectableUsers(),
  ])

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      <TransactionsManager
        initialItems={initialPage.items}
        initialCursor={initialPage.nextCursor}
        initialStats={stats}
        initialType={type}
        initialStatus={status}
        products={products}
        users={users}
      />
    </div>
  )
}
