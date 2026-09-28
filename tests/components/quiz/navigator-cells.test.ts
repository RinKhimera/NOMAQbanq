import { describe, expect, it } from "vitest"
import {
  correctionCells,
  passationCells,
} from "@/components/quiz/navigator/cells"

const questions = [{ _id: "q1" }, { _id: "q2" }, { _id: "q3" }]

describe("passationCells", () => {
  it("distingue répondue, sans réponse et marquée, sans rien révéler de la justesse", () => {
    const cells = passationCells(
      questions,
      { q1: { selected: "A", isCorrect: false }, q3: { selected: "B" } },
      new Set(["q2", "q3"]),
    )

    expect(cells).toEqual([
      { state: "answered", flagged: false },
      { state: "unanswered", flagged: true },
      { state: "answered", flagged: true },
    ])
  })
})

describe("correctionCells", () => {
  it("rend chaque verdict, et une clé retenue comme différée même si la réponse porte « juste »", () => {
    const cells = correctionCells(
      [...questions, { _id: "q4", keyWithheld: true }],
      {
        q1: { selected: "A", isCorrect: true },
        q2: { selected: "B", isCorrect: false },
        q4: { selected: "C", isCorrect: true },
      },
    )

    expect(cells.map((c) => c.state)).toEqual([
      "correct",
      "incorrect",
      "unanswered",
      "withheld",
    ])
  })
})
