"use client"

import { Users } from "lucide-react"
import { useEffect, useState } from "react"
import { MultiCombobox } from "@/components/shared/multi-combobox"
import { loadSearchSelectableUsers } from "@/features/exams/actions"
import type { SelectableUser } from "@/features/users/dal"

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
 * cmdk. Cliquer un résultat l'ajoute ou le retire sans fermer la liste.
 */
export function UserMultiSelect({
  value,
  onChange,
  disabled,
}: UserMultiSelectProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SelectableUser[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Le chargement s'allume à la frappe, pas dans l'effet : un `setState`
  // synchrone dans l'effet enfreint `react-hooks/set-state-in-effect`.
  const changeQuery = (next: string) => {
    if (next === query) return
    setQuery(next)
    setIsLoading(true)
  }

  // Recherche serveur débouncée (300 ms). Le drapeau `cancelled` ignore une
  // requête déjà partie : si l'utilisateur tape vite, une réponse lente d'une
  // recherche obsolète ne doit pas écraser une plus récente (le clearTimeout
  // seul ne couvre que le timer non encore déclenché).
  useEffect(() => {
    let cancelled = false
    const handle = setTimeout(async () => {
      try {
        const rows = await loadSearchSelectableUsers({
          query,
          limit: SEARCH_LIMIT,
        })
        if (!cancelled) setResults(rows)
      } catch (error) {
        console.error("loadSearchSelectableUsers", error)
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query])

  return (
    <MultiCombobox
      options={results}
      selected={value}
      onChange={onChange}
      getKey={(u) => u.id}
      getLabel={(u) => u.name}
      renderOption={(u) => (
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{u.name}</p>
          <p className="text-ink-3 truncate text-xs">{u.email}</p>
        </div>
      )}
      search={query}
      onSearchChange={changeQuery}
      placeholder="Rechercher et sélectionner des utilisateurs..."
      searchPlaceholder="Rechercher par nom ou email..."
      emptyText="Aucun utilisateur trouvé."
      selectedLabel={(n) =>
        `${n} utilisateur${n > 1 ? "s" : ""} sélectionné${n > 1 ? "s" : ""}`
      }
      isLoading={isLoading}
      loadingText="Recherche..."
      disabled={disabled}
      triggerIcon={Users}
      triggerClassName="rounded-md"
      chipsFirst
      modal
      listFooter={
        results.length >= SEARCH_LIMIT && (
          <p className="text-ink-3 border-t px-3 py-2 text-center text-xs">
            Affinez la recherche pour voir plus de résultats
          </p>
        )
      }
    />
  )
}
