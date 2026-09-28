"use client"

import { fr } from "date-fns/locale"
import { Calendar as CalendarIcon, X } from "lucide-react"
import { useState } from "react"
import { DateRange } from "react-day-picker"
import { SearchInput } from "@/components/shared/search-input"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCalendarDay } from "@/lib/format"
import { cn } from "@/lib/utils"

export type RoleFilter = "all" | "admin" | "user"
export type AccessStatusFilter =
  "all" | "active" | "expiring" | "expired" | "never"

interface UsersFilterBarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  role: RoleFilter
  onRoleChange: (value: RoleFilter) => void
  accessStatus: AccessStatusFilter
  onAccessStatusChange: (value: AccessStatusFilter) => void
  dateRange: DateRange | undefined
  onDateRangeChange: (range: DateRange | undefined) => void
  isSearching?: boolean
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export function UsersFilterBar({
  searchQuery,
  onSearchChange,
  role,
  onRoleChange,
  accessStatus,
  onAccessStatusChange,
  dateRange,
  onDateRangeChange,
  isSearching,
  onClearFilters,
  hasActiveFilters,
}: UsersFilterBarProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  const handlePresetClick = (
    preset: "this_month" | "last_30" | "last_90" | "all",
  ) => {
    const now = new Date()

    switch (preset) {
      case "this_month":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        onDateRangeChange({ from: startOfMonth, to: now })
        break
      case "last_30":
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        onDateRangeChange({ from: thirtyDaysAgo, to: now })
        break
      case "last_90":
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        onDateRangeChange({ from: ninetyDaysAgo, to: now })
        break
      case "all":
        onDateRangeChange(undefined)
        break
    }
    setIsCalendarOpen(false)
  }

  const formatDateRange = () => {
    if (!dateRange?.from) return "Toutes les dates"
    if (!dateRange.to) return formatCalendarDay(dateRange.from)
    return `${formatCalendarDay(dateRange.from, { year: false })} - ${formatCalendarDay(dateRange.to)}`
  }

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-gray-700/50 dark:bg-gray-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* Search */}
        <SearchInput
          placeholder="Rechercher par nom, email ou username..."
          value={searchQuery}
          onValueChange={onSearchChange}
          containerClassName="flex-1"
          className="h-10 pr-4"
          isSearching={isSearching}
        />

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role filter */}
          <Select
            value={role}
            onValueChange={(v) => onRoleChange(v as RoleFilter)}
          >
            <SelectTrigger className="h-10 w-35">
              <SelectValue placeholder="Rôle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les rôles</SelectItem>
              <SelectItem value="admin">Administrateur</SelectItem>
              <SelectItem value="user">Utilisateur</SelectItem>
            </SelectContent>
          </Select>

          {/* Access status filter */}
          <Select
            value={accessStatus}
            onValueChange={(v) => onAccessStatusChange(v as AccessStatusFilter)}
          >
            <SelectTrigger className="h-10 w-40">
              <SelectValue placeholder="Statut accès" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Accès actif</SelectItem>
              <SelectItem value="expiring">Expire bientôt</SelectItem>
              <SelectItem value="expired">Expiré</SelectItem>
              <SelectItem value="never">Jamais eu d&apos;accès</SelectItem>
            </SelectContent>
          </Select>

          {/* Date range filter */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-10 w-50 justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formatDateRange()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex">
                {/* Presets */}
                <div className="flex flex-col gap-1 border-r p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={() => handlePresetClick("this_month")}
                  >
                    Ce mois
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={() => handlePresetClick("last_30")}
                  >
                    30 derniers jours
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={() => handlePresetClick("last_90")}
                  >
                    90 derniers jours
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={() => handlePresetClick("all")}
                  >
                    Toutes les dates
                  </Button>
                </div>

                {/* Calendar */}
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={onDateRangeChange}
                  numberOfMonths={1}
                  locale={fr}
                />
              </div>
            </PopoverContent>
          </Popover>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-10 gap-1.5 text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
              Effacer
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
