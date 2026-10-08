import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import TarifsRoute from "@/app/(marketing)/tarifs/page"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/tarifs",
  unstable_isUnrecognizedActionError: () => false,
}))
vi.mock("@/features/payments/actions", () => ({
  createStripeCheckout: vi.fn(),
}))
vi.mock("@/features/marketing/cached", () => ({
  getCachedAvailableProducts: vi.fn(async () => []),
  getCachedMarketingStats: vi.fn(async () => ({
    totalQuestions: "3000+",
    totalUsers: "200+",
    successRate: "90%",
  })),
}))
vi.mock("@/features/payments/dal", () => ({
  getAccessStatus: vi.fn(async () => null),
}))
vi.mock("@/lib/dal", () => ({
  getCurrentSession: vi.fn(async () => null),
}))

const renderRoute = async (query: { annule?: string }) =>
  render(await TarifsRoute({ searchParams: Promise.resolve(query) }))

describe("/tarifs — retour d'un Checkout annulé", () => {
  it("affiche le bandeau d'annulation avec ?annule=1", async () => {
    await renderRoute({ annule: "1" })

    expect(screen.getByRole("status")).toHaveTextContent("Paiement annulé")
  })

  it("ne l'affiche pas sans le paramètre", async () => {
    await renderRoute({})

    expect(screen.queryByText(/Paiement annulé/)).toBeNull()
  })
})
