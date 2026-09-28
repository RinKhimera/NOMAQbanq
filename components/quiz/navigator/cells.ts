import type { AnswersMap, QuizQuestion } from "@/components/quiz/runner/types"
import { type AnswerOutcome, classify } from "@/lib/score"

/** Passation : `answered` / `unanswered`. Correction : le verdict (`classify`). */
export type NavigatorCellState = "answered" | AnswerOutcome

export type NavigatorCell = { state: NavigatorCellState; flagged: boolean }

/**
 * Cases du navigateur en passation : répondue ou non, marquée ou non. La
 * justesse n'y figure jamais, même connue (mode tuteur).
 */
export const passationCells = (
  questions: readonly { _id: string }[],
  answers: AnswersMap,
  flagged: ReadonlySet<string>,
): NavigatorCell[] =>
  questions.map((q) => ({
    state: answers[q._id] ? "answered" : "unanswered",
    flagged: flagged.has(q._id),
  }))

export const correctionCells = (
  questions: readonly Pick<QuizQuestion, "_id" | "keyWithheld">[],
  answers: AnswersMap,
): NavigatorCell[] =>
  questions.map((q) => ({
    state: classify(q, answers[q._id]),
    flagged: false,
  }))
