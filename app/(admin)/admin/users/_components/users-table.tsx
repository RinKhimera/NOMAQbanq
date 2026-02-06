"use client"

import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Id } from "@/convex/_generated/dataModel"
import { cn, getInitials } from "@/lib/utils"

export type SortBy = "name" | "role" | "_creationTime"
export type SortOrder = "asc" | "desc"

interface AccessInfo {
  expiresAt: number
  daysRemaining: number
}

export interface EnrichedUser {
  _id: Id<"users">
  _creationTime: number
  name: string
  username?: string
  email: string
  image: string
  bio?: string
  role: "admin" | "user"
  examAccess: AccessInfo | null
  trainingAccess: AccessInfo | null
}

interface UsersTableProps {
  users: EnrichedUser[]
  selectedUserId: Id<"users"> | null
  onUserSelect: (user: EnrichedUser) => void
  sortBy: SortBy
  sortOrder: SortOrder
  onSort: (field: SortBy) => void
  isLoading?: boolean
  canLoadMore: boolean
  onLoadMore: () => void
  isLoadingMore?: boolean
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
        className="text-gray-400 border-gray-200 dark:border-gray-700"
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

export function UsersTable({
  users,
  selectedUserId,
  onUserSelect,
  sortBy,
  sortOrder,
  onSort,
  isLoading,
  canLoadMore,
  onLoadMore,
  isLoadingMore,
}: UsersTableProps) {
  const getSortIcon = (field: SortBy) => {
    if (sortBy !== field)
      return <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 opacity-50" />
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-1.5 h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="ml-1.5 h-3.5 w-3.5" />
    )
  }

  const formatRelativeDate = (timestamp: number) => {
    return formatDistanceToNow(new Date(timestamp), {
      addSuffix: true,
      locale: fr,
    })
  }

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-700/50 dark:bg-gray-900">
        <div className="p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">Chargement...</p>
        </div>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-700/50 dark:bg-gray-900">
        <div className="p-8 text-center">
          <p className="text-gray-500">Aucun utilisateur trouvé</p>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-700/50 dark:bg-gray-900">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12.5 pl-4">#</TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => onSort("name")}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Utilisateur
                {getSortIcon("name")}
              </Button>
            </TableHead>
            <TableHead className="hidden md:table-cell">Email</TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => onSort("role")}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Rôle
                {getSortIcon("role")}
              </Button>
            </TableHead>
            <TableHead>Accès</TableHead>
            <TableHead className="hidden lg:table-cell">
              <Button
                variant="ghost"
                onClick={() => onSort("_creationTime")}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Inscrit
                {getSortIcon("_creationTime")}
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user, index) => (
            <TableRow
              key={user._id}
              onClick={() => onUserSelect(user)}
              className={cn(
                "cursor-pointer transition-all duration-150",
                selectedUserId === user._id
                  ? "border-l-2 border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/20"
                  : "hover:bg-gray-50/50 dark:hover:bg-gray-800/30",
              )}
            >
              <TableCell className="pl-4 font-medium text-gray-500">
                {index + 1}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 border border-gray-100 dark:border-gray-800">
                    <AvatarImage
                      src={user.image}
                      alt={user.name || "Utilisateur"}
                    />
                    <AvatarFallback className="bg-linear-to-br from-blue-500 to-indigo-600 text-xs font-medium text-white">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span
                      className={cn(
                        "font-medium",
                        !user.name || user.name === "null null"
                          ? "italic text-gray-400"
                          : "text-gray-900 dark:text-white",
                      )}
                    >
                      {user.name && user.name !== "null null"
                        ? user.name
                        : "Non défini"}
                    </span>
                    {user.username && (
                      <span className="text-xs text-blue-600 dark:text-blue-400">
                        @{user.username}
                      </span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden text-gray-500 md:table-cell">
                <span className="max-w-50 truncate">{user.email}</span>
              </TableCell>
              <TableCell>
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
              </TableCell>
              <TableCell>
                <div className="flex gap-1.5">
                  <AccessBadge type="exam" access={user.examAccess} />
                  <AccessBadge type="training" access={user.trainingAccess} />
                </div>
              </TableCell>
              <TableCell className="hidden text-gray-500 lg:table-cell">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">
                        {formatRelativeDate(user._creationTime)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {new Date(user._creationTime).toLocaleDateString(
                          "fr-CA",
                          {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Load More */}
      {canLoadMore && (
        <div className="flex justify-center border-t border-gray-100 p-4 dark:border-gray-800">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="gap-2"
          >
            {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            Charger plus d&apos;utilisateurs
          </Button>
        </div>
      )}
    </div>
  )
}
