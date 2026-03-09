import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import QuizResults from "@/components/quiz/quiz-results"
import type { Id } from "@/convex/_generated/dataModel"
import { createMockQuestionDoc } from "../../helpers/mocks"

// Mock motion/react - import the shared factory
vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="next-image" />
  ),
}))

// Mock next/navigation
const mockPush = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

describe("QuizResults", () => {
  const questions = [
    createMockQuestionDoc({
      _id: "q1" as Id<"questions">,
      question: "Question 1",
    }),
    createMockQuestionDoc({
      _id: "q2" as Id<"questions">,
      question: "Question 2",
    }),
    createMockQuestionDoc({
      _id: "q3" as Id<"questions">,
      question: "Question 3",
    }),
    createMockQuestionDoc({
      _id: "q4" as Id<"questions">,
      question: "Question 4",
    }),
    createMockQuestionDoc({
      _id: "q5" as Id<"questions">,
      question: "Question 5",
    }),
  ]

  const defaultProps = {
    questions,
    userAnswers: ["Paris", "Lyon", null, "Paris", "Marseille"],
    score: 3,
    timeRemaining: 120,
    onRestart: vi.fn(),
  }

  it("affiche le score avec le format correct", () => {
    render(<QuizResults {...defaultProps} />)

    expect(screen.getByText("3/5")).toBeInTheDocument()
    expect(screen.getByText("60%")).toBeInTheDocument()
  })

  it("affiche la couleur verte pour un score >= 80%", () => {
    render(<QuizResults {...defaultProps} score={4} />)

    const scoreEl = screen.getByText("4/5")
    expect(scoreEl.className).toContain("text-green-600")
  })

  it("affiche la couleur jaune pour un score >= 60% et < 80%", () => {
    render(<QuizResults {...defaultProps} score={3} />)

    const scoreEl = screen.getByText("3/5")
    expect(scoreEl.className).toContain("text-yellow-600")
  })

  it("affiche la couleur rouge pour un score < 60%", () => {
    render(<QuizResults {...defaultProps} score={2} />)

    const scoreEl = screen.getByText("2/5")
    expect(scoreEl.className).toContain("text-red-600")
  })

  it("affiche le message excellent pour un score >= 80%", () => {
    render(<QuizResults {...defaultProps} score={4} />)

    expect(
      screen.getByText(/Excellent ! Vous maîtrisez bien le sujet/),
    ).toBeInTheDocument()
  })

  it("affiche le message bien pour un score >= 60%", () => {
    render(<QuizResults {...defaultProps} score={3} />)

    expect(
      screen.getByText(/Bien ! Continuez à vous entraîner/),
    ).toBeInTheDocument()
  })

  it("affiche le message d'amélioration pour un score < 60%", () => {
    render(<QuizResults {...defaultProps} score={2} />)

    expect(
      screen.getByText(/Vous devez approfondir vos connaissances/),
    ).toBeInTheDocument()
  })

  it("affiche le temps restant formaté", () => {
    render(<QuizResults {...defaultProps} timeRemaining={125} />)

    expect(screen.getByText("2:05")).toBeInTheDocument()
  })

  it("développe toutes les questions au clic sur Tout développer", () => {
    render(<QuizResults {...defaultProps} />)

    const expandBtn = screen.getByText("Tout développer")
    fireEvent.click(expandBtn)

    // After expanding all, explanations should be visible
    const explanations = screen.getAllByText(/Paris est la capitale/)
    expect(explanations.length).toBeGreaterThan(0)
  })

  it("réduit toutes les questions au clic sur Tout réduire", () => {
    render(<QuizResults {...defaultProps} />)

    // First expand all
    fireEvent.click(screen.getByText("Tout développer"))
    // Then collapse all
    fireEvent.click(screen.getByText("Tout réduire"))

    // Title should still be visible
    expect(screen.getByText("Quiz Terminé !")).toBeInTheDocument()
  })

  it("appelle onRestart au clic sur Recommencer", () => {
    const onRestart = vi.fn()
    render(<QuizResults {...defaultProps} onRestart={onRestart} />)

    fireEvent.click(screen.getByText("Recommencer"))
    expect(onRestart).toHaveBeenCalledOnce()
  })

  it("affiche le titre Quiz Terminé", () => {
    render(<QuizResults {...defaultProps} />)

    expect(screen.getByText("Quiz Terminé !")).toBeInTheDocument()
  })

  it("affiche le lien Retour à l'évaluation", () => {
    render(<QuizResults {...defaultProps} />)

    expect(screen.getByText("Retour à l'évaluation")).toBeInTheDocument()
  })

  it("affiche la section Révision détaillée", () => {
    render(<QuizResults {...defaultProps} />)

    expect(screen.getByText("Révision détaillée")).toBeInTheDocument()
  })
})
