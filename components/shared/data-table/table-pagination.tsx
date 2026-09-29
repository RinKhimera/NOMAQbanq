"use client"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface TablePaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
  isLoading?: boolean
  itemNoun?: { one: string; many: string }
  /** `range` : « 1–10 sur 34 séries » ; `page` : « Page 1 sur 4 ». */
  summary?: "range" | "page"
  className?: string
}

// Numéros affichés : 1, dernière, courante ± 1, avec ellipses. Appelé
// uniquement quand totalPages > 1.
function pageRange(current: number, totalPages: number): (number | "…")[] {
  const range: (number | "…")[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(totalPages - 1, current + 1)
  if (left > 2) range.push("…")
  for (let i = left; i <= right; i++) range.push(i)
  if (right < totalPages - 1) range.push("…")
  range.push(totalPages)
  return range
}

// Cibles de 44 px sous 1024 px : les numéros de page se touchent au pouce.
const PAGE_BUTTON = "max-lg:h-11 max-lg:min-w-11"

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  isLoading,
  itemNoun = { one: "élément", many: "éléments" },
  summary = "range",
  className,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const noun = total === 1 ? itemNoun.one : itemNoun.many

  return (
    <div
      className={cn(
        "border-line flex flex-col items-center justify-between gap-3 border-t p-4 sm:flex-row",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <p className="text-ink-3 text-sm">
          {summary === "page" ? (
            <span className="font-mono text-xs">
              Page {page} sur {totalPages}
            </span>
          ) : (
            <>
              {from}–{to} sur {total.toLocaleString("fr-CA")} {noun}
            </>
          )}
        </p>
        {onPageSizeChange && (
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="h-8 w-28" aria-label="Taille de page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            className={PAGE_BUTTON}
          >
            Précédent
          </Button>
          {pageRange(page, totalPages).map((p, i) =>
            p === "…" ? (
              <span
                key={`ellipsis-${i}`}
                className="text-ink-4 px-2 text-sm"
                aria-hidden
              >
                …
              </span>
            ) : (
              <Button
                type="button"
                key={p}
                variant={p === page ? "default" : "outline"}
                size="sm"
                aria-current={p === page ? "page" : undefined}
                onClick={() => onPageChange(p)}
                disabled={isLoading}
                className={cn(
                  "min-w-9",
                  PAGE_BUTTON,
                  p === page && "pointer-events-none",
                )}
              >
                {p}
              </Button>
            ),
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            className={PAGE_BUTTON}
          >
            Suivant
          </Button>
        </div>
      )}
    </div>
  )
}
