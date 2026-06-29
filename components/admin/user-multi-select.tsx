"use client"

import { Check, ChevronsUpDown, LoaderCircle, Users, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
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
import { loadSearchSelectableUsers } from "@/features/exams/actions"
import type { SelectableUser } from "@/features/users/dal"
import { cn } from "@/lib/utils"

const SEARCH_LIMIT = 50

interface UserMultiSelectProps {
  /** Utilisateurs actuellement sélectionnés (objets complets). */
  value: SelectableUser[]
  /** Appelé avec la nouvelle sélection complète à chaque ajout/retrait. */
  onChange: (next: SelectableUser[]) => void
  disabled?: boolean
}

/**
 * [Admin] Multi-select recherchable d'utilisateurs (audience d'examen restreinte).
 * Recherche SERVEUR débouncée (300 ms) via `loadSearchSelectableUsers` —
 * `Command shouldFilter={false}` car le filtrage est fait côté serveur, pas par
 * cmdk. Cliquer un résultat le toggle (ajoute/retire) sans fermer le popover
 * (multi-sélection). Les sélectionnés sont affichés en `Badge` retirables.
 */
export function UserMultiSelect({
  value,
  onChange,
  disabled,
}: UserMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SelectableUser[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Recherche serveur débouncée (300 ms). Le `setState` se produit dans un
  // callback async (pas synchrone dans l'effet) → ne déclenche pas la règle
  // ESLint `react-hooks/set-state-in-effect`.
  useEffect(() => {
    setIsLoading(true)
    const handle = setTimeout(async () => {
      try {
        const rows = await loadSearchSelectableUsers({
          query,
          limit: SEARCH_LIMIT,
        })
        setResults(rows)
      } catch (error) {
        console.error("loadSearchSelectableUsers", error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [query])

  const toggleUser = (u: SelectableUser) => {
    const isSelected = value.some((sel) => sel.id === u.id)
    if (isSelected) {
      onChange(value.filter((sel) => sel.id !== u.id))
    } else {
      onChange([...value, u])
    }
  }

  const removeUser = (id: string) => {
    onChange(value.filter((sel) => sel.id !== id))
  }

  return (
    <div className="space-y-3">
      {/* Sélectionnés en badges retirables */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((u) => (
            <Badge
              key={u.id}
              variant="secondary"
              className="flex items-center gap-1.5 py-1 pr-1 pl-2.5"
            >
              <span className="max-w-50 truncate">{u.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeUser(u.id)}
                aria-label={`Retirer ${u.name}`}
                className="hover:bg-foreground/10 rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between rounded-xl font-normal"
          >
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              {value.length > 0
                ? `${value.length} utilisateur${value.length > 1 ? "s" : ""} sélectionné${value.length > 1 ? "s" : ""}`
                : "Rechercher et sélectionner des utilisateurs..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Rechercher par nom ou email..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {isLoading ? (
                <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Recherche...
                </div>
              ) : (
                <>
                  <CommandEmpty>Aucun utilisateur trouvé.</CommandEmpty>
                  <CommandGroup>
                    {results.map((u) => {
                      const isSelected = value.some((sel) => sel.id === u.id)
                      return (
                        <CommandItem
                          key={u.id}
                          value={u.id}
                          onSelect={() => toggleUser(u)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              isSelected ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{u.name}</p>
                            <p className="text-muted-foreground truncate text-xs">
                              {u.email}
                            </p>
                          </div>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                  {results.length >= SEARCH_LIMIT && (
                    <p className="text-muted-foreground border-t px-3 py-2 text-center text-xs">
                      Affinez la recherche pour voir plus de résultats
                    </p>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
