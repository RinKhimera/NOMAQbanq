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
  Search,
} from "lucide-react"
import { useEffect, useState } from "react"
import { ExportUsersButton } from "@/components/admin/export-users-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const limit = 10

  // Debounce de la recherche pour éviter trop de requêtes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
      setCurrentPage(1)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const usersData = useQuery(api.users.getUsersWithPagination, {
    page: currentPage,
    limit,
    sortBy,
    sortOrder,
    searchQuery: debouncedSearchQuery.trim() || undefined,
  })

  const allUsers = useQuery(api.users.getAllUsers)

  // Dériver l'état de chargement au lieu d'utiliser un useEffect
  const showSkeleton = !usersData

  const handleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
    setCurrentPage(1)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
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

  // Afficher le skeleton uniquement lors du premier chargement
  if (showSkeleton) {
    return <UserTableSkeleton />
  }

  const users = usersData?.users ?? []
  const totalUsers = usersData?.totalUsers ?? 0
  const totalPages = usersData?.totalPages ?? 1
  const page = usersData?.currentPage ?? 1

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

        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex flex-col gap-3 @md:flex-row @md:items-center @md:justify-between">
              <Badge variant="secondary">
                {totalUsers} utilisateur{totalUsers > 1 ? "s" : ""}
              </Badge>
              {allUsers && allUsers.length > 0 && (
                <ExportUsersButton users={allUsers} />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Barre de recherche */}
            <div className="relative mb-4">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Rechercher par nom, email ou nom d'utilisateur..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
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
                        className="-ml-2.5 h-auto w-fit p-0 font-semibold hover:bg-transparent"
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
            <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between md:gap-0">
              <div className="text-muted-foreground text-sm">
                Affichage de {(page - 1) * limit + 1} à{" "}
                {Math.min(page * limit, totalUsers)} sur {totalUsers}{" "}
                utilisateur
                {totalUsers > 1 ? "s" : ""}
              </div>
              <div className="flex items-center justify-center space-x-2">
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
