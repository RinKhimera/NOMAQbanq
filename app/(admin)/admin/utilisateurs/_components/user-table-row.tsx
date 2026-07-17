"use client"

import { UserAvatar } from "@/components/shared/user-avatar"
import { Badge } from "@/components/ui/badge"
import { TableCell, TableRow } from "@/components/ui/table"
import { formatCompactDateTime } from "@/lib/format"

/**
 * Forme structurelle d'un utilisateur telle que consommée par cette ligne de
 * tableau. Reprend la convention héritée (`_id` / `_creationTime`) pour rester
 * compatible avec les call-sites existants (la donnée provient d'un cast).
 */
type UserRow = {
  _id: string
  _creationTime: number
  name: string
  email: string
  image: string
  username?: string
  role: "admin" | "user"
}

interface UserTableRowProps {
  user: UserRow
  index: number
  page: number
  limit: number
  onUserClick: (user: UserRow) => void
}

export function UserTableRow({
  user,
  index,
  page,
  limit,
  onUserClick,
}: UserTableRowProps) {
  return (
    <TableRow
      key={user._id}
      className="hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => onUserClick(user)}
    >
      <TableCell className="font-medium">
        {(page - 1) * limit + index + 1}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <UserAvatar name={user.name} image={user.image} className="h-8 w-8" />
          <span
            className={
              user.name && user.name !== "null null"
                ? "font-medium"
                : "text-muted-foreground italic"
            }
          >
            {user.name && user.name !== "null null" ? user.name : "Non défini"}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{user.email}</TableCell>
      <TableCell>
        {user.username ? (
          <span className="text-blue-600">@{user.username}</span>
        ) : (
          <span className="text-muted-foreground italic">Non défini</span>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant={user.role === "admin" ? "default" : "secondary"}
          className={
            user.role === "admin"
              ? "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200"
              : ""
          }
        >
          {user.role === "admin" ? "Administrateur" : "Utilisateur"}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatCompactDateTime(user._creationTime)}
      </TableCell>
    </TableRow>
  )
}
