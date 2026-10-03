/**
 * Règles d'un libellé du référentiel des objectifs du CMC, partagées par le
 * formulaire et le serveur. Pur (client + serveur). La migration
 * `0023_cmc_objectives` applique le même nettoyage et les mêmes règles en SQL.
 */

export const OBJECTIVE_LABEL_MIN = 3
export const OBJECTIVE_LABEL_MAX = 120

/** Nettoyage qui ne change pas le sens : NFC, espaces de bord, espaces doublés. */
export const normalizeObjectiveLabel = (label: string): string =>
  label.normalize("NFC").trim().replace(/ {2,}/g, " ")

/**
 * Clé de comparaison : deux libellés de même clé sont des variantes d'un même
 * objectif. Ignore accents, casse, ponctuation et espaces ; ne rapproche ni
 * les pluriels ni les fautes. Plus stricte que `foldForSearch`, qui garde la
 * ponctuation.
 */
export const objectiveKey = (label: string): string =>
  label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/[^\p{L}\p{N}]/gu, "")

/** Problèmes d'un libellé déjà nettoyé, dans l'ordre d'affichage. */
export const objectiveLabelProblems = (label: string): string[] => {
  const problems: string[] = []
  const length = [...label].length
  if (length < OBJECTIVE_LABEL_MIN)
    problems.push(`Moins de ${OBJECTIVE_LABEL_MIN} caractères`)
  if (length > OBJECTIVE_LABEL_MAX)
    problems.push(`Plus de ${OBJECTIVE_LABEL_MAX} caractères`)
  if (!/\p{L}/u.test(label)) problems.push("Aucune lettre")
  if (label.includes("\t")) problems.push("Contient une tabulation")
  return problems
}

/** Message de refus d'un libellé saisi, `null` s'il respecte les règles. */
export const objectiveLabelError = (raw: string): string | null => {
  const label = normalizeObjectiveLabel(raw)
  if (label === "") return "Le libellé est requis."
  const length = [...label].length
  if (length < OBJECTIVE_LABEL_MIN)
    return `Le libellé compte ${OBJECTIVE_LABEL_MIN} caractères au moins.`
  if (length > OBJECTIVE_LABEL_MAX)
    return `Le libellé compte ${OBJECTIVE_LABEL_MAX} caractères au plus : un énoncé a sans doute été collé.`
  if (!/\p{L}/u.test(label)) return "Le libellé doit contenir une lettre."
  if (label.includes("\t"))
    return "Le libellé ne peut pas contenir de tabulation."
  return null
}
