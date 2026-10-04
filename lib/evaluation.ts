import type { AnswersMap, QuizQuestion } from "@/components/quiz/runner/types"
import { type ScoreTone, computeScorePercent, scoreTone } from "@/lib/score"

export type EvaluationOutcome = {
  /** Réponses au format de `SessionResults`, justesse fixée par la clé révélée. */
  answers: AnswersMap
  correct: number
  /** Questions corrigées : une clé retenue n'est ni juste ni fausse. */
  scored: number
  unanswered: number
  percent: number
  /** Domaines ratés ou laissés sans réponse, sans doublon, dans l'ordre. */
  weakDomains: string[]
}

/**
 * Bilan de l'évaluation gratuite, à partir des questions fusionnées avec la
 * correction renvoyée par le serveur et des choix de l'utilisateur (même ordre).
 */
export const evaluationOutcome = (
  questions: readonly QuizQuestion[],
  selections: readonly (string | null)[],
): EvaluationOutcome => {
  const answers: AnswersMap = {}
  const weak = new Set<string>()
  let correct = 0
  let scored = 0
  let unanswered = 0

  questions.forEach((q, i) => {
    const selected = selections[i] ?? null
    if (selected === null) unanswered++
    if (q.keyWithheld) {
      if (selected !== null) answers[q._id] = { selected }
      return
    }
    scored++
    const isCorrect = selected !== null && selected === q.correctAnswer
    if (selected !== null) answers[q._id] = { selected, isCorrect }
    if (isCorrect) correct++
    else weak.add(q.domain)
  })

  return {
    answers,
    correct,
    scored,
    unanswered,
    percent: computeScorePercent(correct, scored),
    weakDomains: [...weak],
  }
}

const VERDICT: Record<ScoreTone, string> = {
  success: "Très bonne base. Consolidez avec des examens blancs complets.",
  warning: "Bonne base. Quelques domaines demandent encore du travail.",
  danger:
    "Des lacunes à combler avant l'examen. Commencez par les domaines ci-dessous.",
}

export const evaluationVerdict = (percent: number): string =>
  VERDICT[scoreTone(percent)]
