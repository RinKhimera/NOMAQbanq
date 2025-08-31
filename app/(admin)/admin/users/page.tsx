"use client"

import { useQuery } from "convex/react"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api } from "@/convex/_generated/api"
import { Doc } from "@/convex/_generated/dataModel"
import { UserDetailsDialog } from "./_components/user-details-dialog"
import { UserTableRow } from "./_components/user-table-row"
import { UserTableSkeleton } from "./_components/user-table-skeleton"

type SortBy = "name" | "role" | "_creationTime"
type SortOrder = "asc" | "desc"

const UsersPage = () => {
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortBy>("name")
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")
  const [selectedUser, setSelectedUser] = useState<Doc<"users"> | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const limit = 10

  const usersData = useQuery(api.users.getUsersWithPagination, {
    page: currentPage,
    limit,
    sortBy,
    sortOrder,
  })

  const handleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
    setCurrentPage(1)
  }

  const handleUserClick = (user: Doc<"users">) => {
    setSelectedUser(user)
    setDialogOpen(true)
  }

  const getSortIcon = (field: SortBy) => {
    if (sortBy !== field) return <ArrowUpDown className="h-4 w-4" />
    return sortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    )
  }

  if (!usersData) {
    return <UserTableSkeleton />
  }

  const { users, totalUsers, totalPages, currentPage: page } = usersData

  return (
    <>
      <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-600">
            Tableau des utilisateurs
          </h1>
          <p className="text-muted-foreground">
            Gérez tous les utilisateurs enregistrés sur la plateforme
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-blue-600">Tableau des utilisateurs</span>
              <Badge variant="secondary">
                {totalUsers} utilisateur{totalUsers > 1 ? "s" : ""}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("name")}
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                      >
                        Nom
                        {getSortIcon("name")}
                      </Button>
                    </TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Nom d&apos;utilisateur</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("role")}
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                      >
                        Rôle
                        {getSortIcon("role")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("_creationTime")}
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                      >
                        Date de création
                        {getSortIcon("_creationTime")}
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user, index) => (
                    <UserTableRow
                      key={user._id}
                      user={user}
                      index={index}
                      page={page}
                      limit={limit}
                      onUserClick={handleUserClick}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between space-x-2 py-4">
              <div className="text-muted-foreground text-sm">
                Affichage de {(page - 1) * limit + 1} à{" "}
                {Math.min(page * limit, totalUsers)} sur {totalUsers}{" "}
                utilisateur
                {totalUsers > 1 ? "s" : ""}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(1)}
                  disabled={page === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                  <span className="text-sm">Page</span>
                  <span className="text-sm font-medium">{page}</span>
                  <span className="text-sm">sur</span>
                  <span className="text-sm font-medium">{totalPages}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(page + 1)}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={page === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <UserDetailsDialog
        user={selectedUser}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  )
}

export default UsersPage
