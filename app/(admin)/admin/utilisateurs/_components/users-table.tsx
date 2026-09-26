"use client"

import { ShieldOff } from "lucide-react"
import type { ReactNode } from "react"
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table/data-table"
import { RelativeTime } from "@/components/shared/relative-time"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Badge } from "@/components/ui/badge"
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

function AccessBadge({
  type,
  access,
}: {
  type: "exam" | "training"
  access: AccessInfo | null
}) {
  if (!access) {
    return (
      <Badge
        variant="outline"
        className="border-gray-200 text-gray-400 dark:border-gray-700"
      >
        {type === "exam" ? "Exam" : "Train"}: -
      </Badge>
    )
  }

  const isExpiringSoon = access.daysRemaining <= 7
  const label = type === "exam" ? "Exam" : "Train"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "cursor-help",
              isExpiringSoon
                ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                : type === "exam"
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  : "border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
            )}
          >
            {label}: {access.daysRemaining}j
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            Expire dans {access.daysRemaining} jour
            {access.daysRemaining > 1 ? "s" : ""}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
          <Badge
            variant={user.role === "admin" ? "default" : "secondary"}
            className={cn(
              user.role === "admin"
                ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
            )}
          >
            {user.role === "admin" ? "Admin" : "User"}
          </Badge>
          {user.banned && (
            <Badge
              data-testid="ban-badge"
              className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400"
            >
              <ShieldOff className="mr-1 h-3 w-3" />
              Suspendu
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "access",
      label: "Accès",
      cell: (user) => (
        <div className="flex gap-1.5">
          <AccessBadge type="exam" access={user.examAccess} />
          <AccessBadge type="training" access={user.trainingAccess} />
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
        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-8 text-center dark:border-gray-700/50 dark:bg-gray-900">
          <p className="text-gray-500">Aucun utilisateur trouvé</p>
        </div>
      }
      footer={footer}
    />
  )
}
