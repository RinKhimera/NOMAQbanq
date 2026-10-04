import type { ClientFilter } from "@/features/payments/dal"
import { keyForParam } from "@/lib/url-param"

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
  keyForParam(CLIENT_FILTER_PARAM, value) ?? "all"

/**
 * Paramètres de l'URL après un changement de recherche ou de filtre : retour
 * en tête de liste (les curseurs de tranche tombent), client ouvert conservé.
 * La transaction dépliée tombe aussi : sans curseur, `tx` placerait la liste
 * sur la tranche du client au lieu de la tête.
 */
export const listParams = (
  current: URLSearchParams,
  changes: { q?: string; filter?: ClientFilter },
): URLSearchParams => {
  const next = new URLSearchParams(current)
  next.delete("apres")
  next.delete("avant")
  next.delete("tx")
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
