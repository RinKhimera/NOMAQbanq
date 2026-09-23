import type {
  AnswerState,
  AnswersMap,
  QuizQuestion,
} from "@/components/quiz/runner/types"

/**
 * AttemptScore — le score d'une tentative et sa lecture. Module pur, partagé
 * par les composants de résultats ; la jumelle SQL des crons de clôture est
 * `scoreSql` (`features/attempts/score.ts`), confrontée à
 * `computeScorePercent` par `tests/integration/score-parity.test.ts`.
 */

// Arrondi half-up EXACT en arithmétique entière — parité stricte avec
// `round(correct * 100.0 / total)` (numeric SQL) des crons de clôture.
// `Math.round((correct / total) * 100)` en float diverge sur les demi-points
// (ex. 23/40 → 57.4999… → 57 au lieu de 58).
export const computeScorePercent = (correct: number, total: number): number =>
  total > 0 ? Math.floor((200 * correct + total) / (2 * total)) : 0

/** Score affichable, ou « — » quand il est retenu (`null`, voir `scoreWithheldFor`). */
export const formatScore = (score: number | null): string =>
  score === null ? "—" : `${score}%`

/** Percentile d'examen en phrase, pour un percentile disponible. */
export const formatPercentile = (percentile: number): string =>
  `Mieux que ${percentile} % des participants`

export type AnswerOutcome = "correct" | "incorrect" | "unanswered" | "withheld"

// Sparse-answer compat : clé absente OU entrée sans `selected` = non répondu.
const hasSelected = (entry: AnswerState | undefined): entry is AnswerState =>
  entry !== undefined &&
  entry.selected !== undefined &&
  entry.selected !== null &&
  entry.selected !== ""

/**
 * Verdict d'une réponse pour la lecture. Une réponse dont la clé est retenue
 * (`keyWithheld`) n'est ni juste ni fausse : elle est différée. Une réponse
 * sans verdict n'est jamais juste par défaut.
 */
export const classify = (
  question: Pick<QuizQuestion, "keyWithheld">,
  entry: AnswerState | undefined,
): AnswerOutcome => {
  if (!hasSelected(entry)) return "unanswered"
  if (question.keyWithheld) return "withheld"
  return entry.isCorrect ? "correct" : "incorrect"
}

export type AttemptSummary = Record<AnswerOutcome, number> & {
  /**
   * Le score enregistré compte les réponses différées alors que les compteurs
   * les excluent : l'afficher à côté d'elles révélerait par soustraction
   * combien sont justes. Jumeau client de `scoreWithheldFor` (DAL).
   */
  scoreWithheld: boolean
}

export const summarize = (
  questions: readonly Pick<QuizQuestion, "_id" | "keyWithheld">[],
  answers: AnswersMap,
): AttemptSummary => {
  const counts = { correct: 0, incorrect: 0, unanswered: 0, withheld: 0 }
  for (const question of questions) {
    counts[classify(question, answers[question._id])]++
  }
  return { ...counts, scoreWithheld: counts.withheld > 0 }
}
