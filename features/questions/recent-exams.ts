/** Nombre d'examens récents par défaut (« question récente », `CONTEXT.md`). */
export const RECENT_EXAMS_DEFAULT = 3

/** Plus grand K du filtre « Pas utilisée depuis K examens ». */
export const NOT_USED_SINCE_MAX = 20

/** K du filtre lu dans l'URL (`depuis`), borné ; `null` = toutes. */
export const notUsedSinceParam = (raw: string | null): number | null => {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? Math.min(n, NOT_USED_SINCE_MAX) : null
}
