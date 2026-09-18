import { act, render, screen } from "@testing-library/react"
import { fireEvent } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PauseDialog } from "@/components/quiz/pause-dialog"

vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

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

describe("PauseDialog — décompte", () => {
  afterEach(() => vi.useRealTimers())

  it("ancre le rendu serveur sur initialNow, pas sur Date.now()", () => {
    vi.useFakeTimers()
    const pauseStartedAt = 1_000_000
    // Horloge locale très en avance : sans ancre, le HTML servi dirait 00:00.
    vi.setSystemTime(pauseStartedAt + 60 * 60 * 1000)
    const html = renderToString(
      <PauseDialog
        isOpen
        onResume={vi.fn()}
        pauseStartedAt={pauseStartedAt}
        pauseDurationMinutes={10}
        initialNow={pauseStartedAt + 4 * 60 * 1000}
      />,
    )
    expect(html).toContain("06:00")
  })

  it("reprend automatiquement, une seule fois, quand la page se charge sur une pause échue", () => {
    vi.useFakeTimers()
    const onResume = vi.fn()
    const pauseStartedAt = 1_000_000
    render(
      <PauseDialog
        isOpen
        onResume={onResume}
        pauseStartedAt={pauseStartedAt}
        pauseDurationMinutes={10}
        initialNow={pauseStartedAt + 11 * 60 * 1000}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(onResume).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("pause-timer")).toHaveTextContent("00:00")
  })

  it("horloge système avancée de +3 h après le montage : pas de reprise automatique, le décompte suit les minuteries", () => {
    vi.useFakeTimers()
    const onResume = vi.fn()
    const pauseStartedAt = 1_000_000
    vi.setSystemTime(pauseStartedAt)
    render(
      <PauseDialog
        isOpen
        onResume={onResume}
        pauseStartedAt={pauseStartedAt}
        pauseDurationMinutes={10}
      />,
    )
    act(() => {
      vi.setSystemTime(pauseStartedAt + 3 * 60 * 60 * 1000)
      vi.advanceTimersByTime(60_000)
    })
    expect(onResume).not.toHaveBeenCalled()
    expect(screen.getByTestId("pause-timer")).toHaveTextContent("09:00")
  })

  it("jumeau : les minuteries atteignent le plafond, horloge système intacte → reprise automatique une seule fois", () => {
    vi.useFakeTimers()
    const onResume = vi.fn()
    const pauseStartedAt = 1_000_000
    vi.setSystemTime(pauseStartedAt)
    render(
      <PauseDialog
        isOpen
        onResume={onResume}
        pauseStartedAt={pauseStartedAt}
        pauseDurationMinutes={10}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000 + 3000)
    })
    expect(onResume).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("pause-timer")).toHaveTextContent("00:00")
  })

  it("une nouvelle ancre serveur (resync au réveil) réaligne le décompte et déclenche la reprise si la pause est échue", () => {
    vi.useFakeTimers()
    const onResume = vi.fn()
    const pauseStartedAt = 1_000_000
    const { rerender } = render(
      <PauseDialog
        isOpen
        onResume={onResume}
        pauseStartedAt={pauseStartedAt}
        pauseDurationMinutes={10}
        initialNow={pauseStartedAt}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByTestId("pause-timer")).toHaveTextContent("09:00")
    // Veille de 20 min pendant la pause : le serveur, lui, a vu le temps passer.
    rerender(
      <PauseDialog
        isOpen
        onResume={onResume}
        pauseStartedAt={pauseStartedAt}
        pauseDurationMinutes={10}
        initialNow={pauseStartedAt + 21 * 60 * 1000}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByTestId("pause-timer")).toHaveTextContent("00:00")
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  it("chargée en pause avec une ancre serveur : le décompte part de l'ancre, delta monotone ensuite", () => {
    vi.useFakeTimers()
    const onResume = vi.fn()
    const pauseStartedAt = 1_000_000
    // Horloge locale en retard de 3 h : sans delta monotone, la pause « gagnerait » 3 h.
    vi.setSystemTime(pauseStartedAt - 3 * 60 * 60 * 1000)
    render(
      <PauseDialog
        isOpen
        onResume={onResume}
        pauseStartedAt={pauseStartedAt}
        pauseDurationMinutes={10}
        initialNow={pauseStartedAt + 4 * 60 * 1000}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByTestId("pause-timer")).toHaveTextContent("05:00")
    expect(onResume).not.toHaveBeenCalled()
  })
})
