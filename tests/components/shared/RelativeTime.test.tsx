import { act, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { RelativeTime } from "@/components/shared/relative-time"

describe("RelativeTime", () => {
  it("rend le temps relatif du timestamp", () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    render(<RelativeTime timestamp={fiveMinutesAgo} />)
    expect(screen.getByText("il y a 5 minutes")).toBeInTheDocument()
  })

  it("rafraîchit le texte au tick périodique", () => {
    vi.useFakeTimers()
    try {
      const start = Date.now()
      render(<RelativeTime timestamp={start} />)
      expect(screen.getByText("il y a moins d’une minute")).toBeInTheDocument()

      // Deux ticks de 60 s → le texte relatif avance sans re-render parent.
      act(() => {
        vi.advanceTimersByTime(2 * 60 * 1000)
      })
      expect(screen.getByText("il y a 2 minutes")).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
