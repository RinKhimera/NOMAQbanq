import { act, fireEvent, render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PauseDialog } from "@/components/quiz/pause-dialog"

describe("PauseDialog", () => {
  const defaultProps = {
    isOpen: true,
    onResume: vi.fn(),
    pauseStartedAt: Date.now(),
    pauseDurationMinutes: 10,
  }

  it("est un dialogue modal nommé « Examen en pause »", () => {
    render(<PauseDialog {...defaultProps} />)

    expect(
      screen.getByRole("dialog", { name: "Examen en pause" }),
    ).toHaveAttribute("aria-modal", "true")
  })

  it("ne rend rien quand isOpen est faux", () => {
    render(<PauseDialog {...defaultProps} isOpen={false} />)

    expect(screen.queryByTestId("pause-overlay")).not.toBeInTheDocument()
  })

  it("rappelle le chrono figé de l'examen et la pause unique", () => {
    render(<PauseDialog {...defaultProps} examTimeLabel="02:14:07" />)

    expect(screen.getByText("02:14:07")).toBeInTheDocument()
    expect(
      screen.getByText(/C.est votre seule pause pour cet examen/),
    ).toBeInTheDocument()
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
    expect(resumeBtn).toHaveTextContent("Reprise en cours…")
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
