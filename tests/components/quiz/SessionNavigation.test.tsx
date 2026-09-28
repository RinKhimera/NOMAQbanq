import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SessionNavigation } from "@/components/quiz/session/session-navigation"

const renderAt = (currentIndex: number, children?: React.ReactNode) => {
  const handlers = {
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onFinish: vi.fn(),
  }
  render(
    <SessionNavigation
      currentIndex={currentIndex}
      totalQuestions={3}
      finishLabel="Terminer la série"
      {...handlers}
    >
      {children}
    </SessionNavigation>,
  )
  return handlers
}

describe("SessionNavigation", () => {
  it("première question : « Précédente » désactivée, « Suivante » avance", () => {
    const { onNext } = renderAt(0)

    expect(screen.getByTestId("btn-previous")).toBeDisabled()
    fireEvent.click(screen.getByTestId("btn-next"))
    expect(onNext).toHaveBeenCalledOnce()
    expect(screen.queryByTestId("btn-finish")).not.toBeInTheDocument()
  })

  it("« Précédente » recule", () => {
    const { onPrevious } = renderAt(1)

    fireEvent.click(screen.getByRole("button", { name: /Précédente/ }))
    expect(onPrevious).toHaveBeenCalledOnce()
  })

  it("dernière question : l'action primaire devient la fin de la série", () => {
    const { onFinish } = renderAt(2)

    expect(screen.queryByTestId("btn-next")).not.toBeInTheDocument()
    const finish = screen.getByTestId("btn-finish")
    expect(finish).toHaveTextContent("Terminer la série")
    fireEvent.click(finish)
    expect(onFinish).toHaveBeenCalledOnce()
  })

  it("intercale l'action fournie avant l'action primaire", () => {
    renderAt(0, <button type="button">Valider ma réponse</button>)

    const buttons = screen.getAllByRole("button").map((b) => b.textContent)
    expect(buttons).toEqual(["Précédente", "Valider ma réponse", "Suivante"])
  })
})
