"use client"

import { useState, useMemo } from "react"
import { usePaginatedQuery } from "convex/react"
import { motion } from "motion/react"
import { Plus } from "lucide-react"
import { IconReceipt } from "@tabler/icons-react"
import { api } from "@/convex/_generated/api"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { Button } from "@/components/ui/button"
import { TransactionTable, type Transaction } from "@/components/shared/payments/transaction-table"
import { ManualPaymentModal } from "@/components/shared/payments/manual-payment-modal"
import { EditTransactionModal } from "@/components/shared/payments/edit-transaction-modal"
import { DeleteTransactionDialog } from "@/components/shared/payments/delete-transaction-dialog"
import { TransactionStats } from "./_components/transaction-stats"
import {
  TransactionFilters,
  type TransactionTypeFilter,
  type TransactionStatusFilter,
} from "./_components/transaction-filters"

export default function AdminTransactionsPage() {
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>("all")
  const [statusFilter, setStatusFilter] = useState<TransactionStatusFilter>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [showManualPaymentModal, setShowManualPaymentModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null)

  // Build query args
  const queryArgs: {
    type?: "stripe" | "manual"
    status?: "pending" | "completed" | "failed" | "refunded"
  } = {
    ...(typeFilter !== "all" && { type: typeFilter }),
    ...(statusFilter !== "all" && { status: statusFilter }),
  }

  const {
    results: transactions,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.payments.getAllTransactions,
    queryArgs,
    { initialNumItems: 20 }
  )

  // Client-side search filtering
  const filteredTransactions = useMemo(() => {
    if (!transactions || !searchQuery) return transactions || []

    const query = searchQuery.toLowerCase()
    return transactions.filter((tx) => {
      const userName = tx.user?.name?.toLowerCase() || ""
      const userEmail = tx.user?.email?.toLowerCase() || ""
      const productName = tx.product?.name?.toLowerCase() || ""

      return (
        userName.includes(query) ||
        userEmail.includes(query) ||
        productName.includes(query)
      )
    })
  }, [transactions, searchQuery])

  const handleClearFilters = () => {
    setTypeFilter("all")
    setStatusFilter("all")
    setSearchQuery("")
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* Header */}
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

      {/* Stats cards */}
      <TransactionStats />

      {/* Filters */}
      <TransactionFilters
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        searchQuery={searchQuery}
        onTypeChange={setTypeFilter}
        onStatusChange={setStatusFilter}
        onSearchChange={setSearchQuery}
        onClearFilters={handleClearFilters}
      />

      {/* Transactions table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <TransactionTable
          transactions={filteredTransactions}
          showUserColumn
          isLoading={status === "LoadingFirstPage"}
          onLoadMore={() => loadMore(20)}
          hasMore={status === "CanLoadMore"}
          onEditTransaction={setEditingTransaction}
          onDeleteTransaction={setDeletingTransaction}
          emptyMessage={
            typeFilter !== "all" || statusFilter !== "all" || searchQuery
              ? "Aucune transaction ne correspond aux filtres"
              : "Aucune transaction enregistrée"
          }
        />
      </motion.div>

      {/* Manual payment modal */}
      <ManualPaymentModal
        open={showManualPaymentModal}
        onOpenChange={setShowManualPaymentModal}
        onSuccess={() => {
          // Table will auto-refresh due to Convex reactivity
        }}
      />

      {/* Edit transaction modal */}
      <EditTransactionModal
        transaction={editingTransaction}
        open={editingTransaction !== null}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
        onSuccess={() => {
          setEditingTransaction(null)
        }}
      />

      {/* Delete transaction dialog */}
      <DeleteTransactionDialog
        transaction={deletingTransaction}
        open={deletingTransaction !== null}
        onOpenChange={(open) => !open && setDeletingTransaction(null)}
        onSuccess={() => {
          setDeletingTransaction(null)
        }}
      />
    </div>
  )
}
