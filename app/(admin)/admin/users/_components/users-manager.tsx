"use client"

import { IconUsers } from "@tabler/icons-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { DateRange } from "react-day-picker"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { ExportUsersButton } from "@/components/admin/export-users-button"
import { TablePagination } from "@/components/admin/table-pagination"
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
  initialTotal: number
  stats: UsersStatsView
  exportUsers: ExportUser[]
  products: ProductView[]
  selectableUsers: SelectableUser[]
}

export function UsersManager({
  initialUsers,
  initialTotal,
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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE)

  // Debounce ; le reset page se fait ICI (callback async → ESLint OK) pour
  // éviter un fetch superflu avec l'ancien terme sur une page > 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  const [role, setRole] = useState<RoleFilter>("all")
  const [accessStatus, setAccessStatus] = useState<AccessStatusFilter>("all")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [sortBy, setSortBy] = useState<SortBy>("name")
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")

  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers)
  const [total, setTotal] = useState(initialTotal)
  const [isPending, startTransition] = useTransition()

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

  // Recharge à chaque changement de filtre/tri/page/taille. Sauté au 1er rendu :
  // la page serveur a déjà fourni la page 1 sans filtre.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    startTransition(async () => {
      const res = await loadUsersPage({
        ...buildFilters(),
        offset: (page - 1) * pageSize,
        limit: pageSize,
      })
      setUsers(res.items)
      setTotal(res.total)
      // Clamp hors-borne (callback async → ESLint OK) : page devenue vide
      // après une mutation → ramène à la dernière page valide.
      if (res.items.length === 0 && page > 1 && res.total > 0) {
        setPage(Math.ceil(res.total / pageSize))
      }
    })
  }, [buildFilters, page, pageSize])

  // Recharge la page courante (après un octroi d'accès depuis le panneau).
  const reload = () => {
    startTransition(async () => {
      const res = await loadUsersPage({
        ...buildFilters(),
        offset: (page - 1) * pageSize,
        limit: pageSize,
      })
      setUsers(res.items)
      setTotal(res.total)
    })
  }

  // Chaque changement de filtre/tri repart page 1 (setter, pas effet).
  const handleRoleChange = (r: RoleFilter) => {
    setRole(r)
    setPage(1)
  }

  const handleAccessStatusChange = (s: AccessStatusFilter) => {
    setAccessStatus(s)
    setPage(1)
  }

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range)
    setPage(1)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setPage(1)
  }

  const handleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortOrder((order) => (order === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
    setPage(1)
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
    setPage(1)
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
        onRoleChange={handleRoleChange}
        accessStatus={accessStatus}
        onAccessStatusChange={handleAccessStatusChange}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
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
        page={page}
        pageSize={pageSize}
      />

      {total > 0 && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          isLoading={isPending}
          itemNoun={{ one: "utilisateur", many: "utilisateurs" }}
        />
      )}

      <UserSidePanel
        userId={selectedUserId}
        open={isPanelOpen}
        onOpenChange={handlePanelClose}
        products={products}
        users={selectableUsers}
        onMutated={reload}
      />
    </>
  )
}
