"use client"

import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function QuestionsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-700/50 dark:bg-gray-900">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[50px] pl-4">#</TableHead>
            <TableHead className="min-w-[300px]">Question</TableHead>
            <TableHead className="w-[150px]">Domaine</TableHead>
            <TableHead className="hidden w-[180px] md:table-cell">
              Objectif CMC
            </TableHead>
            <TableHead className="w-[80px] text-center">Images</TableHead>
            <TableHead className="hidden w-[120px] lg:table-cell">
              Créée
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(10)].map((_, i) => (
            <TableRow key={i} className="hover:bg-transparent">
              <TableCell className="pl-4">
                <Skeleton className="h-4 w-6" />
              </TableCell>
              <TableCell>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full max-w-[800px]" />
                  {/* <Skeleton className="h-3 w-3/4 max-w-[300px]" /> */}
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-24 rounded-full" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-4 w-56" />
              </TableCell>
              <TableCell className="text-center">
                <Skeleton className="mx-auto h-5 w-5 rounded" />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <Skeleton className="h-4 w-20" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
