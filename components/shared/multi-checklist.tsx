"use client"

import { ListFilter } from "lucide-react"
import { type ReactNode, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
} from "@/components/ui/sheet"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import { FilterChip } from "./filter-chip"
import { SearchInput } from "./search-input"

type MultiChecklistProps<T> = {
  /** Options déjà filtrées par l'appelant sur `search`. */
  options: readonly T[]
  selected: readonly T[]
  onChange: (next: T[]) => void
  getKey: (item: T) => string
  getLabel: (item: T) => string
  /** Complément à droite du libellé (nombre de questions). */
  renderMeta?: (item: T) => ReactNode
  search: string
  onSearchChange: (search: string) => void
  searchPlaceholder: string
  /** « Aucun objectif ne correspond à « … ». » */
  emptyText: (search: string) => string
  /** Nom du groupe pour un lecteur d'écran. */
  label: string
  /** En-tête de la liste : titre des libellés et du complément. */
  columns?: { label: string; meta: string }
  /** Portée de la liste, sous la recherche : « 91 objectifs dans Pédiatrie ». */
  scope?: ReactNode
  maxSelections?: number
  /** « 3 sur 10 choisis », au-dessus des pastilles. */
  selectionSummary?: (selectedCount: number) => ReactNode
  /** Affiché une fois le quota atteint. */
  maxSelectionsText?: string
  /** Note de l'appelant, entre la sélection et la liste. */
  notice?: ReactNode
  /** Sous 768 px, la liste s'ouvre dans un panneau plein écran. */
  sheet?: { triggerLabel: string; title: string; description?: string }
  disabled?: boolean
  className?: string
}

/**
 * Multi-sélection en liste à cocher, avec recherche et pastilles retirables :
 * pour un choix parmi des dizaines ou des centaines d'options qu'on veut
 * parcourir plutôt que deviner (objectifs du CMC). Le combobox
 * `MultiCombobox` reste la forme compacte quand la liste tient dans un menu.
 */
