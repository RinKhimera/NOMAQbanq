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
    totalQuestions: 100,
    midpoint: 50,
  }

  it("affiche le titre Pause obligatoire", () => {
    render(<PauseDialog {...defaultProps} />)

    expect(screen.getByText("Pause obligatoire")).toBeInTheDocument()
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

  it("affiche les informations sur la première moitié complétée", () => {
    render(<PauseDialog {...defaultProps} midpoint={50} totalQuestions={100} />)

    expect(screen.getByText("Première moitié complétée")).toBeInTheDocument()
    expect(screen.getByText(/Questions 1 à 50/)).toBeInTheDocument()
  })

  it("affiche les informations sur la seconde moitié verrouillée", () => {
    render(<PauseDialog {...defaultProps} midpoint={50} totalQuestions={100} />)

    expect(screen.getByText("Seconde moitié verrouillée")).toBeInTheDocument()
    expect(screen.getByText(/Questions 51 à 100/)).toBeInTheDocument()
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
