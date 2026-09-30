"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type KeysetPaginationProps = {
  /** Rang (base 0) de la première ligne affichée. */
  firstIndex: number
  /** Lignes affichées sur cette page. */
  count: number
  pageSize: number
  /** Connu : « 21–40 sur 153 clients » et « 2 / 8 » ; sinon « lignes 21–40 ». */
  total?: number
  noun?: { one: string; many: string }
  /** Absent au bord de la liste : le bouton est désactivé. */
  onPrevious?: () => void
  onNext?: () => void
  isPending?: boolean
  className?: string
}

// 44 px sous 1024 px et sur écran tactile, iPad en paysage compris.
const PAGE_BUTTON = "max-lg:h-11 pointer-coarse:h-11"

/**
 * Pied de liste d'une pagination keyset : Précédent / Suivant, sans numéros
 * de page ni « Charger plus ». La page courante vit dans l'URL de l'appelant,
 * qui revient en tête de liste quand un filtre change.
 */
export const KeysetPagination = ({
  firstIndex,
  count,
  pageSize,
  total,
  noun = { one: "ligne", many: "lignes" },
  onPrevious,
  onNext,
  isPending = false,
  className,
}: KeysetPaginationProps) => {
  const from = count === 0 ? 0 : firstIndex + 1
  const to = firstIndex + count
  const pages = total === undefined ? null : Math.ceil(total / pageSize)
  const single = !onPrevious && !onNext

  return (
    <div
      className={cn(
        "border-line text-ink-3 flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs",
        className,
      )}
    >
      <span className="font-mono tabular-nums">
        {total === undefined
          ? `lignes ${from}–${to}`
          : `${from}–${to} sur ${total.toLocaleString("fr-CA")} ${total > 1 ? noun.many : noun.one}`}
      </span>
      {!single && (
        <span className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onPrevious}
            disabled={!onPrevious || isPending}
            className={PAGE_BUTTON}
          >
            <ChevronLeft aria-hidden="true" />
            Précédent
          </Button>
          {pages !== null && pages > 1 && (
            <span className="min-w-12 text-center font-mono tabular-nums">
              {Math.floor(firstIndex / pageSize) + 1} / {pages}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onNext}
            disabled={!onNext || isPending}
            className={PAGE_BUTTON}
          >
            Suivant
            <ChevronRight aria-hidden="true" />
          </Button>
        </span>
      )}
    </div>
  )
}
