import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AbonnementsClient } from "@/app/(dashboard)/tableau-de-bord/abonnements/_components/abonnements-client"
import { createCustomerPortal } from "@/features/payments/actions"
import type {
  AccessStatus,
  LapsedAccess,
  MyTransactionView,
  MyTransactionsPage,
  ProductView,
} from "@/features/payments/dal"

vi.mock("@/features/payments/actions", () => ({
  createCustomerPortal: vi.fn(),
}))
const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/tableau-de-bord/abonnements",
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

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

const emptyPage: MyTransactionsPage = {
  items: [],
  firstIndex: 0,
  prevCursor: null,
  nextCursor: null,
}

const renderPage = (
  access: AccessStatus = { examAccess: active, trainingAccess: null },
  lapsed: LapsedAccess = { exam: null, training: null },
  page: MyTransactionsPage = emptyPage,
) =>
  render(
    <AbonnementsClient
      accessStatus={access}
      lapsed={lapsed}
      transactions={page}
      products={catalog}
    />,
  )

describe("AbonnementsClient", () => {
  beforeEach(() => vi.mocked(createCustomerPortal).mockReset())

  it("le portail ne s'ouvre qu'après confirmation ; une erreur laisse le Dialog ouvert", async () => {
    vi.mocked(createCustomerPortal).mockResolvedValue({
      success: false,
      error: "Stripe indisponible",
    } as never)
    renderPage()
    await userEvent.click(
      screen.getByRole("button", { name: /Gérer mes factures/ }),
    )
    const dialog = screen.getByRole("alertdialog", {
      name: "Ouvrir le portail de facturation",
    })
    expect(createCustomerPortal).not.toHaveBeenCalled()

    await userEvent.click(screen.getByTestId("billing-portal-confirm"))
    await waitFor(() => expect(createCustomerPortal).toHaveBeenCalledTimes(1))
    expect(dialog).toBeInTheDocument()
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

  it("historique paginé par 10 : page suivante et précédente dans l'URL", async () => {
    const tx = (k: number): MyTransactionView => ({
      id: `tx${k}`,
      type: "stripe",
      status: "completed",
      amountPaid: 5000,
      currency: "CAD",
      accessType: "exam",
      durationDays: 30,
      accessExpiresAt: Date.now(),
      createdAt: Date.now() - k * DAY,
      completedAt: Date.now() - k * DAY,
      paymentMethod: null,
      product: { id: "p", code: "exam_access", name: "Accès Examens" },
    })
    renderPage(undefined, undefined, {
      items: Array.from({ length: 10 }, (_, k) => tx(k + 10)),
      firstIndex: 10,
      prevCursor: "haut",
      nextCursor: "bas",
    })
    expect(screen.getByText("lignes 11–20")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /Suivant/ }))
    expect(push).toHaveBeenLastCalledWith(
      "/tableau-de-bord/abonnements?apres=bas",
      { scroll: false },
    )
    await userEvent.click(screen.getByRole("button", { name: /Précédent/ }))
    expect(push).toHaveBeenLastCalledWith(
      "/tableau-de-bord/abonnements?avant=haut",
      { scroll: false },
    )
  })
})
