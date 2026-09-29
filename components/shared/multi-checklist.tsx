"use client"

import { type ReactNode, useId } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  maxSelections?: number
  maxSelectionsLabel?: (max: number) => string
  /** « 3 / 10 sélectionnés · 42 objectifs » */
  footer?: (selectedCount: number, optionCount: number) => ReactNode
  disabled?: boolean
  className?: string
}

/**
 * Multi-sélection en liste à cocher, avec recherche et pastilles retirables :
 * pour un choix parmi des dizaines d'options qu'on veut parcourir plutôt que
 * deviner (objectifs du CMC d'un domaine). Le combobox `MultiCombobox` reste
 * la forme compacte quand la liste tient dans un menu.
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
  maxSelections,
  maxSelectionsLabel,
  footer,
  disabled = false,
  className,
}: MultiChecklistProps<T>) {
  const id = useId()
  const selectedKeys = new Set(selected.map(getKey))
  const isFull = maxSelections !== undefined && selected.length >= maxSelections

  const remove = (key: string) =>
    onChange(selected.filter((s) => getKey(s) !== key))
  const toggle = (item: T) => {
    const key = getKey(item)
    if (selectedKeys.has(key)) remove(key)
    else if (!isFull) onChange([...selected, item])
  }

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
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
          <Button
            type="button"
            variant="link"
            size="sm"
            disabled={disabled}
            onClick={() => onChange([])}
            className="h-7 px-1 text-[13px] max-lg:h-11"
          >
            Tout effacer
          </Button>
        </div>
      )}

      <SearchInput
        value={search}
        onValueChange={onSearchChange}
        placeholder={searchPlaceholder}
        disabled={disabled}
      />

      <div
        role="group"
        aria-label={label}
        className="border-line bg-surface max-h-68 overflow-y-auto rounded-md border"
      >
        {options.map((item, index) => {
          const key = getKey(item)
          const checked = selectedKeys.has(key)
          const blocked = disabled || (isFull && !checked)
          const inputId = `${id}-${index}`
          return (
            <div
              key={key}
              className={cn(
                "border-line hover:bg-surface-2 flex items-start gap-3 border-t px-3 py-2 first:border-t-0 max-lg:min-h-11 max-lg:items-center",
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
          <p className="text-ink-3 px-3 py-3.5 text-[13px]">
            {emptyText(search)}
          </p>
        )}
      </div>

      {(footer || (isFull && maxSelectionsLabel)) && (
        <div className="flex flex-wrap justify-between gap-2 text-xs">
          <span className="text-ink-3 font-mono">
            {footer?.(selected.length, options.length)}
          </span>
          {isFull && maxSelectionsLabel && (
            <span className="text-warning-ink">
              {maxSelectionsLabel(maxSelections)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
