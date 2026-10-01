import { QUESTION_SUCCESS_MIN_ANSWERS } from "@/features/analytics/question-success-threshold"
import { formatMediumDate } from "@/lib/format"

// Module pur (pas de "use client") : appelé aussi par des Server Components.

/** « 1 réponse », « 12 réponses » (séparateur de milliers fr-CA). */
export const countLabel = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString("fr-CA")} ${n > 1 ? many : one}`

export const answersLabel = (n: number) => countLabel(n, "réponse")

/** Sous ce nombre de réponses, un taux de réussite n'est pas significatif. */
export const isSignificant = (answerCount: number) =>
  answerCount >= QUESTION_SUCCESS_MIN_ANSWERS

export { QUESTION_SUCCESS_MIN_ANSWERS }

/** « Question du 12 sept. 2026 » : une question n'a pas de titre. */
export const questionTitle = (createdAt: number) =>
  `Question du ${formatMediumDate(createdAt)}`

/** Part arrondie en pourcentage ; 0 sans réponse. */
export const percent = (count: number, total: number) =>
  total === 0 ? 0 : Math.round((100 * count) / total)
