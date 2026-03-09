import { fireEvent, render, screen } from "@testing-library/react"
import type { MouseEventHandler, ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import QuestionNavigation from "@/components/quiz/question-navigation"
import type { Id } from "@/convex/_generated/dataModel"
import { createMockQuestionDoc } from "../../helpers/mocks"

// Mock @radix-ui/react-dropdown-menu to render content directly
vi.mock("@radix-ui/react-dropdown-menu", () => {
  return {
    Root: ({ children }: { children: ReactNode }) => <div data-testid="dropdown-root">{children}</div>,
    Trigger: ({ children, asChild }: { children: ReactNode; asChild?: boolean }) => {
      if (asChild) return children
      return <button>{children}</button>
    },
    Portal: ({ children }: { children: ReactNode }) => <>{children}</>,
    Content: ({ children }: { children: ReactNode }) => (
      <div data-testid="dropdown-content">
        {children}
      </div>
    ),
    Item: ({ children, onClick }: { children: ReactNode; onClick?: MouseEventHandler }) => (
      <div role="menuitem" onClick={onClick}>
        {children}
      </div>
    ),
  }
})

describe("QuestionNavigation", () => {
  const questions = [
    createMockQuestionDoc({
      _id: "q1" as Id<"questions">,
      correctAnswer: "Paris",
    }),
    createMockQuestionDoc({
      _id: "q2" as Id<"questions">,
      correctAnswer: "Lyon",
    }),
    createMockQuestionDoc({
      _id: "q3" as Id<"questions">,
      correctAnswer: "Marseille",
    }),
  ]

  const defaultProps = {
    questions,
    userAnswers: ["Paris", "Bordeaux", null] as (string | null)[],
    onExpandAll: vi.fn(),
    onCollapseAll: vi.fn(),
  }

  it("affiche le bouton de navigation des questions", () => {
    render(<QuestionNavigation {...defaultProps} />)

    const navBtn = screen.getByLabelText("Navigation des questions")
    expect(navBtn).toBeInTheDocument()
  })

  it("affiche les statuts correct, incorrect et non répondu", () => {
    render(<QuestionNavigation {...defaultProps} />)

    // With the mocked dropdown, content renders directly
    expect(screen.getByText("Correct")).toBeInTheDocument()
    expect(screen.getByText("Incorrect")).toBeInTheDocument()
    expect(screen.getByText("Non répondu")).toBeInTheDocument()
  })

  it("affiche les numéros de question", () => {
    render(<QuestionNavigation {...defaultProps} />)

    expect(screen.getByText("Question 1")).toBeInTheDocument()
    expect(screen.getByText("Question 2")).toBeInTheDocument()
    expect(screen.getByText("Question 3")).toBeInTheDocument()
  })

  it("appelle onExpandAll au clic sur Tout ouvrir", () => {
    const onExpandAll = vi.fn()
    render(<QuestionNavigation {...defaultProps} onExpandAll={onExpandAll} />)

    fireEvent.click(screen.getByText("Tout ouvrir"))
    expect(onExpandAll).toHaveBeenCalledOnce()
  })

  it("appelle onCollapseAll au clic sur Tout fermer", () => {
    const onCollapseAll = vi.fn()
    render(
      <QuestionNavigation {...defaultProps} onCollapseAll={onCollapseAll} />,
    )

    fireEvent.click(screen.getByText("Tout fermer"))
    expect(onCollapseAll).toHaveBeenCalledOnce()
  })

  it("affiche le titre Navigation dans le menu", () => {
    render(<QuestionNavigation {...defaultProps} />)

    expect(screen.getByText("Navigation")).toBeInTheDocument()
  })
})
