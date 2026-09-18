import type { AnswersMap, QuizQuestion } from "@/components/quiz/runner/types"

// Module sans directive : appelé par les pages (Server Components) ET par
// `SessionResults` (client). Un export d'un module « use client » importé côté
// serveur n'est qu'une référence client, pas une fonction appelable.

export const SCORE_WITHHELD_MESSAGE =
  "Score disponible après la clôture de l'examen"

/** Sparse-answer compat : clé absente OU entrée sans `selected` = non répondu. */
export const hasSelected = (
  entry: AnswersMap[string] | undefined,
): entry is AnswersMap[string] =>
  entry !== undefined &&
  entry.selected !== undefined &&
  entry.selected !== null &&
  entry.selected !== ""

/**
 * Le score enregistré agrège TOUTES les réponses, différées comprises, alors que
 * les compteurs affichés les excluent : « score × N / 100 − justes affichées »
 * révélerait combien de différées sont justes. Tant qu'une réponse est différée,
 * le score n'est donc pas restitué. Une question à clé retenue SANS réponse ne
 * pèse rien dans le score : elle ne le retient pas.
 */
export const isScoreWithheld = (
  questions: readonly QuizQuestion[],
  answers: AnswersMap,
): boolean =>
  questions.some((q) => q.keyWithheld === true && hasSelected(answers[q._id]))
