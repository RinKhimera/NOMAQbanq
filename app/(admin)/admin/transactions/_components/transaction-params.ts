import type { ClientFilter } from "@/features/payments/dal"

// Module pur : lu par la page serveur et par l'écran client (une constante
// d'un module "use client" deviendrait une référence client côté serveur).

/** Valeur du paramètre `filtre` de l'URL pour chaque filtre de la liste. */
export const CLIENT_FILTER_PARAM: Record<ClientFilter, string | null> = {
  all: null,
  failed: "echec",
  dispute: "litige",
  manual: "manuel",
}

export const parseClientFilter = (value: string | undefined): ClientFilter =>
  (Object.keys(CLIENT_FILTER_PARAM) as ClientFilter[]).find(
    (f) => value !== undefined && CLIENT_FILTER_PARAM[f] === value,
  ) ?? "all"

/**
 * Paramètres de l'URL après un changement de recherche ou de filtre : retour
 * en tête de liste (les curseurs de tranche tombent), client et transaction
 * ouverts conservés.
 */
export const listParams = (
  current: URLSearchParams,
  changes: { q?: string; filter?: ClientFilter },
): URLSearchParams => {
  const next = new URLSearchParams(current)
  next.delete("apres")
  next.delete("avant")
  if (changes.q !== undefined) {
    if (changes.q.trim()) next.set("q", changes.q.trim())
    else next.delete("q")
  }
  if (changes.filter !== undefined) {
    const value = CLIENT_FILTER_PARAM[changes.filter]
    if (value) next.set("filtre", value)
    else next.delete("filtre")
  }
  return next
}
