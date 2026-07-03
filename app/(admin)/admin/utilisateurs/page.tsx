import { Suspense } from "react"
import { getAvailableProducts } from "@/features/payments/dal"
import {
  getSelectableUsers,
  getUsersForExport,
  getUsersStats,
  getUsersWithFilters,
} from "@/features/users/dal"
import { UsersManager } from "./_components/users-manager"

// Données initiales côté serveur (DAL admin, garde `requireRole`). Le manager
// client gère ensuite filtres / tri / pagination / panneau via Server Actions.
export default async function UsersPage() {
  const [usersPage, stats, exportUsers, products, selectableUsers] =
    await Promise.all([
      getUsersWithFilters({ limit: 50 }),
      getUsersStats(),
      getUsersForExport(),
      getAvailableProducts(),
      getSelectableUsers(),
    ])

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* useSearchParams (deep-link ?user=) → borné par Suspense. */}
      <Suspense fallback={null}>
        <UsersManager
          initialUsers={usersPage.items}
          initialTotal={usersPage.total}
          stats={stats}
          exportUsers={exportUsers}
          products={products}
          selectableUsers={selectableUsers}
        />
      </Suspense>
    </div>
  )
}
