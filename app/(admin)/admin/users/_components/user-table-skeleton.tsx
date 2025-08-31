import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function UserTableSkeleton() {
  return (
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
            <div className="h-6 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-6 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Nom d&apos;utilisateur</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Date de création</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 10 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="h-4 w-8 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
                        <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </TableCell>
                    <TableCell>
                      <div className="h-6 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Skeleton */}
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="h-4 w-60 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="flex items-center space-x-2">
              <div className="h-9 w-9 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-9 w-9 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-9 w-9 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-9 w-9 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
