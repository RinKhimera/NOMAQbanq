"use client"

import type { ReactNode } from "react"
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table/data-table"
import {
  AccessBadge,
  getAccessStatus,
} from "@/components/shared/payments/access-badge"
import { RelativeTime } from "@/components/shared/relative-time"
import { BannedPill, RolePill } from "@/components/shared/status-pill"
import { UserAvatar } from "@/components/shared/user-avatar"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { AdminUserRow } from "@/features/users/dal"
import { formatLongDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

export type SortBy = "name" | "role" | "createdAt"
export type SortOrder = "asc" | "desc"

interface AccessInfo {
  expiresAt: number
  daysRemaining: number
}

export type EnrichedUser = AdminUserRow

interface UsersTableProps {
  users: EnrichedUser[]
  selectedUserId: string | null
  onUserSelect: (user: EnrichedUser) => void
  sortBy: SortBy
  sortOrder: SortOrder
  onSort: (field: SortBy) => void
  /** Rechargement en place (recherche, filtre, tri, page). */
  isPending?: boolean
  footer?: ReactNode
}

function UserAccessBadge({
  type,
  access,
}: {
  type: "exam" | "training"
  access: AccessInfo | null
}) {
  return (
    <AccessBadge
      accessType={type}
      status={getAccessStatus(access?.expiresAt, access?.daysRemaining)}
      daysRemaining={access?.daysRemaining}
      size="sm"
      showDetails
    />
  )
}

const hasName = (user: EnrichedUser) =>
  Boolean(user.name) && user.name !== "null null"

export function UsersTable({
  users,
  selectedUserId,
  onUserSelect,
  sortBy,
  sortOrder,
  onSort,
  isPending = false,
  footer,
}: UsersTableProps) {
  const sortOn = (field: SortBy) => ({
    direction: sortBy === field ? sortOrder : null,
    onToggle: () => onSort(field),
  })

  const columns: DataTableColumn<EnrichedUser>[] = [
    {
      id: "user",
      label: "Utilisateur",
      required: true,
      sort: sortOn("name"),
      cell: (user) => (
        <div className="flex items-center gap-3">
          <UserAvatar
            name={user.name}
            image={user.image}
            className="h-9 w-9 border border-gray-100 dark:border-gray-800"
            fallbackClassName="bg-linear-to-br from-blue-500 to-indigo-600 text-xs font-medium text-white"
          />
          <div className="flex flex-col">
            <span
              className={cn(
                "font-medium",
                hasName(user)
                  ? "text-gray-900 dark:text-white"
                  : "text-gray-400 italic",
              )}
            >
              {hasName(user) ? user.name : "Non défini"}
            </span>
            {user.username && (
              <span className="text-xs text-blue-600 dark:text-blue-400">
                @{user.username}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "email",
      label: "Email",
      visibleFrom: "medium",
      cellClassName: "text-gray-500",
      cell: (user) => <span className="max-w-50 truncate">{user.email}</span>,
    },
    {
      id: "role",
      label: "Rôle",
      visibleFrom: "medium",
      sort: sortOn("role"),
      cell: (user) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <RolePill role={user.role} />
          {user.banned && <BannedPill />}
        </div>
      ),
    },
    {
      id: "access",
      label: "Accès",
      cell: (user) => (
        <div className="flex gap-1.5">
          <UserAccessBadge type="exam" access={user.examAccess} />
          <UserAccessBadge type="training" access={user.trainingAccess} />
        </div>
      ),
    },
    {
      id: "createdAt",
      label: "Inscrit",
      visibleFrom: "wide",
      sort: sortOn("createdAt"),
      cellClassName: "text-gray-500",
      cell: (user) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                <RelativeTime timestamp={user.createdAt} />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{formatLongDateTime(user.createdAt)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={users}
      getRowId={(user) => user.id}
      preferencesKey="admin-users"
      isPending={isPending}
      onRowClick={onUserSelect}
      rowTone={(user) => (user.id === selectedUserId ? "active" : undefined)}
      empty={
        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-700/50 dark:bg-gray-900">
          <EmptyState size="compact" title="Aucun utilisateur trouvé" />
        </div>
      }
      footer={footer}
    />
  )
}
