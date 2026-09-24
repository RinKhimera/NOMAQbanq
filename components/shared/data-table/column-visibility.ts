import { useCallback, useState } from "react"
import type { ColumnPreference } from "./column-preferences"

/**
 * Largeur du TABLEAU (pas de l'écran) à partir de laquelle une colonne
 * s'affiche par défaut ; `never` = masquée par défaut. La barre latérale ou un
 * formulaire autour réduisent la place du tableau bien plus que l'écran ne le
 * laisse deviner.
 */
export type VisibleFrom = "medium" | "wide" | "never"

export type WidthTier = "narrow" | "medium" | "wide"

/** Seuils en rem, repris tels quels par les classes de conteneur de `DataTable`. */
export const TIER_MIN_REM = { medium: 36, wide: 54 } as const

/**
 * `auto` : aucun choix enregistré pour cette colonne, son affichage suit la
 * largeur du tableau (en CSS, donc juste dès le rendu serveur).
 */
export type ColumnVisibility = "auto" | "shown" | "hidden"

type VisibilityColumn = {
  id: string
  required?: boolean
  visibleFrom?: VisibleFrom
}

export function resolveVisibility(
  columns: readonly VisibilityColumn[],
  preference: ColumnPreference | null,
): Map<string, ColumnVisibility> {
  return new Map(
    columns.map((column) => {
      if (column.required) return [column.id, "shown"]
      if (!preference || !preference.known.includes(column.id))
        return [column.id, "auto"]
      return [
        column.id,
        preference.visible.includes(column.id) ? "shown" : "hidden",
      ]
    }),
  )
}

const TIER_RANK: Record<WidthTier, number> = { narrow: 0, medium: 1, wide: 2 }

export function isShownByDefault(
  visibleFrom: VisibleFrom | undefined,
  tier: WidthTier,
) {
  if (visibleFrom === undefined) return true
  if (visibleFrom === "never") return false
  return TIER_RANK[tier] >= TIER_RANK[visibleFrom]
}

export function isEffectivelyShown(
  column: VisibilityColumn,
  visibility: Map<string, ColumnVisibility>,
  tier: WidthTier,
) {
  const state = visibility.get(column.id) ?? "auto"
  if (state === "auto") return isShownByDefault(column.visibleFrom, tier)
  return state === "shown"
}

/**
 * Nouvelle préférence après avoir basculé une colonne : fige l'affichage
 * effectif courant (paliers compris) de toutes les colonnes masquables, puis
 * inverse la colonne visée.
 */
export function toggleColumn(
  columns: readonly VisibilityColumn[],
  visibility: Map<string, ColumnVisibility>,
  tier: WidthTier,
  columnId: string,
): ColumnPreference {
  const hideable = columns.filter((column) => !column.required)
  const visible = hideable
    .filter((column) => {
      const shown = isEffectivelyShown(column, visibility, tier)
      return column.id === columnId ? !shown : shown
    })
    .map((column) => column.id)
  return { visible, known: hideable.map((column) => column.id) }
}

function tierOf(widthPx: number): WidthTier {
  const rootFontPx =
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  if (widthPx >= TIER_MIN_REM.wide * rootFontPx) return "wide"
  if (widthPx >= TIER_MIN_REM.medium * rootFontPx) return "medium"
  return "narrow"
}

/**
 * Palier courant du tableau, mesuré sur son conteneur. Sert au seul menu
 * « Colonnes » (cases cochées, figement du premier choix) : l'affichage des
 * colonnes, lui, passe par les requêtes de conteneur CSS.
 */
export function useWidthTier<T extends HTMLElement>() {
  const [tier, setTier] = useState<WidthTier>("wide")
  const ref = useCallback((element: T | null) => {
    if (!element) return
    const measure = () => setTier(tierOf(element.clientWidth))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, tier }
}
