"use client"

import { IconReceipt } from "@tabler/icons-react"
import { Plus } from "lucide-react"
import { motion } from "motion/react"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { DeleteTransactionDialog } from "@/components/shared/payments/delete-transaction-dialog"
import { EditTransactionModal } from "@/components/shared/payments/edit-transaction-modal"
import { ManualPaymentModal } from "@/components/shared/payments/manual-payment-modal"
import {
  type Transaction,
  TransactionTable,
  adminTransactionToRow,
} from "@/components/shared/payments/transaction-table"
import { Button } from "@/components/ui/button"
import {
  loadAdminTransactions,
  loadTransactionStats,
} from "@/features/payments/actions"
import type {
  AdminTransactionView,
  ProductView,
  TransactionStatsView,
} from "@/features/payments/dal"
import type { SelectableUser } from "@/features/users/dal"
import {
  TransactionFilters,
  type TransactionStatusFilter,
  type TransactionTypeFilter,
} from "./transaction-filters"
import { TransactionStats } from "./transaction-stats"

interface TransactionsManagerProps {
  initialItems: AdminTransactionView[]
  initialCursor: string | null
  initialStats: TransactionStatsView
  products: ProductView[]
  users: SelectableUser[]
}

export const TransactionsManager = ({
  initialItems,
  initialCursor,
  initialStats,
  products,
  users,
}: TransactionsManagerProps) => {
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>("all")
  const [statusFilter, setStatusFilter] =
    useState<TransactionStatusFilter>("all")
  const [searchQuery, setSearchQuery] = useState("")

  const [items, setItems] = useState<Transaction[]>(() =>
    initialItems.map(adminTransactionToRow),
  )
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [stats, setStats] = useState<TransactionStatsView>(initialStats)
  const [isPending, startTransition] = useTransition()

  const [showManualPaymentModal, setShowManualPaymentModal] = useState(false)
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null)
  const [deletingTransaction, setDeletingTransaction] =
    useState<Transaction | null>(null)

  // Charge la 1re page d'un jeu de filtres (les filtres serveur ne peuvent pas
  // s'appliquer côté client sur une pagination keyset).
  const applyFilters = (
    type: TransactionTypeFilter,
    status: TransactionStatusFilter,
  ) => {
    startTransition(async () => {
      try {
        const page = await loadAdminTransactions({
          type: type === "all" ? undefined : type,
          status: status === "all" ? undefined : status,
        })
        setItems(page.items.map(adminTransactionToRow))
        setCursor(page.nextCursor)
      } catch {
        toast.error("Actualisation impossible. Vérifiez votre réseau.")
      }
    })
  }

  const handleTypeChange = (value: TransactionTypeFilter) => {
    setTypeFilter(value)
    applyFilters(value, statusFilter)
  }

  const handleStatusChange = (value: TransactionStatusFilter) => {
    setStatusFilter(value)
    applyFilters(typeFilter, value)
  }

  const handleClearFilters = () => {
    setTypeFilter("all")
    setStatusFilter("all")
    setSearchQuery("")
    applyFilters("all", "all")
  }

  const handleLoadMore = () => {
    if (!cursor) return
    startTransition(async () => {
      try {
        const page = await loadAdminTransactions({
          type: typeFilter === "all" ? undefined : typeFilter,
          status: statusFilter === "all" ? undefined : statusFilter,
          cursor,
        })
        setItems((prev) => [...prev, ...page.items.map(adminTransactionToRow)])
        setCursor(page.nextCursor)
      } catch {
        toast.error("Impossible de charger plus de transactions.")
      }
    })
  }

  // Après une mutation : recharge la 1re page des filtres courants + les stats.
  const refresh = () => {
    startTransition(async () => {
      try {
        const [page, freshStats] = await Promise.all([
          loadAdminTransactions({
            type: typeFilter === "all" ? undefined : typeFilter,
            status: statusFilter === "all" ? undefined : statusFilter,
          }),
          loadTransactionStats(),
        ])
        setItems(page.items.map(adminTransactionToRow))
        setCursor(page.nextCursor)
        setStats(freshStats)
      } catch {
        toast.error("Actualisation impossible. Vérifiez votre réseau.")
      }
    })
  }

  // Recherche client sur la page chargée (parité avec l'ancien comportement).
  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return items
    const query = searchQuery.toLowerCase()
    return items.filter((tx) => {
      const userName = tx.user?.name?.toLowerCase() ?? ""
      const userEmail = tx.user?.email?.toLowerCase() ?? ""
      const productName = tx.product?.name?.toLowerCase() ?? ""
      return (
        userName.includes(query) ||
        userEmail.includes(query) ||
        productName.includes(query)
      )
    })
  }, [items, searchQuery])

  const hasActiveFilters =
    typeFilter !== "all" || statusFilter !== "all" || Boolean(searchQuery)

  return (
    <>
      <AdminPageHeader
        icon={IconReceipt}
        title="Transactions"
        subtitle="Gérez les paiements et enregistrez les transactions manuelles"
        colorScheme="amber"
        actions={
          <Button
            onClick={() => setShowManualPaymentModal(true)}
            className="bg-linear-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25 transition-all hover:from-amber-600 hover:to-orange-700 hover:shadow-xl hover:shadow-amber-500/30"
          >
            <Plus className="mr-2 h-4 w-4" />
            Paiement manuel
          </Button>
        }
      />

      <TransactionStats stats={stats} />

      <TransactionFilters
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        searchQuery={searchQuery}
        onTypeChange={handleTypeChange}
        onStatusChange={handleStatusChange}
        onSearchChange={setSearchQuery}
        onClearFilters={handleClearFilters}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <TransactionTable
          transactions={filteredTransactions}
          showUserColumn
          isLoading={isPending}
          onLoadMore={handleLoadMore}
          hasMore={cursor !== null}
          onEditTransaction={setEditingTransaction}
          onDeleteTransaction={setDeletingTransaction}
          emptyMessage={
            hasActiveFilters
              ? "Aucune transaction ne correspond aux filtres"
              : "Aucune transaction enregistrée"
          }
        />
      </motion.div>

      <ManualPaymentModal
        open={showManualPaymentModal}
        onOpenChange={setShowManualPaymentModal}
        products={products}
        users={users}
        onSuccess={refresh}
      />

      <EditTransactionModal
        transaction={editingTransaction}
        open={editingTransaction !== null}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
        onSuccess={() => {
          setEditingTransaction(null)
          refresh()
        }}
      />

      <DeleteTransactionDialog
        transaction={deletingTransaction}
        open={deletingTransaction !== null}
        onOpenChange={(open) => !open && setDeletingTransaction(null)}
        onSuccess={() => {
          setDeletingTransaction(null)
          refresh()
        }}
      />
    </>
  )
}
