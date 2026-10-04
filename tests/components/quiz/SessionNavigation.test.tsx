import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SessionNavigation } from "@/components/quiz/session/session-navigation"

type Extra = { onValidate?: () => void; isValidating?: boolean }

const renderAt = (currentIndex: number, extra: Extra = {}) => {
  const handlers = {
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onFinish: vi.fn(),
  }
  const view = render(
    <SessionNavigation
      currentIndex={currentIndex}
      totalQuestions={3}
      finishLabel="Terminer la série"
      {...handlers}
      {...extra}
    />,
  )
  return { ...handlers, ...view }
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

  it("choix en attente (tuteur) : le même bouton valide, puis redevient « Suivante »", () => {
    const onValidate = vi.fn()
    const { onNext, rerender } = renderAt(0, { onValidate })

    const primary = screen.getByTestId("btn-validate-answer")
    expect(primary).toHaveTextContent("Valider ma réponse")
    expect(screen.queryByTestId("btn-next")).not.toBeInTheDocument()
    fireEvent.click(primary)
    expect(onValidate).toHaveBeenCalledOnce()
    expect(onNext).not.toHaveBeenCalled()

    rerender(
      <SessionNavigation
        currentIndex={0}
        totalQuestions={3}
        finishLabel="Terminer la série"
        onPrevious={vi.fn()}
        onNext={onNext}
        onFinish={vi.fn()}
      />,
    )
    // Même nœud DOM : le focus clavier le suit.
    expect(screen.getByTestId("btn-next")).toBe(primary)
  })

  it("pendant la validation, l'action primaire est verrouillée", () => {
    renderAt(0, { onValidate: vi.fn(), isValidating: true })

    expect(screen.getByTestId("btn-validate-answer")).toBeDisabled()
  })
})
