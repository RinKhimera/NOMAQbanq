import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SessionNavigation } from "@/components/quiz/session/session-navigation"

describe("SessionNavigation", () => {
  const defaultProps = {
    currentIndex: 2,
    totalQuestions: 10,
    isFlagged: false,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onToggleFlag: vi.fn(),
  }

  it("désactive le bouton précédent à la première question", () => {
    render(<SessionNavigation {...defaultProps} currentIndex={0} />)

    const btnPrev = screen.getByTestId("btn-previous")
    expect(btnPrev).toBeDisabled()
  })

  it("active le bouton précédent aux questions suivantes", () => {
    render(<SessionNavigation {...defaultProps} currentIndex={3} />)

    const btnPrev = screen.getByTestId("btn-previous")
    expect(btnPrev).not.toBeDisabled()
  })

  it("affiche le bouton Suivant quand ce n'est pas la dernière question", () => {
    render(<SessionNavigation {...defaultProps} currentIndex={5} />)

    expect(screen.getByTestId("btn-next")).toBeInTheDocument()
    expect(screen.queryByTestId("btn-finish")).not.toBeInTheDocument()
  })

  it("affiche le bouton Terminer à la dernière question", () => {
    render(
      <SessionNavigation {...defaultProps} currentIndex={9} totalQuestions={10} />,
    )

    expect(screen.getByTestId("btn-finish")).toBeInTheDocument()
    expect(screen.queryByTestId("btn-next")).not.toBeInTheDocument()
    expect(screen.getByText("Terminer")).toBeInTheDocument()
  })

  it("appelle onToggleFlag au clic sur le bouton drapeau", () => {
    const onToggleFlag = vi.fn()
    render(<SessionNavigation {...defaultProps} onToggleFlag={onToggleFlag} />)

    fireEvent.click(screen.getByTestId("btn-flag"))
    expect(onToggleFlag).toHaveBeenCalledOnce()
  })

  it("affiche Marquée quand la question est marquée", () => {
    render(<SessionNavigation {...defaultProps} isFlagged={true} />)

    const flagBtn = screen.getByTestId("btn-flag")
    expect(flagBtn).toHaveAttribute("data-flagged", "true")
  })

  it("désactive la navigation quand les questions sont verrouillées", () => {
    render(
      <SessionNavigation
        {...defaultProps}
        isPreviousLocked={true}
        isNextLocked={true}
      />,
    )

    expect(screen.getByTestId("btn-previous")).toBeDisabled()
    expect(screen.getByTestId("btn-next")).toBeDisabled()
  })

  it("applique le style bleu avec accentColor blue au bouton Terminer", () => {
    render(
      <SessionNavigation
        {...defaultProps}
        currentIndex={9}
        totalQuestions={10}
        accentColor="blue"
      />,
    )

    const finishBtn = screen.getByTestId("btn-finish")
    expect(finishBtn.className).toContain("from-blue-600")
  })

  it("applique le style emerald par défaut au bouton Terminer", () => {
    render(
      <SessionNavigation
        {...defaultProps}
        currentIndex={9}
        totalQuestions={10}
      />,
    )

    const finishBtn = screen.getByTestId("btn-finish")
    expect(finishBtn.className).toContain("from-emerald-600")
  })

  it("appelle onPrevious au clic sur le bouton précédent", () => {
    const onPrevious = vi.fn()
    render(
      <SessionNavigation {...defaultProps} currentIndex={3} onPrevious={onPrevious} />,
    )

    fireEvent.click(screen.getByTestId("btn-previous"))
    expect(onPrevious).toHaveBeenCalledOnce()
  })

  it("appelle onNext au clic sur le bouton suivant", () => {
    const onNext = vi.fn()
    render(<SessionNavigation {...defaultProps} onNext={onNext} />)

    fireEvent.click(screen.getByTestId("btn-next"))
    expect(onNext).toHaveBeenCalledOnce()
  })
})
