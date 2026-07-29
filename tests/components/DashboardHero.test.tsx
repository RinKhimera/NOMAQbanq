import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DashboardHero } from "@/app/(dashboard)/tableau-de-bord/_components/dashboard-hero"

vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../helpers/motion-mock")
  return motionMockFactory
})

// Instants choisis dans le fuseau de la plateforme (America/Toronto, EDT = UTC-4
// en juillet). Les tests tournent avec TZ=UTC : si le salut était calculé sur
// l'heure du runtime, ces cas tomberaient à côté — c'est précisément le bug
// NOMAQBANQ-5.
const atTorontoHour = (hour: number) => Date.UTC(2026, 6, 15, hour + 4, 30, 0) // juillet → EDT

const renderAt = (now: number) =>
  render(
    <DashboardHero
      userName="Marie Dupont"
      averageScore={72}
      hasCompletedExams
      accessStatus={null}
      now={now}
    />,
  )

describe("DashboardHero — salutation", () => {
  it("dit Bonjour le matin (heure de Toronto, pas celle du runtime)", () => {
    renderAt(atTorontoHour(9))
    expect(screen.getByText(/Bonjour/)).toBeInTheDocument()
  })

  it("dit Bon après-midi l'après-midi", () => {
    renderAt(atTorontoHour(14))
    expect(screen.getByText(/Bon après-midi/)).toBeInTheDocument()
  })

  it("dit Bonsoir le soir", () => {
    renderAt(atTorontoHour(20))
    expect(screen.getByText(/Bonsoir/)).toBeInTheDocument()
  })

  it("dérive le salut de la prop `now`, jamais de l'horloge locale", () => {
    // Deux rendus au même instant serveur doivent donner le MÊME salut, même si
    // l'horloge réelle a avancé entre-temps : c'est ce qui garantit l'égalité
    // SSR / hydratation à cheval sur 12h00 et 18h00.
    const boundary = atTorontoHour(17) // 17h30 Toronto
    const { unmount } = renderAt(boundary)
    const first = screen.getByText(/Bonjour|Bon après-midi|Bonsoir/).textContent
    unmount()

    vi.setSystemTime(new Date(atTorontoHour(23)))
    renderAt(boundary)
    const second = screen.getByText(
      /Bonjour|Bon après-midi|Bonsoir/,
    ).textContent
    vi.useRealTimers()

    expect(second).toBe(first)
  })
})
