import { describe, expect, it } from "vitest"
import type { QuizQuestion } from "@/components/quiz/runner/types"
import { evaluationOutcome, evaluationVerdict } from "@/lib/evaluation"
import { classify } from "@/lib/score"

const question = (
  id: string,
  domain: string,
  correctAnswer: string,
  extra: Partial<QuizQuestion> = {},
): QuizQuestion => ({
  _id: id,
  question: `Énoncé ${id}`,
  options: ["A", "B", "C", "D"],
  domain,
  objectifCMC: "Objectif",
  images: [],
  correctAnswer,
  ...extra,
})

describe("evaluationOutcome", () => {
  it("compte les bonnes réponses et convertit en pourcentage", () => {
    const outcome = evaluationOutcome(
      [
        question("q1", "Cardiologie", "A"),
        question("q2", "Neurologie", "B"),
        question("q3", "Pédiatrie", "C"),
      ],
      ["A", "D", null],
    )

    expect(outcome).toMatchObject({
      correct: 1,
      scored: 3,
      unanswered: 1,
      percent: 33,
    })
  })

  it("construit les réponses que SessionResults classe juste, fausse ou sans réponse", () => {
    const questions = [
      question("q1", "Cardiologie", "A"),
      question("q2", "Neurologie", "B"),
      question("q3", "Pédiatrie", "C"),
    ]
    const { answers } = evaluationOutcome(questions, ["A", "D", null])

    expect(questions.map((q) => classify(q, answers[q._id]))).toEqual([
      "correct",
      "incorrect",
      "unanswered",
    ])
  })

  it("laisse une question à clé retenue différée, hors du score et des domaines à travailler", () => {
    const withheld = question("q2", "Neurologie", "", { keyWithheld: true })
    const outcome = evaluationOutcome(
      [question("q1", "Cardiologie", "A"), withheld],
      ["A", "B"],
    )

    expect(classify(withheld, outcome.answers.q2)).toBe("withheld")
    expect(outcome).toMatchObject({ correct: 1, scored: 1, percent: 100 })
    expect(outcome.weakDomains).toEqual([])
  })

  it("liste une fois chaque domaine raté ou sans réponse, dans l'ordre des questions", () => {
    const { weakDomains } = evaluationOutcome(
      [
        question("q1", "Psychiatrie", "A"),
        question("q2", "Cardiologie", "A"),
        question("q3", "Psychiatrie", "A"),
        question("q4", "Neurologie", "A"),
      ],
      ["B", "A", null, "C"],
    )

    expect(weakDomains).toEqual(["Psychiatrie", "Neurologie"])
  })
})

describe("evaluationVerdict", () => {
  it("suit les seuils de score 80 et 60", () => {
    expect(evaluationVerdict(80)).toBe(
      "Très bonne base. Consolidez avec des examens blancs complets.",
    )
    expect(evaluationVerdict(60)).toBe(
      "Bonne base. Quelques domaines demandent encore du travail.",
    )
    expect(evaluationVerdict(59)).toBe(
      "Des lacunes à combler avant l'examen. Commencez par les domaines ci-dessous.",
    )
  })
})
