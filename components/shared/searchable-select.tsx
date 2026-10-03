"use client"

import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { useState } from "react"
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
import { foldForSearch } from "@/lib/search"
import { cn } from "@/lib/utils"

export type SearchableOption = {
  value: string
  label: string
  /** Complément en mono à droite (phase d'un examen, effectif). */
  hint?: string
  /** Intitulé du groupe ; les options d'un même groupe se suivent. */
  group?: string
}

type SearchableSelectProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  options: readonly SearchableOption[]
  /** Libellé du déclencheur sans valeur. */
  placeholder: string
  searchPlaceholder: string
  /** Première entrée qui remet la valeur à vide (« Tous les examens »). */
  clearLabel?: string
  /** Propose « Créer « … » » quand la recherche ne correspond à aucune option. */
  creatable?: boolean
  /**
   * Création confiée à l'appelant (qui choisit ensuite la nouvelle valeur) ;
   * sans elle, le texte saisi devient la valeur.
   */
  onCreate?: (label: string) => void
  emptyText?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
}

/** Choix unique dans une longue liste, avec recherche et, au besoin, création libre. */
export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  clearLabel,
  creatable = false,
  onCreate,
  emptyText = "Aucun résultat",
  disabled = false,
  invalid = false,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const term = foldForSearch(search)
  const shown = term
    ? options.filter((o) => foldForSearch(o.label).includes(term))
    : options
  const canCreate =
    (creatable || !!onCreate) &&
    term !== "" &&
    !options.some((o) => foldForSearch(o.label) === term)
  const current = options.find((o) => o.value === value)
  const groups = groupOptions(shown)

  const pick = (next: string) => {
    onChange(next)
    setOpen(false)
    setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-ink-3",
            className,
          )}
        >
          <span className="truncate">
            {current?.label ?? (value || clearLabel || placeholder)}
          </span>
          <ChevronsUpDown aria-hidden className="text-ink-3 size-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-72 p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {shown.length === 0 && !canCreate && (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            {clearLabel && !term && (
              <CommandGroup>
                <CommandItem value="__clear" onSelect={() => pick("")}>
                  <Check
                    aria-hidden
                    className={cn("size-4", value ? "opacity-0" : "")}
                  />
                  {clearLabel}
                </CommandItem>
              </CommandGroup>
            )}
            {groups.map(({ heading, items }) => (
              <CommandGroup key={heading ?? ""} heading={heading}>
                {items.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.value}
                    onSelect={() => pick(o.value)}
                  >
                    <Check
                      aria-hidden
                      className={cn(
                        "size-4",
                        value === o.value ? "" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1">{o.label}</span>
                    {o.hint && (
                      <span className="text-ink-3 font-mono text-[11px]">
                        {o.hint}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {canCreate && (
              <CommandGroup>
                <CommandItem
                  value="__create"
                  onSelect={() => {
                    if (!onCreate) return pick(search.trim())
                    onCreate(search.trim())
                    setOpen(false)
                    setSearch("")
                  }}
                >
                  <Plus aria-hidden className="size-4" />
                  Créer « {search.trim()} »
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** Options regroupées dans l'ordre de leur première apparition. */
const groupOptions = (options: readonly SearchableOption[]) => {
  const groups: { heading?: string; items: SearchableOption[] }[] = []
  for (const option of options) {
    const last = groups.at(-1)
    if (last && last.heading === option.group) last.items.push(option)
    else groups.push({ heading: option.group, items: [option] })
  }
  return groups
}
