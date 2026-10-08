import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ActiveSeriesCard } from "@/app/(dashboard)/tableau-de-bord/entrainement/_components/active-series-card"

const { refresh, toastError, toastSuccess, abandonTrainingSession } =
  vi.hoisted(() => ({
    refresh: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    abandonTrainingSession: vi.fn(),
  }))

vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh, push: vi.fn() }),
}))
vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}))
vi.mock("@/features/training/actions", () => ({ abandonTrainingSession }))

const HOUR = 60 * 60 * 1000
const NOW = Date.parse("2026-09-29T15:00:00Z")

const session = {
  id: "s1",
  questionCount: 20,
  answeredCount: 12,
  mode: "tutor" as const,
  domain: "Pédiatrie",
  startedAt: NOW - 2 * HOUR - 14 * 60_000,
  expiresAt: NOW + 21 * HOUR + 46 * 60_000,
}

describe("ActiveSeriesCard", () => {
  it("domaine, mode, progression, âge et expiration depuis l'ancre serveur", () => {
    render(<ActiveSeriesCard session={session} initialNow={NOW} />)
    expect(screen.getByText("Pédiatrie · mode tuteur")).toBeInTheDocument()
    expect(screen.getByText("12 / 20 répondues")).toBeInTheDocument()
    expect(screen.getByText("2 h 14")).toBeInTheDocument()
    expect(screen.getByText("21 h 46")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Reprendre" })).toHaveAttribute(
      "href",
      "/tableau-de-bord/entrainement/s1",
    )
  })

  it("« Tous les domaines » sans domaine, mode test", () => {
    render(
      <ActiveSeriesCard
        session={{ ...session, domain: null, mode: "test" }}
        initialNow={NOW}
      />,
    )
    expect(
      screen.getByText("Tous les domaines · mode test"),
    ).toBeInTheDocument()
  })

  it("sous deux heures, l'expiration passe en avertissement", () => {
    const { unmount } = render(
      <ActiveSeriesCard
        session={{ ...session, expiresAt: NOW + 50 * 60_000 }}
        initialNow={NOW}
      />,
    )
    const expiry = () => screen.getByText(/^Expire dans/)
    expect(expiry()).toHaveTextContent("Expire dans 50 min")
    expect(expiry()).toHaveAttribute("data-tone", "warning")
    expect(expiry()).toHaveClass("text-warning-ink")
    unmount()
    render(<ActiveSeriesCard session={session} initialNow={NOW} />)
    expect(expiry()).toHaveTextContent("Expire dans 21 h 46")
    expect(expiry()).toHaveAttribute("data-tone", "neutral")
    expect(expiry()).not.toHaveClass("text-warning-ink")
  })

  it("abandonner : confirmation, action, rafraîchissement", async () => {
    abandonTrainingSession.mockResolvedValue({ success: true })
    render(<ActiveSeriesCard session={session} initialNow={NOW} />)

    await userEvent.click(screen.getByRole("button", { name: "Abandonner" }))
    expect(
      screen.getByRole("heading", { name: "Abandonner la série ?" }),
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole("button", { name: "Abandonner la série" }),
    )

    expect(abandonTrainingSession).toHaveBeenCalledWith({ sessionId: "s1" })
    expect(toastSuccess).toHaveBeenCalledWith("Série abandonnée")
    expect(refresh).toHaveBeenCalled()
  })

  it("un échec laisse le dialogue ouvert et le signale", async () => {
    abandonTrainingSession.mockResolvedValue({
      success: false,
      error: "Cette série a expiré",
    })
    render(<ActiveSeriesCard session={session} initialNow={NOW} />)

    await userEvent.click(screen.getByRole("button", { name: "Abandonner" }))
    await userEvent.click(
      screen.getByRole("button", { name: "Abandonner la série" }),
    )

    expect(toastError).toHaveBeenCalledWith("Erreur", {
      description: "Cette série a expiré",
    })
    expect(refresh).not.toHaveBeenCalled()
    expect(
      screen.getByRole("heading", { name: "Abandonner la série ?" }),
    ).toBeInTheDocument()
  })

  it("expirée : le dit, ne propose plus la reprise, « Retirer » abandonne", async () => {
    abandonTrainingSession.mockResolvedValue({ success: true })
    render(
      <ActiveSeriesCard
        session={{ ...session, expiresAt: NOW - HOUR }}
        initialNow={NOW}
        expired
      />,
    )
    const card = screen.getByTestId("active-series-card")
    expect(card).toHaveAttribute("data-state", "expired")
    expect(card).toHaveTextContent("Série expirée")
    expect(card).toHaveTextContent("ses réponses ne comptent pas")
    expect(screen.queryByRole("link", { name: /Reprendre/ })).toBeNull()

    await userEvent.click(screen.getByRole("button", { name: "Retirer" }))
    expect(
      screen.getByRole("heading", { name: "Retirer la série expirée ?" }),
    ).toBeInTheDocument()
    // Le dialogue ouvert rend le reste de la page inerte : un seul « Retirer ».
    await userEvent.click(screen.getByRole("button", { name: "Retirer" }))
    expect(abandonTrainingSession).toHaveBeenCalledWith({
      sessionId: session.id,
    })
    expect(toastSuccess).toHaveBeenCalledWith("Série retirée")
    expect(refresh).toHaveBeenCalled()
  })
})
