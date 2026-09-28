import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FinishDialog } from "@/components/quiz/session/finish-dialog"

const base = {
  isOpen: true,
  onOpenChange: vi.fn(),
  answeredCount: 7,
  totalQuestions: 10,
  flaggedCount: 2,
  isSubmitting: false,
  onConfirm: vi.fn(),
}

const cell = (label: string) =>
  within(screen.getByRole("alertdialog")).getByText(label).parentElement

describe("FinishDialog", () => {
  it("examen : récapitule répondues, sans réponse et marquées", () => {
    render(<FinishDialog {...base} kind="exam" />)

    expect(screen.getByText("Soumettre l'examen ?")).toBeInTheDocument()
    expect(cell("Répondues")).toHaveTextContent("7")
    expect(cell("Sans réponse")).toHaveTextContent("3")
    expect(cell("Marquées")).toHaveTextContent("2")
    expect(
      screen.getByRole("button", { name: "Revenir à l'examen" }),
    ).toBeInTheDocument()
  })

  it("série : parle de série, jamais de session", () => {
    render(<FinishDialog {...base} kind="training" />)

    expect(screen.getByText("Terminer la série ?")).toBeInTheDocument()
    expect(screen.queryByText(/session/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Voir les résultats" }),
    ).toBeInTheDocument()
  })

  it("confirmer soumet sans fermer : la page redirige, un échec laisse réessayer", () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <FinishDialog
        {...base}
        kind="exam"
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Soumettre" }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it("pendant la soumission, les deux actions sont verrouillées", () => {
    render(<FinishDialog {...base} kind="exam" isSubmitting />)

    expect(screen.getByRole("button", { name: /Soumission/ })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Revenir à l'examen" }),
    ).toBeDisabled()
  })

  it("fermé : rien n'est rendu", () => {
    render(<FinishDialog {...base} kind="exam" isOpen={false} />)

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })
})
