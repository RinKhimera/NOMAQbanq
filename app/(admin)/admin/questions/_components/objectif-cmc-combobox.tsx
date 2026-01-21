"use client"

import { useState, useMemo } from "react"
import { useQuery } from "convex/react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
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
import { api } from "@/convex/_generated/api"
import { cn } from "@/lib/utils"

interface ObjectifCMCComboboxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function ObjectifCMCCombobox({
  value,
  onChange,
  placeholder = "Sélectionner ou saisir un objectif CMC...",
  disabled = false,
}: ObjectifCMCComboboxProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  const objectifs = useQuery(api.questions.getUniqueObjectifsCMC)
  const isLoading = objectifs === undefined

  // Filter objectifs based on search
  const filteredObjectifs = useMemo(() => {
    if (!objectifs) return []
    if (!searchValue.trim()) return objectifs.slice(0, 50) // Limit for performance

    const lowerSearch = searchValue.toLowerCase()
    return objectifs
      .filter((obj) => obj.toLowerCase().includes(lowerSearch))
      .slice(0, 50)
  }, [objectifs, searchValue])

  // Check if search value is a new value (not in the list)
  const isNewValue = useMemo(() => {
    if (!searchValue.trim() || !objectifs) return false
    return !objectifs.some(
      (obj) => obj.toLowerCase() === searchValue.toLowerCase()
    )
  }, [objectifs, searchValue])

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue)
    setOpen(false)
    setSearchValue("")
  }

  const handleCreateNew = () => {
    if (searchValue.trim()) {
      onChange(searchValue.trim())
      setOpen(false)
      setSearchValue("")
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground"
          )}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Rechercher ou créer..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Chargement...</span>
              </div>
            ) : (
              <>
                {filteredObjectifs.length === 0 && !isNewValue && (
                  <CommandEmpty>Aucun objectif trouvé.</CommandEmpty>
                )}

                {/* Option to create new value */}
                {isNewValue && (
                  <CommandGroup heading="Créer nouveau">
                    <CommandItem
                      value={`create-${searchValue}`}
                      onSelect={handleCreateNew}
                      className="gap-2"
                    >
                      <span className="text-blue-600">+</span>
                      Créer &quot;{searchValue}&quot;
                    </CommandItem>
                  </CommandGroup>
                )}

                {/* Existing objectifs */}
                {filteredObjectifs.length > 0 && (
                  <CommandGroup heading="Objectifs existants">
                    {filteredObjectifs.map((objectif) => (
                      <CommandItem
                        key={objectif}
                        value={objectif}
                        onSelect={() => handleSelect(objectif)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === objectif ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {objectif}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
