import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PauseApproachingAlert } from "@/components/quiz/pause-approaching-alert"

// Mock motion/react - import the shared factory
vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

describe("PauseApproachingAlert", () => {
  const defaultProps = {
    questionsRemaining: 5,
    questionsAnswered: 45,
    midpoint: 50,
    totalQuestions: 100,
    canTakeEarlyPause: false,
    onTakeEarlyPause: vi.fn(),
  }

  it("retourne null quand questionsRemaining > 10", () => {
    const { container } = render(
      <PauseApproachingAlert {...defaultProps} questionsRemaining={11} />,
    )

    expect(container.innerHTML).toBe("")
  })

  it("affiche l'alerte quand questionsRemaining <= 10", () => {
    render(<PauseApproachingAlert {...defaultProps} questionsRemaining={8} />)

    expect(
      screen.getByText("☕ Pause obligatoire à venir"),
    ).toBeInTheDocument()
  })

  it("affiche le message de répondre X questions supplémentaires", () => {
    render(<PauseApproachingAlert {...defaultProps} questionsRemaining={5} />)

    expect(
      screen.getByText(
        /Répondez à 5 questions supplémentaires/,
      ),
    ).toBeInTheDocument()
  })

  it("affiche le message singulier pour 1 question restante", () => {
    render(<PauseApproachingAlert {...defaultProps} questionsRemaining={1} />)

    expect(
      screen.getByText(
        /Répondez à 1 dernière question/,
      ),
    ).toBeInTheDocument()
  })

  it("affiche l'état imminent quand questionsRemaining <= 3", () => {
    render(<PauseApproachingAlert {...defaultProps} questionsRemaining={2} />)

    expect(screen.getByText("⚠️ Pause imminente")).toBeInTheDocument()
  })

  it("affiche l'état complété quand questionsRemaining === 0", () => {
    render(
      <PauseApproachingAlert
        {...defaultProps}
        questionsRemaining={0}
        questionsAnswered={50}
      />,
    )

    expect(
      screen.getByText("✅ Première vague complétée !"),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Vous avez répondu aux 50 premières questions/),
    ).toBeInTheDocument()
  })

  it("affiche le bouton de pause anticipée quand canTakeEarlyPause est vrai et tout est répondu", () => {
    const onTakeEarlyPause = vi.fn()
    render(
      <PauseApproachingAlert
        {...defaultProps}
        questionsRemaining={0}
        questionsAnswered={50}
        canTakeEarlyPause={true}
        onTakeEarlyPause={onTakeEarlyPause}
      />,
    )

    const earlyPauseBtn = screen.getByText("Prendre la pause maintenant")
    expect(earlyPauseBtn).toBeInTheDocument()
    fireEvent.click(earlyPauseBtn)
    expect(onTakeEarlyPause).toHaveBeenCalledOnce()
  })

  it("n'affiche pas le bouton de pause anticipée quand canTakeEarlyPause est faux", () => {
    render(
      <PauseApproachingAlert
        {...defaultProps}
        questionsRemaining={0}
        questionsAnswered={50}
        canTakeEarlyPause={false}
      />,
    )

    expect(
      screen.queryByText("Prendre la pause maintenant"),
    ).not.toBeInTheDocument()
  })

  it("affiche les questions verrouillées dans la description", () => {
    render(
      <PauseApproachingAlert
        {...defaultProps}
        questionsRemaining={5}
        midpoint={50}
        totalQuestions={100}
      />,
    )

    expect(
      screen.getByText(/Questions 51 à 100 seront/),
    ).toBeInTheDocument()
  })

  it("affiche le compteur de progression des questions", () => {
    render(
      <PauseApproachingAlert
        {...defaultProps}
        questionsRemaining={5}
        questionsAnswered={45}
        midpoint={50}
      />,
    )

    expect(screen.getByText(/45\/50 questions répondues/)).toBeInTheDocument()
  })
})
