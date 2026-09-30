/**
 * Clé d'une table « valeur interne → paramètre d'URL » dont le paramètre vaut
 * `value` ; `undefined` pour une valeur absente ou inconnue.
 */
export const keyForParam = <K extends string>(
  table: Record<K, string | null>,
  value: string | null | undefined,
): K | undefined =>
  (Object.keys(table) as K[]).find(
    (k) => value !== null && value !== undefined && table[k] === value,
  )
