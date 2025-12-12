"use client"

import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { TableCell, TableRow } from "@/components/ui/table"
import { Doc } from "@/convex/_generated/dataModel"
import { getInitials } from "@/lib/utils"

interface UserTableRowProps {
  user: Doc<"users">
  index: number
  page: number
  limit: number
  onUserClick: (user: Doc<"users">) => void
}

export function UserTableRow({
  user,
  index,
  page,
  limit,
  onUserClick,
}: UserTableRowProps) {
  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), "Pp", { locale: fr })
  }

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
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image} alt={user.name || "Utilisateur"} />
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
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
        {formatDate(user._creationTime)}
      </TableCell>
    </TableRow>
  )
}
