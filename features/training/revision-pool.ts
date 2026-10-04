import type { RevisionCriterion } from "./schemas"

/**
 * Compteurs du corpus de révision. Aux trois critères s'ajoutent leurs
 * recoupements avec « marquées » : ratées et non vues sont disjointes par
 * construction (une question ratée a été répondue), donc ces deux
 * intersections suffisent à compter les questions distinctes de toute
 * combinaison de critères sans redemander au serveur.
 */
export type RevisionCounts = Record<RevisionCriterion, number> & {
  bookmarkedFailed: number
  bookmarkedUnseen: number
}

export const EMPTY_REVISION_COUNTS: RevisionCounts = {
  failed: 0,
  unseen: 0,
  bookmarked: 0,
  bookmarkedFailed: 0,
  bookmarkedUnseen: 0,
}

/**
 * Questions distinctes retenues par au moins un des critères choisis
 * (inclusion-exclusion). Aucun critère : 0 — le récapitulatif lit alors le
 * corpus non filtré.
 */
export const revisionPoolSize = (
  counts: RevisionCounts,
  criteria: readonly RevisionCriterion[],
): number => {
  const has = (c: RevisionCriterion) => criteria.includes(c)
  let size = 0
  if (has("failed")) size += counts.failed
  if (has("unseen")) size += counts.unseen
  if (has("bookmarked")) {
    size += counts.bookmarked
    if (has("failed")) size -= counts.bookmarkedFailed
    if (has("unseen")) size -= counts.bookmarkedUnseen
  }
  return Math.max(0, size)
}
