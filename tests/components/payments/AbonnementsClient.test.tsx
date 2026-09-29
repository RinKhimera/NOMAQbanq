import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AbonnementsClient } from "@/app/(dashboard)/tableau-de-bord/abonnements/_components/abonnements-client"
import { createCustomerPortal } from "@/features/payments/actions"
import type {
  AccessStatus,
  LapsedAccess,
  ProductView,
} from "@/features/payments/dal"

vi.mock("@/features/payments/actions", () => ({
  createCustomerPortal: vi.fn(),
  loadMoreMyTransactions: vi.fn(),
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock("@/components/shared/payments/transaction-table", () => ({
  TransactionTable: () => <div data-testid="transactions" />,
}))

const DAY = 24 * 60 * 60 * 1000
const product = (p: Partial<ProductView>): ProductView => ({
  id: p.code ?? "x",
  code: "exam_access",
  name: "Accès",
  description: "",
  priceCAD: 5000,
  durationDays: 30,
  accessType: "exam",
  isCombo: false,
  ...p,
})
const catalog = [
  product({ code: "exam_access" }),
  product({ code: "training_access", accessType: "training" }),
  product({
    code: "premium_access",
    isCombo: true,
    durationDays: 180,
    priceCAD: 35000,
  }),
]
const active = { expiresAt: Date.now() + 40 * DAY, daysRemaining: 40 }

const renderPage = (
  access: AccessStatus = { examAccess: active, trainingAccess: null },
  lapsed: LapsedAccess = { exam: null, training: null },
) =>
  render(
    <AbonnementsClient
      accessStatus={access}
      lapsed={lapsed}
      initialTransactions={{ items: [], nextCursor: null }}
      products={catalog}
    />,
  )

describe("AbonnementsClient", () => {
  beforeEach(() => vi.mocked(createCustomerPortal).mockReset())

  it("le portail Stripe ne s'ouvre qu'après confirmation", async () => {
    vi.mocked(createCustomerPortal).mockResolvedValue({
      success: false,
      error: "Aucun historique de paiement",
    } as never)
    renderPage()
    await userEvent.click(
      screen.getByRole("button", { name: /Gérer mes factures/ }),
    )
    expect(
      screen.getByRole("alertdialog", {
        name: "Ouvrir le portail de facturation",
      }),
    ).toBeInTheDocument()
    expect(createCustomerPortal).not.toHaveBeenCalled()

    await userEvent.click(screen.getByTestId("billing-portal-confirm"))
    await waitFor(() => expect(createCustomerPortal).toHaveBeenCalledTimes(1))
  })

  it("annuler rend le focus au bouton qui a ouvert le Dialog", async () => {
    renderPage()
    const trigger = screen.getByRole("button", { name: /Gérer mes factures/ })
    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }))
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(createCustomerPortal).not.toHaveBeenCalled()
  })

  it("bandeau Premium quand un accès manque, économie lue dans le catalogue", () => {
    renderPage()
    expect(
      screen.getByText("Pack Premium : les deux accès pendant 6 mois"),
    ).toBeInTheDocument()
    // 2 × 6 mensuels à 50 $ = 600 $ ; 600 − 350 = 250 $.
    expect(screen.getByText(/soit 250\s\$ d'économie/)).toBeInTheDocument()
  })

  it("aucun bandeau quand les deux accès sont actifs", () => {
    renderPage({ examAccess: active, trainingAccess: active })
    expect(screen.queryByText(/Pack Premium : les deux accès/)).toBeNull()
  })

  it("accès expiré : date de fin et « Réactiver l'accès »", () => {
    renderPage(
      { examAccess: active, trainingAccess: null },
      { exam: null, training: Date.parse("2026-09-21T15:00:00Z") },
    )
    expect(screen.getByText("21 septembre 2026")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Réactiver l'accès/ }),
    ).toHaveAttribute("href", "/tarifs")
  })
})
