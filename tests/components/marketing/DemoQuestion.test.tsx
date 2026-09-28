import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { DemoQuestion } from "@/components/marketing/demo-question"
import type { QuizQuestion } from "@/components/quiz/runner/types"

const question: QuizQuestion = {
  _id: "demo",
  question: "Énoncé",
  options: ["Alpha", "Bêta", "Gamma"],
  domain: "Cardiologie",
  objectifCMC: "Objectif",
  images: [],
  correctAnswer: "Gamma",
}

describe("DemoQuestion", () => {
  it("tuteur : le choix corrigé n'est plus un bouton, le focus passe au statut", async () => {
    const user = userEvent.setup()
    render(<DemoQuestion question={question} mode="tutor" />)

    await user.click(screen.getByTestId("answer-option-0"))

    const status = screen.getByText("Mode tuteur · correction immédiate")
    await waitFor(() => expect(status).toHaveFocus())
  })

  it("« Recommencer » rend le focus au choix A, redevenu cliquable", async () => {
    const user = userEvent.setup()
    render(<DemoQuestion question={question} mode="sample" />)

    await user.click(screen.getByTestId("answer-option-1"))
    await user.click(screen.getByRole("button", { name: "Recommencer" }))

    const first = screen.getByTestId("answer-option-0")
    expect(first.tagName).toBe("BUTTON")
    await waitFor(() => expect(first).toHaveFocus())
  })

  it("examen : le choix reste un bouton et garde le focus", async () => {
    const user = userEvent.setup()
    render(<DemoQuestion question={question} mode="exam" />)

    await user.click(screen.getByTestId("answer-option-0"))

    expect(screen.getByTestId("answer-option-0")).toHaveFocus()
  })
})
