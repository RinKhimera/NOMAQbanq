"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

/**
 * État d'une liste filtrée qui vit dans l'URL : la page serveur le lit, l'écran
 * le réécrit dans une transition (rechargement en place). Porte le champ de
 * recherche débouncé et le « dernier état demandé ».
 */
export const useUrlListState = <S extends { q: string }>({
  state,
  serialize,
  withSearch,
}: {
  /** État lu par la page serveur. */
  state: S
  serialize: (state: S) => URLSearchParams
  /** État après une nouvelle recherche (en général : page 1). */
  withSearch: (state: S, q: string) => S
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(state.q)
  // Recherche envoyée par la frappe : un `q` d'URL qui en diffère vient
  // d'ailleurs (retour arrière, lien, « Effacer les filtres ») et réaligne le
  // champ.
  const [sentQ, setSentQ] = useState(state.q)
  if (state.q !== sentQ) {
    setSentQ(state.q)
    setSearch(state.q)
  }

  // Dernier état demandé : pendant un rechargement, `state` (les props) est
  // encore l'ancien, et un second changement effacerait le premier.
  const requested = useRef(state)
  useEffect(() => {
    requested.current = state
  }, [state])
  const latest = () => requested.current

  const go = (next: S) =>
    startTransition(() => {
      requested.current = next
      const params = serialize(next)
      router.replace(params.size ? `${pathname}?${params}` : pathname, {
        scroll: false,
      })
    })

  useDebouncedValue(search, 300, (value) => {
    const q = value.trim()
    if (q === latest().q) return
    setSentQ(q)
    go(withSearch(latest(), q))
  })

  return { search, setSearch, isPending, startTransition, latest, go }
}
