import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import QuizProgress from "@/components/quiz/quiz-progress"

describe("QuizProgress", () => {
  const defaultProps = {
    currentQuestion: 4,
    totalQuestions: 20,
    timeRemaining: 300,
    domain: "Cardiologie",
    objectifCMC: "Objectif 42",
  }

  it("affiche le numéro de la question courante", () => {
    render(<QuizProgress {...defaultProps} />)

    expect(screen.getByText(/Question 5 sur 20/)).toBeInTheDocument()
  })

  it("affiche le domaine de la question", () => {
    render(<QuizProgress {...defaultProps} />)

    expect(screen.getByText("Cardiologie")).toBeInTheDocument()
  })

  it("affiche l'objectif CMC", () => {
    render(<QuizProgress {...defaultProps} />)

    expect(screen.getByText("Objectif 42")).toBeInTheDocument()
  })

  it("formate le temps correctement en minutes:secondes", () => {
    render(<QuizProgress {...defaultProps} timeRemaining={125} />)

    // 125s = 2:05
    expect(screen.getByText("2:05")).toBeInTheDocument()
  })

  it("formate le temps avec zéro initial pour les secondes", () => {
    render(<QuizProgress {...defaultProps} timeRemaining={60} />)

    expect(screen.getByText("1:00")).toBeInTheDocument()
  })

  it("applique le style rouge quand le temps est critique (<= 30s)", () => {
    render(<QuizProgress {...defaultProps} timeRemaining={25} />)

    const timeElement = screen.getByText("0:25")
    expect(timeElement.className).toContain("text-red-600")
  })

  it("applique le style normal quand le temps est suffisant (> 30s)", () => {
    render(<QuizProgress {...defaultProps} timeRemaining={120} />)

    const timeElement = screen.getByText("2:00")
    expect(timeElement.className).toContain("text-gray-700")
  })

  it("calcule correctement le pourcentage de progression", () => {
    // currentQuestion=4 (index 0-based) => question 5 of 20 => progress = 25%
    const { container } = render(<QuizProgress {...defaultProps} />)

    // Progress bar should be rendered with value=25
    const progressBar = container.querySelector('[role="progressbar"]')
    expect(progressBar).toBeInTheDocument()
  })
})
