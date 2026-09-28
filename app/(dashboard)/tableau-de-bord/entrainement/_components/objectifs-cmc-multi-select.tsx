"use client"

import { useMemo, useState } from "react"
import { MultiCombobox } from "@/components/shared/multi-combobox"

interface ObjectifsCMCMultiSelectProps {
  objectifs: Array<{ objectif: string; count: number }>
  selectedObjectifs: string[]
  onChange: (selected: string[]) => void
  disabled?: boolean
  maxSelections?: number
  isLoading?: boolean
}

const plural = (n: number) => (n > 1 ? "s" : "")

export function ObjectifsCMCMultiSelect({
  objectifs,
  selectedObjectifs,
  onChange,
  disabled = false,
  maxSelections = 10,
  isLoading = false,
}: ObjectifsCMCMultiSelectProps) {
  const [searchValue, setSearchValue] = useState("")

  const counts = useMemo(
    () => new Map((objectifs ?? []).map((o) => [o.objectif, o.count])),
    [objectifs],
  )

  const options = useMemo(() => {
    const search = searchValue.trim().toLowerCase()
    return (objectifs ?? [])
      .map((o) => o.objectif)
      .filter((o) => !search || o.toLowerCase().includes(search))
      .slice(0, 50)
  }, [objectifs, searchValue])

  return (
    <MultiCombobox
      options={options}
      selected={selectedObjectifs}
      onChange={onChange}
      getKey={(o) => o}
      getLabel={(o) => o}
      renderOption={(o) => (
        <>
          <span className="flex-1">{o}</span>
          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {counts.get(o)}
          </span>
        </>
      )}
      search={searchValue}
      onSearchChange={setSearchValue}
      placeholder="Sélectionner des objectifs CMC..."
      searchPlaceholder="Rechercher un objectif CMC..."
      emptyText="Aucun objectif trouvé."
      selectedLabel={(n) => `${n} objectif${plural(n)} sélectionné${plural(n)}`}
      isLoading={isLoading}
      disabled={disabled}
      disableTriggerWhileLoading
      maxSelections={maxSelections}
      maxSelectionsLabel={(max) => `Maximum de ${max} objectifs atteint`}
      clearable
      triggerClassName="h-12 rounded-xl border-gray-200 bg-white/60 text-base shadow-sm hover:border-emerald-300 dark:border-gray-700 dark:bg-gray-800/60 dark:hover:border-emerald-700"
      contentClassName="w-100"
      chipClassName="rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
    />
  )
}
