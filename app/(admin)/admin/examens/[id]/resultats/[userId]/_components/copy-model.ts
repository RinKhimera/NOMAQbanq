import { optionLetter } from "@/components/quiz/question-card/answer-option"
import type { AnswersMap, QuizQuestion } from "@/components/quiz/runner/types"
import { type AnswerOutcome, classify } from "@/lib/score"

/** Réponse enregistrée d'une participation, telle que la DAL la renvoie. */
export type CopyAnswer = {
  questionId: string
  selectedAnswer: string | null
  isCorrect: boolean | null
  isFlagged: boolean
}

export type CopyFilter = "all" | "wrong" | "flagged"

export type CopyRow = {
  question: QuizQuestion
  /** Position dans l'examen, base 1. */
  number: number
  outcome: AnswerOutcome
  selected: string | null
  /** Verdict enregistré à la soumission (la clé a pu être corrigée depuis). */
  verdict: boolean | undefined
  flagged: boolean
  /** « A répondu B · bonne réponse C ». */
  summary: string
}

/** Carte des réponses (absence de ligne ou choix vide = sans réponse). */
export const toAnswersMap = (answers: readonly CopyAnswer[]): AnswersMap => {
  const map: AnswersMap = {}
  for (const a of answers) {
    if (a.selectedAnswer !== null && a.selectedAnswer !== "") {
      map[a.questionId] = {
        selected: a.selectedAnswer,
        isCorrect: a.isCorrect ?? undefined,
      }
    }
  }
  return map
}

const letterOf = (options: readonly string[], option: string | undefined) => {
  const index = option === undefined ? -1 : options.indexOf(option)
  return index === -1 ? null : optionLetter(index)
}

const summaryOf = (
  question: QuizQuestion,
  outcome: AnswerOutcome,
  selected: string | null,
): string => {
  if (outcome === "withheld") return "Correction différée"
  const key = letterOf(question.options, question.correctAnswer)
  const keyText = key ? `bonne réponse ${key}` : "clé introuvable"
  if (outcome === "unanswered") return `Sans réponse · ${keyText}`
  if (outcome === "correct" && key) return `Bonne réponse · ${key}`
  const chosen = letterOf(question.options, selected ?? undefined)
  return `${chosen ? `A répondu ${chosen}` : "A répondu un choix modifié depuis"} · ${keyText}`
}

export const copyRows = (
  questions: readonly QuizQuestion[],
  answers: readonly CopyAnswer[],
): CopyRow[] => {
  const map = toAnswersMap(answers)
  const flagged = new Set(
    answers.filter((a) => a.isFlagged).map((a) => a.questionId),
  )
  return questions.map((question, index) => {
    const entry = map[question._id]
    const outcome = classify(question, entry)
    const selected = entry?.selected ?? null
    return {
      question,
      number: index + 1,
      outcome,
      selected,
      verdict: entry?.isCorrect,
      flagged: flagged.has(question._id),
      summary: summaryOf(question, outcome, selected),
    }
  })
}

/** « Incorrectes » compte aussi les questions sans réponse. */
export const matchesFilter = (row: CopyRow, filter: CopyFilter): boolean => {
  if (filter === "wrong")
    return row.outcome === "incorrect" || row.outcome === "unanswered"
  if (filter === "flagged") return row.flagged
  return true
}
