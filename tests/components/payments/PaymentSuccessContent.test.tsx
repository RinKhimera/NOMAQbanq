import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PaymentSuccessContent } from "@/app/(dashboard)/tableau-de-bord/paiement/_components/payment-success-client"
import {
  type VerifyCheckoutResult,
  verifyStripeCheckout,
} from "@/features/payments/actions"

vi.mock("@/features/payments/actions", () => ({
  verifyStripeCheckout: vi.fn(),
}))
const params = { current: new URLSearchParams("session_id=cs_test_1") }
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useSearchParams: () => params.current,
}))

const DAY = 24 * 60 * 60 * 1000
const verify = vi.mocked(verifyStripeCheckout)

const paid = (
  over: Partial<Extract<VerifyCheckoutResult, { success: true }>> = {},
): VerifyCheckoutResult => ({
  success: true,
  status: "paid",
  amountTotal: 20000,
  currency: "cad",
  customerEmail: "etudiant@test.invalid",
  purchase: {
    productName: "Accès Examens · 6 mois",
    status: "completed",
    access: [{ type: "exam", expiresAt: Date.now() + 180 * DAY }],
  },
  ...over,
})

const awaitingWebhook = {
  productName: "Accès Examens · 6 mois",
  status: "pending" as const,
  access: [],
}

const notYetFulfilled = paid({ purchase: awaitingWebhook })

const unpaid = paid({ status: "unpaid", purchase: awaitingWebhook })

beforeEach(() => {
  params.current = new URLSearchParams("session_id=cs_test_1")
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
})

