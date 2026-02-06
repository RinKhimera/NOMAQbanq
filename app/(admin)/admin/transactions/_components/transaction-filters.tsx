"use client"

import { Search, Filter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type TransactionTypeFilter = "all" | "stripe" | "manual"
export type TransactionStatusFilter = "all" | "completed" | "pending" | "failed" | "refunded"

interface TransactionFiltersProps {
  typeFilter: TransactionTypeFilter
  statusFilter: TransactionStatusFilter
  searchQuery: string
  onTypeChange: (value: TransactionTypeFilter) => void
  onStatusChange: (value: TransactionStatusFilter) => void
  onSearchChange: (value: string) => void
  onClearFilters: () => void
}

const typeOptions = [
  { value: "all", label: "Tous les types" },
  { value: "stripe", label: "Stripe" },
  { value: "manual", label: "Manuel" },
]

const statusOptions = [
  { value: "all", label: "Tous les statuts" },
  { value: "completed", label: "Complété" },
  { value: "pending", label: "En attente" },
  { value: "failed", label: "Échoué" },
  { value: "refunded", label: "Remboursé" },
]

export const TransactionFilters = ({
  typeFilter,
  statusFilter,
  searchQuery,
  onTypeChange,
  onStatusChange,
  onSearchChange,
  onClearFilters,
}: TransactionFiltersProps) => {
  const hasActiveFilters =
    typeFilter !== "all" || statusFilter !== "all" || searchQuery !== ""

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-gray-700/50 dark:bg-gray-900 sm:flex-row sm:items-center">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Rechercher par email ou nom..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 rounded-xl border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50"
        />
      </div>

      {/* Filter icon on mobile */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 sm:hidden">
          <Filter className="h-4 w-4" />
          Filtres
        </div>

        {/* Type filter */}
        <Select
          value={typeFilter}
          onValueChange={(v) => onTypeChange(v as TransactionTypeFilter)}
        >
          <SelectTrigger className="w-35 rounded-xl border-gray-200 dark:border-gray-700">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusChange(v as TransactionStatusFilter)}
        >
          <SelectTrigger className="w-37.5 rounded-xl border-gray-200 dark:border-gray-700">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="rounded-xl text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="mr-1 h-4 w-4" />
            Effacer
          </Button>
        )}
      </div>
    </div>
  )
}
