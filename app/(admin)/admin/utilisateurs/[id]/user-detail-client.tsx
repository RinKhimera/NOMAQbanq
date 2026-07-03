"use client"

import { ArrowLeft, CreditCard } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { useState, useTransition } from "react"
import { ManualPaymentModal } from "@/components/shared/payments/manual-payment-modal"
import {
  type Transaction,
  TransactionTable,
  adminTransactionToRow,
} from "@/components/shared/payments/transaction-table"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  loadAdminTransactions,
  loadUserAccessStatus,
} from "@/features/payments/actions"
import type {
  AccessStatus,
  AdminTransactionView,
  ProductView,
} from "@/features/payments/dal"
import type { AdminUserDetail, SelectableUser } from "@/features/users/dal"
import { UserAccessSection } from "./_components/user-access-section"
import { UserInfoCard } from "./_components/user-info-card"

interface UserDetailClientProps {
  user: AdminUserDetail
  initialAccess: AccessStatus
  initialTransactions: AdminTransactionView[]
  initialCursor: string | null
  products: ProductView[]
  selectableUsers: SelectableUser[]
}

export function UserDetailClient({
  user,
  initialAccess,
  initialTransactions,
  initialCursor,
  products,
  selectableUsers,
}: UserDetailClientProps) {
  const [showModal, setShowModal] = useState(false)
  const [access, setAccess] = useState<AccessStatus>(initialAccess)
  const [items, setItems] = useState<Transaction[]>(() =>
    initialTransactions.map(adminTransactionToRow),
  )
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [isLoadingMore, startLoadMore] = useTransition()
  const [, startRefresh] = useTransition()

  const handleLoadMore = () => {
    if (!cursor) return
    startLoadMore(async () => {
      const page = await loadAdminTransactions({ userId: user.id, cursor })
      setItems((prev) => [...prev, ...page.items.map(adminTransactionToRow)])
      setCursor(page.nextCursor)
    })
  }

  // Après un octroi : recharge transactions (1re page) + statut d'accès.
  const handlePaymentSuccess = () => {
    startRefresh(async () => {
      const [page, fresh] = await Promise.all([
        loadAdminTransactions({ userId: user.id }),
        loadUserAccessStatus(user.id),
      ])
      setItems(page.items.map(adminTransactionToRow))
      setCursor(page.nextCursor)
      setAccess(fresh)
    })
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Link href="/admin/utilisateurs">
          <Button variant="outline" size="icon" className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Détails de l{"'"}utilisateur
          </h1>
          <p className="text-muted-foreground">
            Consultez et gérez les informations de cet utilisateur
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <UserInfoCard user={user} />
        </div>

        <div className="space-y-6 lg:col-span-2">
          <UserAccessSection
            examAccess={access.examAccess}
            trainingAccess={access.trainingAccess}
            onAddAccess={() => setShowModal(true)}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="rounded-2xl border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-slate-600" />
                  Historique des transactions
                </CardTitle>
                <CardDescription>
                  Paiements et achats de cet utilisateur
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TransactionTable
                  transactions={items}
                  isLoading={isLoadingMore}
                  onLoadMore={handleLoadMore}
                  hasMore={cursor !== null}
                  emptyMessage="Aucune transaction pour cet utilisateur"
                />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <ManualPaymentModal
        open={showModal}
        onOpenChange={setShowModal}
        defaultUserId={user.id}
        products={products}
        users={selectableUsers}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  )
}
