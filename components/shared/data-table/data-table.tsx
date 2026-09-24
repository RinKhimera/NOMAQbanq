"use client"

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
} from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SkeletonTable } from "@/components/ui/skeleton-patterns"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useColumnPreference } from "./column-preferences"
import {
  type ColumnVisibility,
  type VisibleFrom,
  isEffectivelyShown,
  resolveVisibility,
  toggleColumn,
  useWidthTier,
} from "./column-visibility"
import { useScrollEdges } from "./scroll-edges"

export type DataTableSort = {
  direction: "asc" | "desc" | null
  onToggle: () => void
  /** Tri momentanément indisponible : bouton désactivé, raison en infobulle. */
  disabledReason?: string
}

export type DataTableColumn<Row> = {
  id: string
  /** En-tête de la colonne et libellé dans le menu « Colonnes ». */
  label: string
  /** Remplace le libellé dans l'en-tête (case « tout cocher », en-tête vide). */
  header?: ReactNode
  cell: (row: Row) => ReactNode
  /** Affichage par défaut tant qu'aucun choix n'est enregistré ; absent = toujours. */
  visibleFrom?: VisibleFrom
  /** Toujours affichée, absente du menu « Colonnes ». */
  required?: boolean
  sort?: DataTableSort
  className?: string
}

/** `selected` : ligne cochée ; `active` : ligne ouverte dans un panneau. */
export type DataTableRowTone = "selected" | "active"

type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[]
  rows: Row[]
  getRowId: (row: Row) => string
  /** Active le menu « Colonnes » et mémorise le choix sous cette clé. */
  preferencesKey?: string
  /** Colonne épinglée à droite, toujours affichée et atteignable sans défiler. */
  action?: { label: string; cell: (row: Row) => ReactNode }
  onRowClick?: (row: Row) => void
  rowTone?: (row: Row) => DataTableRowTone | undefined
  /** Ligne grisée ; sa colonne d'action reste pleinement lisible. */
  isRowDisabled?: (row: Row) => boolean
  isLoading?: boolean
  /** Rendu à la place du tableau quand `rows` est vide. */
  empty?: ReactNode
  footer?: ReactNode
  className?: string
}

// Seuils = TIER_MIN_REM (column-visibility.ts), écrits en toutes lettres pour
// que Tailwind génère les classes.
const AUTO_CLASS: Record<Exclude<VisibleFrom, "never">, string> = {
  medium: "hidden @min-[36rem]:table-cell",
  wide: "hidden @min-[54rem]:table-cell",
}

// Teintes OPAQUES : la cellule épinglée hérite du fond de sa ligne et doit
// masquer les colonnes qui défilent dessous. Chaque teinte reproduit le rendu
// d'une teinte translucide posée sur le fond du tableau. Chacune fixe aussi son
// survol : sinon le `hover:bg-muted/50` translucide de `TableRow` s'applique.
const ROW_BACKGROUND = {
  idle: "bg-white hover:bg-[color-mix(in_oklab,var(--color-gray-50)_50%,white)] dark:bg-gray-900 dark:hover:bg-[color-mix(in_oklab,var(--color-gray-800)_30%,var(--color-gray-900))]",
  selected:
    "bg-[color-mix(in_oklab,var(--color-violet-50)_50%,white)] hover:bg-[color-mix(in_oklab,var(--color-violet-50)_50%,white)] shadow-[inset_3px_0_0_0_rgb(139,92,246)] dark:bg-[color-mix(in_oklab,var(--color-violet-900)_20%,var(--color-gray-900))] dark:hover:bg-[color-mix(in_oklab,var(--color-violet-900)_20%,var(--color-gray-900))]",
  active:
    "bg-[color-mix(in_oklab,var(--color-blue-50)_50%,white)] hover:bg-[color-mix(in_oklab,var(--color-blue-50)_50%,white)] shadow-[inset_3px_0_0_0_rgb(59,130,246)] dark:bg-[color-mix(in_oklab,var(--color-blue-900)_20%,var(--color-gray-900))] dark:hover:bg-[color-mix(in_oklab,var(--color-blue-900)_20%,var(--color-gray-900))]",
} as const

function visibilityClass(
  state: ColumnVisibility,
  visibleFrom: VisibleFrom | undefined,
) {
  if (state !== "auto" || visibleFrom === undefined || visibleFrom === "never")
    return undefined
  return AUTO_CLASS[visibleFrom]
}

function isRendered(
  state: ColumnVisibility,
  visibleFrom: VisibleFrom | undefined,
) {
  if (state === "hidden") return false
  return !(state === "auto" && visibleFrom === "never")
}

function SortIcon({ direction }: { direction: DataTableSort["direction"] }) {
  if (direction === "asc") return <ArrowUp className="ml-1.5 h-3.5 w-3.5" />
  if (direction === "desc") return <ArrowDown className="ml-1.5 h-3.5 w-3.5" />
  return <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 opacity-50" />
}

