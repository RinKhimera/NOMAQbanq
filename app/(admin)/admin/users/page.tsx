"use client"

import { useState, useCallback, useEffect, useTransition } from "react"
import { useQuery, usePaginatedQuery } from "convex/react"
import { DateRange } from "react-day-picker"
import { useSearchParams, useRouter } from "next/navigation"
import { IconUsers } from "@tabler/icons-react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { ExportUsersButton } from "@/components/admin/export-users-button"
import { UsersStatsRow } from "./_components/users-stats-row"
import {
  UsersFilterBar,
  type RoleFilter,
  type AccessStatusFilter,
} from "./_components/users-filter-bar"
import {
  UsersTable,
  type EnrichedUser,
  type SortBy,
  type SortOrder,
} from "./_components/users-table"
import { UserSidePanel } from "./_components/user-side-panel"

export default function UsersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialize selected user from URL params
  const initialUserId = searchParams.get("user") as Id<"users"> | null

  // State for filters
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")

  // Debounce search to avoid excessive Convex queries
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])
  const [role, setRole] = useState<RoleFilter>("all")
  const [accessStatus, setAccessStatus] = useState<AccessStatusFilter>("all")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [sortBy, setSortBy] = useState<SortBy>("name")
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")

  // State for panel - initialize from URL
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(
    initialUserId,
  )
  const [isPanelOpen, setIsPanelOpen] = useState(!!initialUserId)

  // Transition for non-blocking filter updates
  const [, startTransition] = useTransition()

  // Stats query
  const stats = useQuery(api.users.getUsersStats)

  // Users query with filters using usePaginatedQuery
  const {
    results: users,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.users.getUsersWithFilters,
    {
      searchQuery: debouncedSearchQuery.trim() || undefined,
      role: role === "all" ? undefined : role,
      accessStatus: accessStatus === "all" ? undefined : accessStatus,
      dateFrom: dateRange?.from?.getTime(),
      dateTo: dateRange?.to?.getTime(),
      sortBy,
      sortOrder,
    },
    { initialNumItems: 50 }
  )

  // All users for export (legacy query)
  const allUsersForExport = useQuery(api.users.getAllUsers)

  // Handlers
  const handleSort = useCallback(
    (field: SortBy) => {
      startTransition(() => {
        if (sortBy === field) {
          // Same column - toggle order
          setSortOrder((order) => (order === "asc" ? "desc" : "asc"))
        } else {
          // Different column - set new column with default asc order
          setSortBy(field)
          setSortOrder("asc")
        }
      })
    },
    [sortBy, startTransition]
  )

  const handleUserSelect = useCallback(
    (user: EnrichedUser) => {
      setSelectedUserId(user._id)
      setIsPanelOpen(true)
      // Update URL without navigation
      const url = new URL(window.location.href)
      url.searchParams.set("user", user._id)
      router.replace(url.pathname + url.search, { scroll: false })
    },
    [router],
  )

  const handlePanelClose = useCallback(
    (open: boolean) => {
      setIsPanelOpen(open)
      if (!open) {
        setSelectedUserId(null)
        // Remove user param from URL
        const url = new URL(window.location.href)
        url.searchParams.delete("user")
        router.replace(url.pathname + url.search, { scroll: false })
      }
    },
    [router],
  )

  const handleClearFilters = useCallback(() => {
    startTransition(() => {
      setSearchQuery("")
      setRole("all")
      setAccessStatus("all")
      setDateRange(undefined)
      setSortBy("name")
      setSortOrder("asc")
    })
  }, [startTransition])

  const hasActiveFilters =
    searchQuery !== "" ||
    role !== "all" ||
    accessStatus !== "all" ||
    dateRange !== undefined

  const isLoading = status === "LoadingFirstPage"
  const canLoadMore = status === "CanLoadMore"
  const isLoadingMore = status === "LoadingMore"

  const handleLoadMore = useCallback(() => {
    if (canLoadMore) {
      loadMore(50)
    }
  }, [canLoadMore, loadMore])

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* Header */}
      <AdminPageHeader
        icon={IconUsers}
        title="Gestion des utilisateurs"
        subtitle="Consultez et gérez les utilisateurs de la plateforme"
        colorScheme="violet"
        actions={
          allUsersForExport && allUsersForExport.length > 0 ? (
            <ExportUsersButton users={allUsersForExport} />
          ) : undefined
        }
      />

      {/* Stats Row */}
      <UsersStatsRow stats={stats ?? null} isLoading={stats === undefined} />

      {/* Filter Bar */}
      <UsersFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        role={role}
        onRoleChange={setRole}
        accessStatus={accessStatus}
        onAccessStatusChange={setAccessStatus}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        isSearching={isLoading && debouncedSearchQuery !== ""}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Users Table */}
      <UsersTable
        users={users as EnrichedUser[]}
        selectedUserId={selectedUserId}
        onUserSelect={handleUserSelect}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        isLoading={isLoading}
        canLoadMore={canLoadMore}
        onLoadMore={handleLoadMore}
        isLoadingMore={isLoadingMore}
      />

      {/* Side Panel */}
      <UserSidePanel
        userId={selectedUserId}
        open={isPanelOpen}
        onOpenChange={handlePanelClose}
      />
    </div>
  )
}
