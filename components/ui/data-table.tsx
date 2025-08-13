"use client"

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchPlaceholder?: string
  searchKey?: string
  showColumnToggle?: boolean
  showPagination?: boolean
  pageSize?: number
  isMobile?: boolean
  rowSelection?: Record<string, boolean>
  onRowSelectionChange?: (selection: Record<string, boolean>) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Rechercher...",
  searchKey,
  // showColumnToggle = true,
  showPagination = true,
  pageSize = 10,
  isMobile = false,
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
  children,
}: DataTableProps<TData, TValue> & { children?: React.ReactNode }) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [uncontrolledRowSelection, setUncontrolledRowSelection] =
    React.useState<Record<string, boolean>>({})

  const effectiveRowSelection =
    controlledRowSelection ?? uncontrolledRowSelection

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      const nextSelection =
        typeof updater === "function"
          ? (
              updater as (
                old: Record<string, boolean>,
              ) => Record<string, boolean>
            )(effectiveRowSelection)
          : (updater as Record<string, boolean>)

      setUncontrolledRowSelection(nextSelection)
      onRowSelectionChange?.(nextSelection)
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection: effectiveRowSelection,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
  })

  // Masquer automatiquement les colonnes sur mobile (utilise les id réels calculés par la table)
  React.useEffect(() => {
    if (isMobile) {
      const mobileHidden: VisibilityState = {}
      table.getAllLeafColumns().forEach((col) => {
        const meta = col.columnDef?.meta as
          | { hideOnMobile?: boolean }
          | undefined
        if (meta?.hideOnMobile) mobileHidden[col.id] = false
      })
      setColumnVisibility(mobileHidden)
    } else {
      setColumnVisibility({})
    }
  }, [isMobile, table])

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end gap-4 py-4">
        {searchKey && (
          <Input
            placeholder={searchPlaceholder}
            value={
              (table.getColumn(searchKey)?.getFilterValue() as string) ?? ""
            }
            onChange={(event) =>
              table.getColumn(searchKey)?.setFilterValue(event.target.value)
            }
            className="w-full py-4 md:max-w-sm"
          />
        )}
        {children}
        {/*  {showColumnToggle && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                Colonnes <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-border bg-popover text-popover-foreground border"
            >
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="focus:bg-accent focus:text-accent-foreground capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        )} */}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                className="dark:hover:bg-card hover:bg-muted-foreground/10"
                key={headerGroup.id}
              >
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="dark:hover:bg-card dark:data-[state=selected]:bg-card hover:bg-muted-foreground/10 data-[state=selected]:bg-muted-foreground/10"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Aucun résultat.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {showPagination && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <div className="text-muted-foreground flex-1 text-sm">
            {table.getFilteredSelectedRowModel().rows.length} sur{" "}
            {table.getFilteredRowModel().rows.length} ligne(s) sélectionnée(s).
          </div>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
