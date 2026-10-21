import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { EvaluationResults } from "@/app/(evaluation)/evaluation/quiz/_components/evaluation-results"
import type { QuizQuestion } from "@/components/quiz/runner/types"

// La coquille (en-tête connecté, thème) et la correction ont leurs propres
// tests : ici, seul ce que le bilan leur transmet compte.
const received = vi.hoisted(() => ({}) as Record<string, unknown>)

vi.mock("@/components/shared/marketing-shell", () => ({
  MarketingShell: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}))
vi.mock("@/components/quiz/results/session-results", () => ({
  SessionResults: (props: unknown) => {
    received.results = props
    return null
  },
}))

const question = (id: string, domain: string): QuizQuestion => ({
  _id: id,
  question: `Question ${id}`,
  options: ["A", "B", "C", "D"],
  domain,
  objectifCMC: "Obj",
  images: [],
  correctAnswer: "A",
})

const questions = [
  question("q1", "Cardiologie"),
  question("q2", "Pédiatrie"),
  question("q3", "Psychiatrie"),
]

const renderResults = (userAnswers: (string | null)[], onRestart = vi.fn()) =>
  render(
    <EvaluationResults
      questions={questions}
      userAnswers={userAnswers}
      elapsedSeconds={125}
      totalSeconds={600}
      onRestart={onRestart}
    />,
  )

const detail = (label: string) =>
  screen.getByText(label).nextElementSibling?.textContent

describe("EvaluationResults", () => {
  it("score, détails et domaines à travailler", () => {
    renderResults(["A", "B", null])

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Vous avez obtenu 1 / 3.",
      }),
    ).toBeInTheDocument()
    expect(screen.getByTestId("score-percentage")).toHaveTextContent("33 %")
    expect(detail("Bonnes réponses")).toBe("1 / 3")
    expect(detail("Temps utilisé")).toBe("2:05 / 10:00")
    expect(detail("Sans réponse")).toBe("1")

    const weak = screen
      .getByRole("heading", { name: "Domaines à travailler" })
      .closest("section")
    expect(weak).toHaveTextContent("Pédiatrie")
    expect(weak).toHaveTextContent("Psychiatrie")
    expect(weak).not.toHaveTextContent("Cardiologie")

    expect(received.results).toEqual({
      kind: "exam",
      score: 33,
      questions,
      answers: {
        q1: { selected: "A", isCorrect: true },
        q2: { selected: "B", isCorrect: false },
      },
      summary: false,
    })
  })

  it("sans faute : pas de section « Domaines à travailler »", () => {
    renderResults(["A", "A", "A"])
    expect(
      screen.queryByRole("heading", { name: "Domaines à travailler" }),
    ).toBeNull()
  })

  it("« Recommencer » relance l'évaluation, l'inscription reste un lien", async () => {
    const onRestart = vi.fn()
    renderResults(["A", "A", "A"], onRestart)
    await userEvent.click(screen.getByRole("button", { name: "Recommencer" }))
    expect(onRestart).toHaveBeenCalledOnce()
    expect(
      screen.getByRole("link", { name: "S'inscrire pour continuer" }),
    ).toHaveAttribute("href", "/inscription")
  })
})