export function MultiChecklist<T>({
  options,
  selected,
  onChange,
  getKey,
  getLabel,
  renderMeta,
  search,
  onSearchChange,
  searchPlaceholder,
  emptyText,
  label,
  columns,
  scope,
  maxSelections,
  selectionSummary,
  maxSelectionsText,
  notice,
  sheet,
  disabled = false,
  className,
}: MultiChecklistProps<T>) {
  const id = useId()
  const [sheetOpen, setSheetOpen] = useState(false)
  // Faux au rendu serveur et à l'hydratation : la liste de la page est servie,
  // puis démontée sur un téléphone, où seul le panneau la porte. Même seuil
  // que `max-md:` / `md:` de Tailwind v4 (`width < 48rem`), sans trou à 767,5 px
  // sous zoom.
  const isPhone = useMediaQuery("(width < 48rem)")
  const showPageList = !sheet || !isPhone
  // Écran élargi (rotation) : le panneau se ferme pour de bon, sans se rouvrir
  // au retour.
  if (sheetOpen && !isPhone) setSheetOpen(false)
  const selectedKeys = new Set(selected.map(getKey))
  const isFull = maxSelections !== undefined && selected.length >= maxSelections

  const remove = (key: string) =>
    onChange(selected.filter((s) => getKey(s) !== key))
  const toggle = (item: T) => {
    const key = getKey(item)
    if (selectedKeys.has(key)) remove(key)
    else if (!isFull) onChange([...selected, item])
  }

  const summary = selectionSummary && (
    <span
      className={cn(
        "font-mono text-xs tabular-nums",
        isFull ? "text-warning-ink" : "text-ink-2",
      )}
    >
      {selectionSummary(selected.length)}
    </span>
  )
  const scopeLine = scope && (
    <span className="text-ink-3 font-mono text-xs" aria-live="polite">
      {scope}
    </span>
  )

  // Les identifiants des cases sont propres à chaque rendu de la liste : la
  // page et le panneau peuvent la monter en même temps.
  const renderBrowser = (where: "page" | "sheet") => (
    <>
      <div
        className={cn(
          "flex flex-col gap-2",
          where === "sheet" &&
            "border-line bg-surface sticky top-0 z-10 border-b px-4 py-3",
        )}
      >
        <SearchInput
          value={search}
          onValueChange={onSearchChange}
          placeholder={searchPlaceholder}
          disabled={disabled}
        />
        {scopeLine}
      </div>
      <div
        role="group"
        aria-label={label}
        className={cn(
          "bg-surface",
          where === "page"
            ? "border-line max-h-68 overflow-y-auto rounded-md border"
            : "flex-1",
        )}
      >
        {columns && options.length > 0 && (
          <div
            aria-hidden
            className={cn(
              "bg-surface-2 border-line flex justify-between gap-3 border-b py-1.5",
              where === "page" ? "sticky top-0 z-1 px-3" : "px-4",
            )}
          >
            <span className="type-label">{columns.label}</span>
            <span className="type-label">{columns.meta}</span>
          </div>
        )}
        {options.map((item, index) => {
          const key = getKey(item)
          const checked = selectedKeys.has(key)
          const blocked = disabled || (isFull && !checked)
          const inputId = `${id}-${where}-${index}`
          return (
            <div
              key={key}
              className={cn(
                "border-line hover:bg-surface-2 flex items-start gap-3 border-t py-2 first:border-t-0 max-lg:min-h-11 max-lg:items-center",
                columns && "nth-2:border-t-0",
                where === "page" ? "px-3" : "px-4",
                blocked && !checked && "opacity-55",
              )}
            >
              <Checkbox
                id={inputId}
                checked={checked}
                disabled={blocked}
                onCheckedChange={() => toggle(item)}
                className="mt-1 max-lg:mt-0"
              />
              <label
                htmlFor={inputId}
                className={cn(
                  "text-ink flex min-w-0 flex-1 items-start justify-between gap-3 text-sm leading-[1.4]",
                  blocked ? "cursor-not-allowed" : "cursor-pointer",
                )}
              >
                <span className="text-pretty">{getLabel(item)}</span>
                {renderMeta && (
                  <span className="text-ink-3 shrink-0 pt-px font-mono text-xs">
                    {renderMeta(item)}
                  </span>
                )}
              </label>
            </div>
          )
        })}
        {options.length === 0 && (
          <p className="text-ink-3 px-3 py-3.5 text-sm">{emptyText(search)}</p>
        )}
      </div>
    </>
  )

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {selected.length > 0 && (
        <div className="border-line bg-surface-2 flex flex-col gap-2 rounded-md border px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            {summary ?? <span />}
            <Button
              type="button"
              variant="link"
              size="sm"
              disabled={disabled}
              onClick={() => onChange([])}
              className="h-7 px-1 text-sm max-lg:h-11"
            >
              Tout retirer
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selected.map((item) => (
              <FilterChip
                key={getKey(item)}
                disabled={disabled}
                onRemove={() => remove(getKey(item))}
                removeLabel={`Retirer ${getLabel(item)}`}
                className="h-auto min-h-7 max-w-full rounded-xs whitespace-normal max-lg:min-h-10 [&>span]:max-w-none [&>span]:whitespace-normal"
              >
                {getLabel(item)}
              </FilterChip>
            ))}
          </div>
          {isFull && maxSelectionsText && (
            <span className="text-warning-ink text-sm leading-normal">
              {maxSelectionsText}
            </span>
          )}
        </div>
      )}

      {notice}

      {showPageList && (
        <div className={cn("flex flex-col gap-2", sheet && "max-md:hidden")}>
          {renderBrowser("page")}
        </div>
      )}

      {sheet && (
        <div className="flex flex-col gap-2 md:hidden">
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => setSheetOpen(true)}
            className="h-11 w-full"
          >
            <ListFilter aria-hidden />
            {sheet.triggerLabel}
          </Button>
          {scopeLine}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent
              side="bottom"
              className="flex h-dvh flex-col gap-0 p-0"
            >
              <div className="border-line border-b px-4 py-4 pr-14">
                <SheetTitle>{sheet.title}</SheetTitle>
                {sheet.description && (
                  <SheetDescription className="text-ink-3 text-sm">
                    {sheet.description}
                  </SheetDescription>
                )}
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {renderBrowser("sheet")}
              </div>
              <SheetFooter className="border-line flex-row items-center gap-2 border-t px-4 py-3 sm:space-x-0">
                <span className="mr-auto">{summary}</span>
                <Button type="button" onClick={() => setSheetOpen(false)}>
                  Terminé
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      )}
    </div>
  )
}
