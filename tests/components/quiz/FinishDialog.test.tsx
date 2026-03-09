import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FinishDialog } from "@/components/quiz/session/finish-dialog"

// Mock exam-timer to control formatted output
vi.mock("@/lib/exam-timer", () => ({
  formatExamTime: (ms: number) => {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  },
}))

describe("FinishDialog", () => {
  const defaultProps = {
    isOpen: true,
    onOpenChange: vi.fn(),
    answeredCount: 8,
    totalQuestions: 10,
    flaggedCount: 0,
    isSubmitting: false,
    onConfirm: vi.fn(),
    mode: "training" as const,
  }

  it("affiche le titre correct en mode entraînement", () => {
    render(<FinishDialog {...defaultProps} />)

    expect(screen.getByText("Terminer la session ?")).toBeInTheDocument()
  })

  it("affiche le titre correct en mode examen", () => {
    render(<FinishDialog {...defaultProps} mode="exam" />)

    expect(screen.getByText("Soumettre l'examen ?")).toBeInTheDocument()
  })

  it("affiche le compteur de questions répondues", () => {
    render(
      <FinishDialog {...defaultProps} answeredCount={8} totalQuestions={10} />,
    )

    expect(screen.getByText("8/10")).toBeInTheDocument()
    expect(screen.getByText("Répondues")).toBeInTheDocument()
  })

  it("affiche l'avertissement de questions non répondues", () => {
    render(
      <FinishDialog {...defaultProps} answeredCount={7} totalQuestions={10} />,
    )

    expect(screen.getByText(/3 questions/)).toBeInTheDocument()
    expect(screen.getByText(/non répondues/)).toBeInTheDocument()
  })

  it("affiche les questions marquées quand il y en a", () => {
    render(<FinishDialog {...defaultProps} flaggedCount={3} />)

    expect(screen.getByText("Marquées")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText(/marquées/)).toBeInTheDocument()
  })

  it("n'affiche pas les questions marquées quand il n'y en a pas", () => {
    render(<FinishDialog {...defaultProps} flaggedCount={0} />)

    expect(screen.queryByText("Marquées")).not.toBeInTheDocument()
  })

  it("affiche le temps restant en mode examen", () => {
    render(
      <FinishDialog
        {...defaultProps}
        mode="exam"
        timeRemaining={30 * 60 * 1000} // 30 min
      />,
    )

    expect(screen.getByText("Temps restant")).toBeInTheDocument()
    expect(screen.getByText("00:30:00")).toBeInTheDocument()
  })

  it("applique le style rouge quand le temps est critique (<5min)", () => {
    render(
      <FinishDialog
        {...defaultProps}
        mode="exam"
        timeRemaining={3 * 60 * 1000} // 3 min
      />,
    )

    const timeSpan = screen.getByText("00:03:00")
    expect(timeSpan.className).toContain("text-red-600")
  })

  it("applique le style ambre quand le temps diminue (<10min)", () => {
    render(
      <FinishDialog
        {...defaultProps}
        mode="exam"
        timeRemaining={7 * 60 * 1000} // 7 min
      />,
    )

    const timeSpan = screen.getByText("00:07:00")
    expect(timeSpan.className).toContain("text-amber-600")
  })

  it("désactive les boutons quand isSubmitting est vrai", () => {
    render(<FinishDialog {...defaultProps} isSubmitting={true} />)

    // Le bouton annuler devrait être désactivé
    const cancelBtn = screen.getByText("Continuer")
    expect(cancelBtn.closest("button")).toBeDisabled()

    // Le texte de soumission devrait apparaître
    expect(screen.getByText("Calcul du score...")).toBeInTheDocument()
  })

  it("affiche 'Soumission...' en mode examen pendant la soumission", () => {
    render(<FinishDialog {...defaultProps} mode="exam" isSubmitting={true} />)

    expect(screen.getByText("Soumission...")).toBeInTheDocument()
  })

  it("appelle onConfirm au clic sur le bouton de confirmation", () => {
    const onConfirm = vi.fn()
    render(<FinishDialog {...defaultProps} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByText("Terminer"))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it("utilise les textes personnalisés pour les boutons", () => {
    render(
      <FinishDialog
        {...defaultProps}
        confirmText="Soumettre maintenant"
        cancelText="Revenir"
      />,
    )

    expect(screen.getByText("Soumettre maintenant")).toBeInTheDocument()
    expect(screen.getByText("Revenir")).toBeInTheDocument()
  })

  it("ne rend rien quand isOpen est faux", () => {
    const { container } = render(
      <FinishDialog {...defaultProps} isOpen={false} />,
    )

    expect(screen.queryByText("Terminer la session ?")).not.toBeInTheDocument()
    // AlertDialog with open=false should not render content
    expect(
      container.querySelector("[data-slot='alert-dialog-content']"),
    ).toBeNull()
  })

  it("affiche l'avertissement singulier pour 1 question non répondue", () => {
    render(
      <FinishDialog {...defaultProps} answeredCount={9} totalQuestions={10} />,
    )

    expect(screen.getByText(/1 question/)).toBeInTheDocument()
    expect(screen.getByText(/non répondue /)).toBeInTheDocument()
  })
})
