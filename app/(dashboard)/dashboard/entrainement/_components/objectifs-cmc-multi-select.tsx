"use client"

import { useState, useMemo } from "react"
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react"
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
import { cn } from "@/lib/utils"

interface ObjectifsCMCMultiSelectProps {
  objectifs: Array<{ objectif: string; count: number }>
  selectedObjectifs: string[]
  onChange: (selected: string[]) => void
  disabled?: boolean
  maxSelections?: number
  isLoading?: boolean
}

export function ObjectifsCMCMultiSelect({
  objectifs,
  selectedObjectifs,
  onChange,
  disabled = false,
  maxSelections = 10,
  isLoading = false,
}: ObjectifsCMCMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  // Filter objectifs based on search
  const filteredObjectifs = useMemo(() => {
    if (!objectifs) return []

    let filtered = objectifs
    if (searchValue.trim()) {
      const lowerSearch = searchValue.toLowerCase()
      filtered = objectifs.filter((obj) =>
        obj.objectif.toLowerCase().includes(lowerSearch),
      )
    }

    // Limiter à 50 résultats pour performance
    return filtered.slice(0, 50)
  }, [objectifs, searchValue])

  const handleSelect = (objectif: string) => {
    if (selectedObjectifs.includes(objectif)) {
      // Retirer
      onChange(selectedObjectifs.filter((o) => o !== objectif))
    } else {
      // Ajouter (si quota non atteint)
      if (selectedObjectifs.length < maxSelections) {
        onChange([...selectedObjectifs, objectif])
      }
    }
  }

  const handleRemove = (objectif: string) => {
    onChange(selectedObjectifs.filter((o) => o !== objectif))
  }

  const handleClearAll = () => {
    onChange([])
  }

  const isQuotaReached = selectedObjectifs.length >= maxSelections

  return (
    <div className="space-y-3">
      {/* Popover pour sélection */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isLoading}
            className={cn(
              "h-12 w-full justify-between rounded-xl border-gray-200 bg-white/60 text-base shadow-sm transition-all hover:border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-800/60 dark:hover:border-emerald-700",
              selectedObjectifs.length === 0 && "text-muted-foreground",
            )}
          >
            {selectedObjectifs.length === 0 ? (
              "Sélectionner des objectifs CMC..."
            ) : (
              <span className="truncate">
                {selectedObjectifs.length} objectif
                {selectedObjectifs.length > 1 ? "s" : ""} sélectionné
                {selectedObjectifs.length > 1 ? "s" : ""}
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-100 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Rechercher un objectif CMC..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">
                    Chargement...
                  </span>
                </div>
              ) : (
                <>
                  {filteredObjectifs.length === 0 && (
                    <CommandEmpty>Aucun objectif trouvé.</CommandEmpty>
                  )}

                  {filteredObjectifs.length > 0 && (
                    <CommandGroup>
                      {filteredObjectifs.map((obj) => {
                        const isSelected = selectedObjectifs.includes(
                          obj.objectif,
                        )

                        return (
                          <CommandItem
                            key={obj.objectif}
                            value={obj.objectif}
                            onSelect={() => handleSelect(obj.objectif)}
                            disabled={!isSelected && isQuotaReached}
                            className="gap-2"
                          >
                            <div
                              className={cn(
                                "flex h-4 w-4 items-center justify-center rounded border",
                                isSelected
                                  ? "border-emerald-500 bg-emerald-500"
                                  : "border-gray-300",
                              )}
                            >
                              {isSelected && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <span className="flex-1">{obj.objectif}</span>
                            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                              {obj.count}
                            </span>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Affichage des sélections avec badges */}
      {selectedObjectifs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {selectedObjectifs.map((objectif) => (
            <Badge
              key={objectif}
              variant="secondary"
              className="gap-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            >
              {objectif}
              <button
                type="button"
                onClick={() => handleRemove(objectif)}
                className="ml-1 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selectedObjectifs.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-7 text-xs text-gray-500 hover:text-gray-700"
            >
              Tout effacer
            </Button>
          )}
        </div>
      )}

      {/* Info quota */}
      {isQuotaReached && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Maximum de {maxSelections} objectifs atteint
        </p>
      )}
    </div>
  )
}
