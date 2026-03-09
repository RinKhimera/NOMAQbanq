import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ResultsQuestionNavigator } from "@/components/quiz/results/results-question-navigator"
import type { QuestionResultItem } from "@/components/quiz/results/types"

// Mock motion/react - import the shared factory
vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

describe("ResultsQuestionNavigator", () => {
  const results: QuestionResultItem[] = [
    { isCorrect: true, isAnswered: true },
    { isCorrect: false, isAnswered: true },
    { isCorrect: true, isAnswered: true },
    { isCorrect: false, isAnswered: false },
    { isCorrect: false, isAnswered: true },
  ]

  const onNavigate = vi.fn()

  const defaultProps = {
    questionResults: results,
    onNavigateToQuestion: onNavigate,
    variant: "desktop" as const,
  }

  beforeEach(() => {
    onNavigate.mockClear()
  })

  it("affiche le navigateur desktop avec le compteur de correctes", () => {
    render(<ResultsQuestionNavigator {...defaultProps} />)

    expect(screen.getByText("Navigation")).toBeInTheDocument()
    expect(screen.getByText(/correctes/)).toBeInTheDocument()
  })

  it("affiche les numéros de question dans la grille", () => {
    render(<ResultsQuestionNavigator {...defaultProps} />)

    // All 5 question numbers should be in the grid as buttons
    const gridButtons = screen.getAllByRole("button")
    const numberButtons = gridButtons.filter(
      (btn) => btn.textContent && /^\d+$/.test(btn.textContent.trim()),
    )
    expect(numberButtons).toHaveLength(5)
  })

  it("appelle onNavigateToQuestion au clic sur un numéro", () => {
    render(<ResultsQuestionNavigator {...defaultProps} />)

    // Click question 3 (index 2)
    fireEvent.click(screen.getByText("3"))
    expect(onNavigate).toHaveBeenCalledWith(2)
  })

  it("affiche la légende avec les statistiques correct/incorrect/vide", () => {
    render(<ResultsQuestionNavigator {...defaultProps} />)

    expect(screen.getByText("Légende")).toBeInTheDocument()
    expect(screen.getByText(/Correct \(2\)/)).toBeInTheDocument()
    expect(screen.getByText(/Incorrect \(2\)/)).toBeInTheDocument()
    expect(screen.getByText(/Vide \(1\)/)).toBeInTheDocument()
  })

  it("n'affiche pas la légende Vide quand il n'y a pas de questions sans réponse", () => {
    const allAnswered: QuestionResultItem[] = [
      { isCorrect: true, isAnswered: true },
      { isCorrect: false, isAnswered: true },
    ]
    render(
      <ResultsQuestionNavigator
        {...defaultProps}
        questionResults={allAnswered}
      />,
    )

    expect(screen.queryByText(/Vide/)).not.toBeInTheDocument()
  })

  it("affiche l'astuce quand showTips est vrai", () => {
    render(<ResultsQuestionNavigator {...defaultProps} showTips={true} />)

    expect(
      screen.getByText(/Cliquez sur un numéro/),
    ).toBeInTheDocument()
  })

  it("n'affiche pas l'astuce quand showTips est faux", () => {
    render(<ResultsQuestionNavigator {...defaultProps} showTips={false} />)

    expect(
      screen.queryByText(/Cliquez sur un numéro/),
    ).not.toBeInTheDocument()
  })

  it("rend la variante mobile avec le bouton FAB", () => {
    render(
      <ResultsQuestionNavigator {...defaultProps} variant="mobile" />,
    )

    const fabBtn = screen.getByLabelText("Navigation des questions")
    expect(fabBtn).toBeInTheDocument()
  })

  it("ouvre le panneau mobile au clic sur le FAB", () => {
    render(
      <ResultsQuestionNavigator {...defaultProps} variant="mobile" />,
    )

    fireEvent.click(screen.getByLabelText("Navigation des questions"))

    expect(screen.getByText("Navigation")).toBeInTheDocument()
    expect(screen.getByLabelText("Fermer la navigation")).toBeInTheDocument()
  })

  it("ferme le panneau mobile et navigue au clic sur un numéro", () => {
    render(
      <ResultsQuestionNavigator {...defaultProps} variant="mobile" />,
    )

    // Open panel
    fireEvent.click(screen.getByLabelText("Navigation des questions"))
    // Click question number 3 (unique number)
    fireEvent.click(screen.getByText("3"))
    expect(onNavigate).toHaveBeenCalledWith(2)
  })

  it("applique l'accent color emerald correctement", () => {
    render(
      <ResultsQuestionNavigator
        {...defaultProps}
        accentColor="emerald"
      />,
    )

    expect(screen.getByText("Navigation")).toBeInTheDocument()
  })
})
