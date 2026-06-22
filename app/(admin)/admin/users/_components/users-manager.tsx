"use client"

import { IconUsers } from "@tabler/icons-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { DateRange } from "react-day-picker"

import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { ExportUsersButton } from "@/components/admin/export-users-button"
import type { ProductView } from "@/features/payments/dal"
import { loadUsersPage } from "@/features/users/actions"
import type {
  AdminUserRow,
  ExportUser,
  SelectableUser,
  UsersStatsView,
} from "@/features/users/dal"

import { UserSidePanel } from "./user-side-panel"
import {
  type AccessStatusFilter,
  type RoleFilter,
  UsersFilterBar,
} from "./users-filter-bar"
import { UsersStatsRow } from "./users-stats-row"
import {
  type EnrichedUser,
  type SortBy,
  type SortOrder,
  UsersTable,
} from "./users-table"

const PAGE = 50

interface UsersManagerProps {
  initialUsers: AdminUserRow[]
  initialNextOffset: number | null
  stats: UsersStatsView
  exportUsers: ExportUser[]
  products: ProductView[]
  selectableUsers: SelectableUser[]
}

export function UsersManager({
  initialUsers,
  initialNextOffset,
  stats,
  exportUsers,
  products,
  selectableUsers,
}: UsersManagerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialUserId = searchParams.get("user")

  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  const [role, setRole] = useState<RoleFilter>("all")
  const [accessStatus, setAccessStatus] = useState<AccessStatusFilter>("all")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [sortBy, setSortBy] = useState<SortBy>("name")
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")

  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers)
  const [nextOffset, setNextOffset] = useState<number | null>(initialNextOffset)
  const [isPending, startTransition] = useTransition()
  const [isLoadingMore, startLoadMore] = useTransition()

  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialUserId,
  )
  const [isPanelOpen, setIsPanelOpen] = useState(!!initialUserId)

  const buildFilters = useCallback(
    () => ({
      search: debouncedSearch.trim() || undefined,
      role: role === "all" ? undefined : role,
      accessStatus: accessStatus === "all" ? undefined : accessStatus,
      dateFrom: dateRange?.from?.getTime(),
      dateTo: dateRange?.to?.getTime(),
      sortBy,
      sortOrder,
    }),
    [debouncedSearch, role, accessStatus, dateRange, sortBy, sortOrder],
  )

  // Recharge la 1re page à chaque changement de filtre/tri/recherche.
  // Sauté au 1er rendu : la page serveur a déjà fourni les données initiales.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    startTransition(async () => {
      const page = await loadUsersPage({
        ...buildFilters(),
        offset: 0,
        limit: PAGE,
      })
      setUsers(page.items)
      setNextOffset(page.nextOffset)
    })
  }, [buildFilters])

  const handleLoadMore = () => {
    if (nextOffset === null) return
    startLoadMore(async () => {
      const page = await loadUsersPage({
        ...buildFilters(),
        offset: nextOffset,
        limit: PAGE,
      })
      setUsers((prev) => [...prev, ...page.items])
      setNextOffset(page.nextOffset)
    })
  }

  // Recharge la page courante (après un octroi d'accès depuis le panneau).
  const reloadFirstPage = () => {
    startTransition(async () => {
      const page = await loadUsersPage({
        ...buildFilters(),
        offset: 0,
        limit: PAGE,
      })
      setUsers(page.items)
      setNextOffset(page.nextOffset)
    })
  }

  const handleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortOrder((order) => (order === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
  }

  const handleUserSelect = useCallback(
    (u: EnrichedUser) => {
      setSelectedUserId(u.id)
      setIsPanelOpen(true)
      const url = new URL(window.location.href)
      url.searchParams.set("user", u.id)
      router.replace(url.pathname + url.search, { scroll: false })
    },
    [router],
  )

  const handlePanelClose = useCallback(
    (open: boolean) => {
      setIsPanelOpen(open)
      if (!open) {
        setSelectedUserId(null)
        const url = new URL(window.location.href)
        url.searchParams.delete("user")
        router.replace(url.pathname + url.search, { scroll: false })
      }
    },
    [router],
  )

  const handleClearFilters = () => {
    setSearchQuery("")
    setRole("all")
    setAccessStatus("all")
    setDateRange(undefined)
    setSortBy("name")
    setSortOrder("asc")
  }

  const hasActiveFilters =
    searchQuery !== "" ||
    role !== "all" ||
    accessStatus !== "all" ||
    dateRange !== undefined

  return (
    <>
      <AdminPageHeader
        icon={IconUsers}
        title="Gestion des utilisateurs"
        subtitle="Consultez et gérez les utilisateurs de la plateforme"
        colorScheme="violet"
        actions={
          exportUsers.length > 0 ? (
            <ExportUsersButton users={exportUsers} />
          ) : undefined
        }
      />

      <UsersStatsRow stats={stats} />

      <UsersFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        role={role}
        onRoleChange={setRole}
        accessStatus={accessStatus}
        onAccessStatusChange={setAccessStatus}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        isSearching={isPending && debouncedSearch !== ""}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <UsersTable
        users={users}
        selectedUserId={selectedUserId}
        onUserSelect={handleUserSelect}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        isLoading={isPending}
        canLoadMore={nextOffset !== null}
        onLoadMore={handleLoadMore}
        isLoadingMore={isLoadingMore}
      />

      <UserSidePanel
        userId={selectedUserId}
        open={isPanelOpen}
        onOpenChange={handlePanelClose}
        products={products}
        users={selectableUsers}
        onMutated={reloadFirstPage}
      />
    </>
  )
}
