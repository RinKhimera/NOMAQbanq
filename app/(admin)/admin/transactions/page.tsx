import {
  getAllTransactions,
  getAvailableProducts,
  getTransactionStats,
} from "@/features/payments/dal"
import { getSelectableUsers } from "@/features/users/dal"
import { TransactionsManager } from "./_components/transactions-manager"

// Données initiales chargées côté serveur (DAL admin, garde `requireRole` interne).
// Le manager client gère ensuite filtres / pagination / mutations via Server Actions.
export default async function AdminTransactionsPage() {
  const [initialPage, stats, products, users] = await Promise.all([
    getAllTransactions({ limit: 20 }),
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
        products={products}
        users={users}
      />
    </div>
  )
}
