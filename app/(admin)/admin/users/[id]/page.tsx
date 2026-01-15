"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, usePaginatedQuery } from "convex/react"
import { motion } from "motion/react"
import Link from "next/link"
import { ArrowLeft, User, CreditCard } from "lucide-react"
import { Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TransactionTable, ManualPaymentModal } from "@/components/shared/payments"
import { UserInfoCard } from "./_components/user-info-card"
import { UserAccessSection } from "./_components/user-access-section"

const PageSkeleton = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-4">
      <Skeleton className="h-9 w-9 rounded-xl" />
      <Skeleton className="h-8 w-48" />
    </div>
    <div className="grid gap-6 lg:grid-cols-3">
      <Skeleton className="h-80 rounded-2xl lg:col-span-1" />
      <div className="space-y-6 lg:col-span-2">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  </div>
)

export default function AdminUserDetailPage() {
  const params = useParams()
  const userId = params.id as Id<"users">

  const [showManualPaymentModal, setShowManualPaymentModal] = useState(false)

  const user = useQuery(api.users.getUserById, { userId })
  const {
    results: transactions,
    status: txStatus,
    loadMore,
  } = usePaginatedQuery(
    api.payments.getAllTransactions,
    { userId },
    { initialNumItems: 10 }
  )

  if (user === undefined) {
    return (
      <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
        <PageSkeleton />
      </div>
    )
  }

  if (user === null) {
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

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Link href="/admin/users">
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
        {/* Left column - User info */}
        <div className="lg:col-span-1">
          <UserInfoCard user={user} />
        </div>

        {/* Right column - Access and transactions */}
        <div className="space-y-6 lg:col-span-2">
          {/* Access status */}
          <UserAccessSection
            userId={userId}
            onAddAccess={() => setShowManualPaymentModal(true)}
          />

          {/* Transaction history */}
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
                  transactions={transactions || []}
                  isLoading={txStatus === "LoadingFirstPage"}
                  onLoadMore={() => loadMore(10)}
                  hasMore={txStatus === "CanLoadMore"}
                  emptyMessage="Aucune transaction pour cet utilisateur"
                />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Manual payment modal */}
      <ManualPaymentModal
        open={showManualPaymentModal}
        onOpenChange={setShowManualPaymentModal}
        defaultUserId={userId}
        onSuccess={() => {
          // Will auto-refresh due to Convex reactivity
        }}
      />
    </div>
  )
}
