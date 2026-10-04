"use client"

import { Check, ChevronsUpDown, type LucideIcon } from "lucide-react"
import { type ReactNode, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { FilterChip } from "./filter-chip"

type MultiComboboxProps<T> = {
  /** Options à proposer, déjà filtrées par l'appelant (local ou serveur). */
  options: T[]
  selected: T[]
  onChange: (next: T[]) => void
  getKey: (item: T) => string
  getLabel: (item: T) => string
  renderOption?: (item: T) => ReactNode
  search: string
  onSearchChange: (search: string) => void
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  /** « 2 objectifs sélectionnés » */
  selectedLabel: (count: number) => string
  isLoading?: boolean
  loadingText?: string
  disabled?: boolean
  /** Désactive aussi le déclencheur tant que la liste charge. */
  disableTriggerWhileLoading?: boolean
  maxSelections?: number
  maxSelectionsLabel?: (max: number) => string
  /** « Tout effacer » dès deux sélections. */
  clearable?: boolean
  triggerIcon?: LucideIcon
  triggerClassName?: string
  contentClassName?: string
  chipClassName?: string
  /** Affiché sous la liste (ex. « Affinez la recherche »). */
  listFooter?: ReactNode
  /** Pastilles au-dessus du déclencheur plutôt qu'en dessous. */
  chipsFirst?: boolean
  modal?: boolean
}

/** Multi-sélection recherchable : un clic coche ou décoche sans fermer la liste. */
export function MultiCombobox<T>({
  options,
  selected,
  onChange,
  getKey,
  getLabel,
  renderOption,
  search,
  onSearchChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  selectedLabel,
  isLoading = false,
  loadingText = "Chargement...",
  disabled = false,
  disableTriggerWhileLoading = false,
  maxSelections,
  maxSelectionsLabel,
  clearable = false,
  triggerIcon: TriggerIcon,
  triggerClassName,
  contentClassName,
  chipClassName,
  listFooter,
  chipsFirst = false,
  modal,
}: MultiComboboxProps<T>) {
  const [open, setOpen] = useState(false)
  const selectedKeys = new Set(selected.map(getKey))
  const isQuotaReached =
    maxSelections !== undefined && selected.length >= maxSelections

  const remove = (key: string) =>
    onChange(selected.filter((s) => getKey(s) !== key))

  const toggle = (item: T) => {
    const key = getKey(item)
    if (selectedKeys.has(key)) remove(key)
    else if (!isQuotaReached) onChange([...selected, item])
  }

  const chips = selected.length > 0 && (
    <div className="flex flex-wrap items-center gap-2">
      {selected.map((item) => (
        <FilterChip
          key={getKey(item)}
          disabled={disabled}
          onRemove={() => remove(getKey(item))}
          removeLabel={`Retirer ${getLabel(item)}`}
          className={chipClassName}
        >
          {getLabel(item)}
        </FilterChip>
      ))}
      {clearable && selected.length > 1 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([])}
          className="text-ink-3 hover:text-ink h-7 text-xs"
        >
          Tout effacer
        </Button>
      )}
    </div>
  )

  return (
    <div className="space-y-3">
      {chipsFirst && chips}

      <Popover open={open} onOpenChange={setOpen} modal={modal}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || (disableTriggerWhileLoading && isLoading)}
            className={cn(
              "w-full justify-between font-normal",
              selected.length === 0 && "text-ink-3",
              triggerClassName,
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              {TriggerIcon && <TriggerIcon className="text-ink-3 h-4 w-4" />}
              <span className="truncate">
                {selected.length === 0
                  ? placeholder
                  : selectedLabel(selected.length)}
              </span>
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            "w-(--radix-popover-trigger-width) p-0",
            contentClassName,
          )}
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={search}
              onValueChange={onSearchChange}
            />
            <CommandList>
              {isLoading ? (
                <div className="text-ink-3 flex items-center justify-center gap-2 py-6 text-sm">
                  <Spinner size="sm" />
                  {loadingText}
                </div>
              ) : (
                <>
                  {options.length === 0 && (
                    <CommandEmpty>{emptyText}</CommandEmpty>
                  )}
                  {options.length > 0 && (
                    <CommandGroup>
                      {options.map((item) => {
                        const isSelected = selectedKeys.has(getKey(item))
                        return (
                          <CommandItem
                            key={getKey(item)}
                            value={getKey(item)}
                            onSelect={() => toggle(item)}
                            disabled={!isSelected && isQuotaReached}
                            className="cursor-pointer gap-2"
                          >
                            <Check
                              className={cn(
                                "h-4 w-4 shrink-0",
                                isSelected ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {renderOption ? (
                              renderOption(item)
                            ) : (
                              <span className="flex-1">{getLabel(item)}</span>
                            )}
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  )}
                  {listFooter}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {!chipsFirst && chips}

      {isQuotaReached && maxSelectionsLabel && (
        <p className="text-warning-ink text-xs">
          {maxSelectionsLabel(maxSelections)}
        </p>
      )}
    </div>
  )
}
