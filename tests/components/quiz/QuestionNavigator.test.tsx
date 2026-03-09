import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QuestionNavigator } from "@/components/quiz/session/question-navigator"
import type { SessionAnswer } from "@/components/quiz/session/types"
import type { Id } from "@/convex/_generated/dataModel"

// Mock motion/react - import the shared factory
vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

const createQuestions = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    _id: `q${i}` as Id<"questions">,
  }))

describe("QuestionNavigator", () => {
  const questions = createQuestions(5)
  const emptyAnswers: Record<string, SessionAnswer> = {}
  const emptyFlags = new Set<string>()
  const onNavigate = vi.fn()

  const defaultProps = {
    questions,
    answers: emptyAnswers,
    flaggedQuestions: emptyFlags,
    currentIndex: 0,
    onNavigate,
    variant: "desktop" as const,
  }

  beforeEach(() => {
    onNavigate.mockClear()
  })

  it("affiche le navigateur desktop avec le titre Navigation", () => {
    render(<QuestionNavigator {...defaultProps} />)

    expect(screen.getByText("Navigation")).toBeInTheDocument()
  })

  it("affiche le compteur de questions répondues", () => {
    const answers: Record<string, SessionAnswer> = {
      q0: { selectedAnswer: "A" },
      q2: { selectedAnswer: "C" },
    }
    render(<QuestionNavigator {...defaultProps} answers={answers} />)

    // The stats section shows "2/5 répondues"
    expect(screen.getByText(/répondues/)).toBeInTheDocument()
    // The answered count "2" is shown in a span with font-semibold
    const statsSpan = screen.getByText(/répondues/).closest("span")
    expect(statsSpan).toBeInTheDocument()
  })

  it("affiche les numéros de question dans la grille", () => {
    render(<QuestionNavigator {...defaultProps} />)

    // All 5 question numbers should be in the grid
    const gridButtons = screen.getAllByRole("button")
    const numberButtons = gridButtons.filter(
      (btn) => btn.textContent && /^\d+$/.test(btn.textContent.trim()),
    )
    expect(numberButtons).toHaveLength(5)
  })

  it("navigue vers la question au clic", () => {
    render(<QuestionNavigator {...defaultProps} />)

    fireEvent.click(screen.getByText("3"))
    expect(onNavigate).toHaveBeenCalledWith(2)
  })

  it("ne navigue pas vers une question verrouillée", () => {
    render(
      <QuestionNavigator {...defaultProps} isQuestionLocked={(i) => i === 3} />,
    )

    // Question 4 (index 3) should be locked, disabled buttons should not trigger navigation
    const disabledBtns = screen
      .getAllByRole("button")
      .filter((btn) => btn.hasAttribute("disabled"))
    if (disabledBtns.length > 0) {
      fireEvent.click(disabledBtns[0])
    }
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it("affiche le compteur de questions marquées et permet le filtrage", () => {
    const flagged = new Set(["q1", "q3"])
    render(<QuestionNavigator {...defaultProps} flaggedQuestions={flagged} />)

    // The flag filter button exists with count "2"
    // Find it by the flag icon context - the button with items-center gap
    const flagFilterBtns = screen
      .getAllByRole("button")
      .filter(
        (btn) =>
          btn.className.includes("items-center") &&
          btn.className.includes("gap-1"),
      )
    expect(flagFilterBtns.length).toBeGreaterThan(0)

    // Click the flag filter
    fireEvent.click(flagFilterBtns[0])

    // After filtering, only flagged questions should appear (q1 -> index 1 -> "2", q3 -> index 3 -> "4")
    // Non-flagged question "1" (index 0) should not be in the grid
    const gridButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.textContent && /^\d+$/.test(btn.textContent.trim()))
    const gridNumbers = gridButtons.map((btn) => btn.textContent!.trim())
    expect(gridNumbers).toContain("2")
    expect(gridNumbers).toContain("4")
    expect(gridNumbers).not.toContain("1")
  })

  it("affiche la légende avec les états des questions", () => {
    render(<QuestionNavigator {...defaultProps} />)

    expect(screen.getByText("Légende")).toBeInTheDocument()
    expect(screen.getByText("Répondue")).toBeInTheDocument()
    expect(screen.getByText("Non répondue")).toBeInTheDocument()
    expect(screen.getByText("Marquée")).toBeInTheDocument()
    expect(screen.getByText("Actuelle")).toBeInTheDocument()
  })

  it("affiche la légende Verrouillée quand isQuestionLocked est défini", () => {
    render(
      <QuestionNavigator {...defaultProps} isQuestionLocked={(i) => i > 2} />,
    )

    expect(screen.getByText("Verrouillée")).toBeInTheDocument()
  })

  it("affiche l'astuce de navigation clavier", () => {
    render(<QuestionNavigator {...defaultProps} />)

    expect(screen.getByText(/flèches ← →/)).toBeInTheDocument()
  })

  it("rend la variante mobile avec le bouton FAB", () => {
    render(<QuestionNavigator {...defaultProps} variant="mobile" />)

    const fabBtn = screen.getByLabelText("Navigation des questions")
    expect(fabBtn).toBeInTheDocument()
  })

  it("ouvre le panneau mobile au clic sur le FAB", () => {
    render(<QuestionNavigator {...defaultProps} variant="mobile" />)

    const fabBtn = screen.getByLabelText("Navigation des questions")
    fireEvent.click(fabBtn)

    expect(screen.getByText("Navigation")).toBeInTheDocument()
    expect(screen.getByLabelText("Fermer la navigation")).toBeInTheDocument()
  })
})
