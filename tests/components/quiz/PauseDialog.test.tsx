import { render, screen } from "@testing-library/react"
import { fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PauseDialog } from "@/components/quiz/pause-dialog"

// Mock motion/react - import the shared factory
vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

// Mock exam-timer
vi.mock("@/lib/exam-timer", () => ({
  calculatePauseTimeRemaining: vi.fn(() => 5 * 60 * 1000), // 5 min default
  formatPauseTime: (ms: number) => {
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  },
  isPauseExpired: vi.fn(() => false),
}))

describe("PauseDialog", () => {
  const defaultProps = {
    isOpen: true,
    onResume: vi.fn(),
    pauseStartedAt: Date.now(),
    pauseDurationMinutes: 10,
  }

  it("affiche le titre Pause de repos", () => {
    render(<PauseDialog {...defaultProps} />)

    expect(screen.getByText("Pause de repos")).toBeInTheDocument()
  })

  it("ne rend rien quand isOpen est faux", () => {
    render(<PauseDialog {...defaultProps} isOpen={false} />)

    expect(screen.queryByTestId("pause-overlay")).not.toBeInTheDocument()
  })

  it("rend un overlay plein écran bloquant (fixed inset-0)", () => {
    render(<PauseDialog {...defaultProps} />)

    const overlay = screen.getByTestId("pause-overlay")
    expect(overlay).toBeInTheDocument()
    expect(overlay).toHaveClass("fixed", "inset-0", "bg-background")
    expect(overlay).toHaveAttribute("aria-modal", "true")
  })

  it("affiche la description de pause", () => {
    render(<PauseDialog {...defaultProps} />)

    expect(
      screen.getByText(/Prenez une pause bien méritée/),
    ).toBeInTheDocument()
  })

  it("affiche le timer de pause", () => {
    render(<PauseDialog {...defaultProps} />)

    expect(screen.getByTestId("pause-timer")).toBeInTheDocument()
  })

  it("affiche la barre de progression de la pause", () => {
    render(<PauseDialog {...defaultProps} />)

    expect(screen.getByText("Progression de la pause")).toBeInTheDocument()
  })

  it("n'affiche plus le modèle abandonné de verrouillage par moitié", () => {
    render(<PauseDialog {...defaultProps} />)

    expect(
      screen.queryByText("Première moitié complétée"),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("Seconde moitié verrouillée"),
    ).not.toBeInTheDocument()
  })

  it("affiche le bouton Reprendre l'examen", () => {
    render(<PauseDialog {...defaultProps} />)

    const resumeBtn = screen.getByTestId("btn-resume-exam")
    expect(resumeBtn).toBeInTheDocument()
  })

  it("appelle onResume au clic sur le bouton reprendre", () => {
    const onResume = vi.fn()
    render(<PauseDialog {...defaultProps} onResume={onResume} />)

    fireEvent.click(screen.getByTestId("btn-resume-exam"))
    expect(onResume).toHaveBeenCalledOnce()
  })

  it("désactive le bouton et affiche le chargement quand isResuming est vrai", () => {
    render(<PauseDialog {...defaultProps} isResuming={true} />)

    const resumeBtn = screen.getByTestId("btn-resume-exam")
    expect(resumeBtn).toBeDisabled()
    expect(screen.getByText("Reprise en cours...")).toBeInTheDocument()
  })

  it("affiche les conseils pendant la pause", () => {
    render(<PauseDialog {...defaultProps} />)

    expect(screen.getByText(/Conseils pendant la pause/)).toBeInTheDocument()
    expect(screen.getByText(/Étirez-vous/)).toBeInTheDocument()
    expect(screen.getByText(/Buvez de l'eau/)).toBeInTheDocument()
  })
})