describe("PaymentSuccessContent", () => {
  it("vérification : annonce la vérification tant que la réponse n'est pas là", () => {
    verify.mockReturnValue(new Promise(() => {}))

    render(<PaymentSuccessContent supportEmail="support@test.invalid" />)

    expect(
      screen.getByRole("heading", { name: "Vérification du paiement…" }),
    ).toBeInTheDocument()
    expect(document.title).toBe("Vérification du paiement | NOMAQbanq")
  })

  it("réussi : récapitulatif et accès activé lu en base", async () => {
    verify.mockResolvedValue(paid())

    render(<PaymentSuccessContent supportEmail="support@test.invalid" />)

    expect(
      await screen.findByRole("heading", { name: "Paiement réussi" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Accès Examens · 6 mois")).toBeInTheDocument()
    expect(screen.getByText("200 $")).toBeInTheDocument()
    expect(screen.getByText("etudiant@test.invalid")).toBeInTheDocument()
    const access = screen.getByRole("list", { name: "Accès activé" })
    expect(within(access).getByText("Examens")).toBeInTheDocument()
    expect(within(access).getByText(/Expire le/)).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Aller au tableau de bord/ }),
    ).toHaveAttribute("href", "/tableau-de-bord")
    await waitFor(() =>
      expect(document.title).toBe("Paiement réussi | NOMAQbanq"),
    )
  })

  it("réussi avant le webhook : n'affirme pas l'accès, puis l'affiche à la relecture", async () => {
    verify.mockResolvedValueOnce(notYetFulfilled).mockResolvedValue(paid())

    render(<PaymentSuccessContent supportEmail="support@test.invalid" />)

    expect(
      await screen.findByText("Activation de votre accès…"),
    ).toBeInTheDocument()
    expect(screen.queryByRole("list", { name: /Accès activé/ })).toBeNull()

    await act(() => vi.advanceTimersByTimeAsync(2000))

    expect(
      await screen.findByRole("list", { name: "Accès activé" }),
    ).toBeInTheDocument()
    expect(screen.queryByText("Activation de votre accès…")).toBeNull()
  })

  it("activation qui tarde : cesse de relire après 5 essais et propose de vérifier à nouveau", async () => {
    verify.mockResolvedValue(notYetFulfilled)

    render(<PaymentSuccessContent supportEmail="support@test.invalid" />)
    await screen.findByText("Activation de votre accès…")
    for (let i = 0; i < 6; i++) {
      await act(() => vi.advanceTimersByTimeAsync(2000))
    }

    expect(verify).toHaveBeenCalledTimes(6)
    verify.mockResolvedValue(paid())
    await userEvent.click(
      screen.getByRole("button", { name: "Vérifier à nouveau" }),
    )
    expect(
      await screen.findByRole("list", { name: "Accès activé" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Paiement réussi" }),
    ).toHaveFocus()
  })

  it("échec passager pendant l'activation : le paiement réussi reste affiché", async () => {
    verify.mockResolvedValueOnce(notYetFulfilled).mockResolvedValue({
      success: false,
      error: "Erreur réseau",
    })

    render(<PaymentSuccessContent supportEmail="support@test.invalid" />)
    await screen.findByText("Activation de votre accès…")
    await act(() => vi.advanceTimersByTimeAsync(2000))

    expect(verify).toHaveBeenCalledTimes(2)
    expect(
      screen.getByRole("heading", { name: "Paiement réussi" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Vérifier à nouveau" }),
    ).toBeInTheDocument()
  })

  it("pack Premium : les deux accès", async () => {
    verify.mockResolvedValue(
      paid({
        purchase: {
          productName: "Pack Premium · 6 mois",
          status: "completed",
          access: [
            { type: "exam", expiresAt: Date.now() + 180 * DAY },
            { type: "training", expiresAt: Date.now() + 180 * DAY },
          ],
        },
      }),
    )

    render(<PaymentSuccessContent supportEmail="support@test.invalid" />)

    const access = await screen.findByRole("list", { name: "Accès activés" })
    expect(within(access).getAllByRole("listitem")).toHaveLength(2)
  })

  it("code promo à 100 % (Stripe : paid, total 0) : mention du code, pas de reçu", async () => {
    verify.mockResolvedValue(paid({ status: "paid", amountTotal: 0 }))

    render(<PaymentSuccessContent supportEmail="support@test.invalid" />)

    expect(
      await screen.findByRole("heading", { name: "Paiement réussi" }),
    ).toBeInTheDocument()
    expect(screen.getByText("0 $")).toBeInTheDocument()
    expect(screen.getByText("Code promo appliqué (−100 %)")).toBeInTheDocument()
    expect(screen.queryByText(/Reçu envoyé à/)).toBeNull()
    expect(
      screen.getByText("Code promo", { selector: "span" }),
    ).toBeInTheDocument()
  })

  it("paiement différé échoué ou session expirée : ne promet aucun accès, ne relit pas", async () => {
    verify.mockResolvedValue(
      paid({
        status: "unpaid",
        purchase: { ...awaitingWebhook, status: "failed" },
      }),
    )

    render(<PaymentSuccessContent supportEmail="support@test.invalid" />)

    expect(
      await screen.findByRole("heading", {
        name: "Ce paiement n'a pas abouti",
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/sera activé/)).toBeNull()
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(verify).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(document.title).toBe("Paiement non abouti | NOMAQbanq"),
    )
  })

  it("en attente puis réussi : texte juste pendant l'attente, relecture automatique", async () => {
    verify.mockResolvedValueOnce(unpaid).mockResolvedValue(paid())

    render(<PaymentSuccessContent supportEmail="support@test.invalid" />)

    expect(
      await screen.findByRole("heading", {
        name: "Paiement en cours de confirmation",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Le paiement n'est pas encore confirmé/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Vous pouvez quitter cette page/),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(document.title).toBe("Paiement en attente | NOMAQbanq"),
    )

    await act(() => vi.advanceTimersByTimeAsync(2000))

    expect(
      await screen.findByRole("heading", { name: "Paiement réussi" }),
    ).toBeInTheDocument()
  })

  it("achat remboursé depuis : le dit, sans relire ni annoncer d'accès", async () => {
    verify.mockResolvedValue(
      paid({
        purchase: { ...awaitingWebhook, status: "refunded" },
      }),
    )

    render(<PaymentSuccessContent supportEmail="support@test.invalid" />)

    expect(
      await screen.findByRole("heading", {
        name: "Ce paiement a été remboursé",
      }),
    ).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(verify).toHaveBeenCalledTimes(1)
    expect(screen.queryByText("Activation de votre accès…")).toBeNull()
  })

  it("erreur sans session_id : n'interroge pas Stripe, renvoie vers les tarifs", () => {
    params.current = new URLSearchParams("")

    render(<PaymentSuccessContent supportEmail="support@test.invalid" />)

    expect(verify).not.toHaveBeenCalled()
    expect(
      screen.getByRole("heading", {
        name: "Impossible de vérifier ce paiement",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Retour aux tarifs" }),
    ).toHaveAttribute("href", "/tarifs")
    expect(document.title).toBe("Erreur de paiement | NOMAQbanq")
  })

  it("erreur de vérification (session refusée) : même carte d'erreur", async () => {
    verify.mockResolvedValue({
      success: false,
      error: "Session non trouvée ou invalide",
    })

    render(<PaymentSuccessContent supportEmail="support@test.invalid" />)

    expect(
      await screen.findByRole("heading", {
        name: "Impossible de vérifier ce paiement",
      }),
    ).toBeInTheDocument()
  })
})
