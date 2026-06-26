import { ArrowLeft, User } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  getAccessStatus,
  getAllTransactions,
  getAvailableProducts,
} from "@/features/payments/dal"
import { getSelectableUsers, getUserForAdmin } from "@/features/users/dal"
import { requireRole } from "@/lib/auth-guards"
import { UserDetailClient } from "./user-detail-client"

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // H3 (IDOR) : garde admin explicite avant de manipuler un userId arbitraire,
  // en plus du layout admin et des gardes internes du DAL.
  await requireRole(["admin"])
  const { id } = await params

  const user = await getUserForAdmin(id)
  if (!user) {
    return (
      <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/users">
            <Button variant="outline" size="icon" className="rounded-xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Utilisateur non trouvé
          </h1>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-16 dark:border-gray-700">
          <User className="mb-4 h-12 w-12 text-gray-400" />
          <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
            Cet utilisateur n{"'"}existe pas
          </p>
          <Link href="/admin/users" className="mt-4">
            <Button variant="outline" className="rounded-xl">
              Retour à la liste
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const [access, txPage, products, selectableUsers] = await Promise.all([
    getAccessStatus(id),
    getAllTransactions({ userId: id, limit: 10 }),
    getAvailableProducts(),
    getSelectableUsers(),
  ])

  return (
    <UserDetailClient
      user={user}
      initialAccess={access ?? { examAccess: null, trainingAccess: null }}
      initialTransactions={txPage.items}
      initialCursor={txPage.nextCursor}
      products={products}
      selectableUsers={selectableUsers}
    />
  )
}
