import { act, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TimerDemo } from "@/app/(marketing)/evaluation/_components/timer-demo"

const reducedMotion = (matches: boolean) =>
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches } as MediaQueryList)

const advance = (seconds: number) =>
  act(() => vi.advanceTimersByTime(seconds * 1000))

describe("TimerDemo", () => {
  it("décompte à la seconde et passe en alerte à 5 s", () => {
    vi.useFakeTimers()
    reducedMotion(false)
    render(<TimerDemo />)

    expect(screen.getByText("00:20")).not.toHaveClass("text-warning-ink")
    advance(14)
    expect(screen.getByText("00:06")).not.toHaveClass("text-warning-ink")
    advance(1)
    expect(screen.getByText("00:05")).toHaveClass("text-warning-ink")
  })

  it("repart de 20 s une fois arrivé à zéro", () => {
    vi.useFakeTimers()
    reducedMotion(false)
    render(<TimerDemo />)

    advance(20)
    expect(screen.getByText("00:00")).toBeInTheDocument()
    advance(1)
    expect(screen.getByText("00:20")).not.toHaveClass("text-warning-ink")
  })

  it("reste figé quand l'utilisateur réduit les animations", () => {
    vi.useFakeTimers()
    reducedMotion(true)
    render(<TimerDemo />)

    advance(5)
    expect(screen.getByText("00:20")).toBeInTheDocument()
  })
})
