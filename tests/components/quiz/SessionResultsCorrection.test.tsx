import { render, screen, within } from "@testing-library/react"
import { type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { SessionResults } from "@/components/quiz/results/session-results"
import type { AnswersMap, QuizQuestion } from "@/components/quiz/runner/types"

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}))

// Page de résultats rendue avec la vraie carte : le libellé de chaque carte doit
// suivre le verdict enregistré, comme le score et les compteurs de la page.

const makeQuestion = (
  id: string,
  overrides: Partial<QuizQuestion> = {},
): QuizQuestion => ({
  _id: id,
  question: `Question ${id}`,
  options: ["Aspirine", "Héparine", "Warfarine", "Clopidogrel"],
  domain: "Cardiologie",
  objectifCMC: "Obj",
  images: [],
  correctAnswer: "Aspirine",
  explanation: `Explication ${id}`,
  ...overrides,
})

const renderResults = (questions: QuizQuestion[], answers: AnswersMap) =>
  render(
    <SessionResults
      kind="exam"
      score={50}
      questions={questions}
      answers={answers}
    />,
  )

const card = (n: number) => {
  const el = document.getElementById(`question-${n}`)
  if (!el) throw new Error(`carte ${n} absente`)
  return el
}

const option = (n: number, text: string) =>
  within(card(n)).getByText(text).closest("[data-testid^='answer-option-']")

describe("correction affichée à l'étudiant", () => {
  it("clé corrigée, verdict enregistré juste : « Correct », mention, clé actuelle surlignée", () => {
    renderResults([makeQuestion("q1", { correctAnswer: "Héparine" })], {
      q1: { selected: "Aspirine", isCorrect: true },
    })
    expect(within(card(1)).getByText("Correct")).toBeInTheDocument()
    expect(
      within(card(1)).getByTestId("key-corrected-notice"),
    ).toHaveTextContent(
      "La clé de cette question a été corrigée depuis votre réponse",
    )
    expect(option(1, "Héparine")).toHaveAttribute("data-state", "correct")
    expect(screen.getByTestId("stat-correct").textContent).toBe("1")
  })

  it("clé corrigée vers la réponse, verdict enregistré faux : « Incorrect » et mention", () => {
    renderResults([makeQuestion("q1")], {
      q1: { selected: "Aspirine", isCorrect: false },
    })
    expect(within(card(1)).getByText("Incorrect")).toBeInTheDocument()
    expect(
      within(card(1)).getByTestId("key-corrected-notice"),
    ).toBeInTheDocument()
    expect(screen.getByTestId("stat-incorrect").textContent).toBe("1")
  })

  it("jumeau : clé inchangée, aucune mention", () => {
    renderResults([makeQuestion("q1")], {
      q1: { selected: "Héparine", isCorrect: false },
    })
    expect(within(card(1)).getByText("Incorrect")).toBeInTheDocument()
    expect(
      within(card(1)).queryByTestId("key-corrected-notice"),
    ).not.toBeInTheDocument()
  })

  it("formulation antérieure : l'ancien texte sous « Votre réponse », le verdict enregistré, sans mention", () => {
    renderResults(
      [
        makeQuestion("q1", {
          options: ["Aspirine 100 mg", "Héparine", "Warfarine", "Clopidogrel"],
          correctAnswer: "Aspirine 100 mg",
        }),
      ],
      { q1: { selected: "Aspirine", isCorrect: true } },
    )
    expect(within(card(1)).getByText("Correct")).toBeInTheDocument()
    expect(
      within(card(1)).queryByTestId("key-corrected-notice"),
    ).not.toBeInTheDocument()
    const former = within(card(1)).getByTestId("former-wording-answer")
    expect(former).toHaveTextContent("Votre réponse")
    expect(former).toHaveTextContent("Aspirine")
    expect(option(1, "Aspirine 100 mg")).toHaveAttribute(
      "data-state",
      "correct",
    )
  })

  it("correction différée inchangée : ni verdict, ni mention", () => {
    renderResults(
      [makeQuestion("q1", { correctAnswer: undefined, keyWithheld: true })],
      { q1: { selected: "Héparine" } },
    )
    expect(within(card(1)).getByText("Correction différée")).toBeInTheDocument()
    expect(
      within(card(1)).queryByTestId("key-corrected-notice"),
    ).not.toBeInTheDocument()
  })

  it("formulation antérieure sous clé retenue : ancien texte en gris, ni juste ni faux", () => {
    renderResults(
      [
        makeQuestion("q1", {
          options: ["Aspirine 100 mg", "Héparine", "Warfarine", "Clopidogrel"],
          correctAnswer: undefined,
          keyWithheld: true,
        }),
      ],
      { q1: { selected: "Aspirine" } },
    )
    const former = within(card(1)).getByTestId("former-wording-answer")
    expect(former).toHaveTextContent("Aspirine")
    expect(former).toHaveAttribute("data-state", "withheld")
  })
})