function ColumnHeader<Row>({ column }: { column: DataTableColumn<Row> }) {
  const content = column.header ?? column.label
  if (!column.sort) return content
  const { direction, onToggle, disabledReason } = column.sort
  return (
    <Button
      variant="ghost"
      onClick={onToggle}
      disabled={disabledReason !== undefined}
      title={disabledReason}
      className="h-auto gap-0 p-0 font-semibold hover:bg-transparent has-[>svg]:px-0"
    >
      {content}
      <SortIcon direction={disabledReason ? null : direction} />
    </Button>
  )
}

export function DataTable<Row>({
  columns,
  rows,
  getRowId,
  preferencesKey,
  action,
  onRowClick,
  rowTone,
  isRowDisabled,
  isLoading,
  empty,
  footer,
  className,
}: DataTableProps<Row>) {
  const [preference, savePreference] = useColumnPreference(preferencesKey)
  const { ref: containerRef, tier } = useWidthTier<HTMLDivElement>()
  const { ref: scrollRef, edges, scrollBy } = useScrollEdges<HTMLDivElement>()
  const visibility = resolveVisibility(columns, preference)

  const renderedColumns = columns
    .filter((column) =>
      isRendered(visibility.get(column.id) ?? "auto", column.visibleFrom),
    )
    .map((column) => ({
      column,
      className: cn(
        column.className,
        visibilityClass(
          visibility.get(column.id) ?? "auto",
          column.visibleFrom,
        ),
      ),
    }))

  if (isLoading) {
    return (
      <SkeletonTable
        columns={renderedColumns.length + (action ? 1 : 0)}
        rows={10}
      />
    )
  }

  if (rows.length === 0 && empty) return empty

  const hideableColumns = preferencesKey
    ? columns.filter((column) => !column.required)
    : []
  const overflows = edges.start || edges.end

  return (
    <div
      ref={containerRef}
      className={cn(
        "@container overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-700/50 dark:bg-gray-900",
        className,
      )}
    >
      {(hideableColumns.length > 0 || overflows) && (
        <div className="flex items-center justify-end gap-1 border-b border-gray-200/80 px-3 py-1.5 dark:border-gray-700/50">
          {overflows && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Défiler vers la gauche"
                disabled={!edges.start}
                onClick={() => scrollBy(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Défiler vers la droite"
                disabled={!edges.end}
                onClick={() => scrollBy(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {hideableColumns.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                  <Columns3 className="h-4 w-4" />
                  Colonnes
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Colonnes affichées</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideableColumns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={isEffectivelyShown(column, visibility, tier)}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={() =>
                      savePreference(
                        toggleColumn(columns, visibility, tier, column.id),
                      )
                    }
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={preference === null}
                  onSelect={() => savePreference(null)}
                >
                  Réinitialiser l&apos;affichage
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      <div className="relative">
        <div ref={scrollRef} className="w-full overflow-x-auto">
          <table className="w-full caption-bottom text-sm">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {renderedColumns.map(({ column, className: cellClass }) => (
                  <TableHead
                    key={column.id}
                    className={cn("font-semibold", cellClass)}
                  >
                    <ColumnHeader column={column} />
                  </TableHead>
                ))}
                {action && (
                  <TableHead
                    className={cn(
                      "sticky right-0 w-12.5 bg-white dark:bg-gray-900",
                      edges.end && "shadow-[-10px_0_10px_-8px_rgb(0_0_0/0.35)]",
                    )}
                  >
                    <span className="sr-only">{action.label}</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const tone = rowTone?.(row)
                const disabled = isRowDisabled?.(row) ?? false
                return (
                  <TableRow
                    key={getRowId(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "transition-colors duration-150",
                      ROW_BACKGROUND[tone ?? "idle"],
                      onRowClick && "cursor-pointer",
                      disabled && "[&>td:not([data-pinned])]:opacity-50",
                    )}
                  >
                    {renderedColumns.map(({ column, className: cellClass }) => (
                      <TableCell key={column.id} className={cellClass}>
                        {column.cell(row)}
                      </TableCell>
                    ))}
                    {action && (
                      <TableCell
                        data-pinned=""
                        className={cn(
                          "sticky right-0 bg-inherit",
                          edges.end &&
                            "shadow-[-10px_0_10px_-8px_rgb(0_0_0/0.35)]",
                        )}
                      >
                        {action.cell(row)}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </table>
        </div>
        {edges.start && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r from-black/10 to-transparent dark:from-black/40"
          />
        )}
        {edges.end && !action && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-black/10 to-transparent dark:from-black/40"
          />
        )}
      </div>

      {footer}
    </div>
  )
}
