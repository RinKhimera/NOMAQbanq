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

/** Seuil de réussite d'un examen blanc comme d'une série. */
export const PASS_THRESHOLD = 60
const EXCELLENT_THRESHOLD = 80

export type ScoreTone = "success" | "warning" | "danger"

/** Échelle unique des scores : ≥ 80 réussite nette, ≥ 60 réussite juste, sinon échec. */
export const scoreTone = (score: number): ScoreTone => {
  if (score >= EXCELLENT_THRESHOLD) return "success"
  if (score >= PASS_THRESHOLD) return "warning"
  return "danger"
}

export const isPassing = (score: number): boolean => score >= PASS_THRESHOLD

export const SCORE_TONE_TEXT: Record<ScoreTone, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
}

/** Couleur d'un score lisible ; neutre quand il est retenu : la tranche le trahirait. */
export const scoreTextClass = (score: number | null): string =>
  score === null
    ? "text-gray-500 dark:text-gray-400"
    : SCORE_TONE_TEXT[scoreTone(score)]

/** Score affichable, ou « — » quand il est retenu (`null`, voir `scoreWithheldFor`). */
export const formatScore = (score: number | null): string =>
  score === null ? "—" : `${score}%`

/**
 * Percentile d'examen en phrase, pour un percentile disponible. `participant` :
 * le lecteur n'est pas celui dont on parle (un admin consulte ses résultats).
 */
export const formatPercentile = (
  percentile: number,
  subject: "self" | "participant" = "self",
): string =>
  `${subject === "self" ? "Vous avez fait" : "A fait"} mieux que ${percentile} % des autres participants`

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
