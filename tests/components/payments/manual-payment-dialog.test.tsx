import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AccessImpactPanel } from "@/components/shared/payments/access-impact-panel"
import {
  ManualPaymentDialog,
  PaymentRecordedDialog,
} from "@/components/shared/payments/manual-payment-dialog"
import type { ProductView } from "@/features/payments/dal"

const mocks = vi.hoisted(() => ({
  recordManualPayment: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@/features/payments/actions", () => ({
  recordManualPayment: mocks.recordManualPayment,
  updateManualTransaction: vi.fn(),
  deleteManualTransaction: vi.fn(),
  loadTransactionAccessImpact: vi.fn(),
}))
vi.mock("@/features/exams/actions", () => ({
  loadSearchSelectableUsers: vi.fn(async () => []),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }))

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 8, 27, 15, 2)
const products: ProductView[] = [
  {
    id: "p1",
    code: "exam_access",
    name: "Accès Examens · 1 mois",
    description: "",
    priceCAD: 5000,
    durationDays: 30,
    accessType: "exam",
    isCombo: false,
  },
]
const client = { id: "u1", label: "Chloé Tremblay" }

const renderDialog = () => {
  const onRecorded = vi.fn()
  render(
    <ManualPaymentDialog
      open
      onOpenChange={vi.fn()}
      products={products}
      client={client}
      onRecorded={onRecorded}
    />,
  )
  return { onRecorded }
}

const amount = () => screen.getByLabelText("Montant")

beforeEach(() => {
  mocks.recordManualPayment.mockReset()
  mocks.toastError.mockReset()
})

describe("ManualPaymentDialog", () => {
  it("client déjà choisi, prix du produit proposé, moyen de paiement demandé", () => {
    renderDialog()
    expect(screen.getByText("Chloé Tremblay")).toBeInTheDocument()
    expect(amount()).toHaveValue("50")
    expect(screen.getByText("Moyen de paiement")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Enregistrer et accorder l'accès" }),
    ).toBeEnabled()
  })

  it("montant différent du prix : rappel du prix du produit", () => {
    renderDialog()
    fireEvent.change(amount(), { target: { value: "40" } })
    expect(screen.getByText(/Prix du produit : 50/)).toBeInTheDocument()
  })

  it("règle de la devise : entier en XAF", () => {
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "XAF" }))
    fireEvent.change(amount(), { target: { value: "100,5" } })
    expect(
      screen.getByText("En XAF, le montant est un nombre entier."),
    ).toBeInTheDocument()
  })

  it("accès offert : sans motif, refusé avant tout appel", async () => {
    renderDialog()
    fireEvent.change(amount(), { target: { value: "0" } })
    expect(screen.queryByText("Moyen de paiement")).not.toBeInTheDocument()
    expect(screen.getByText("Motif de la gratuité")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Offrir l'accès" }))
    expect(
      await screen.findByText(
        "Indiquez le motif de la gratuité (5 caractères au moins).",
      ),
    ).toBeInTheDocument()
    expect(mocks.recordManualPayment).not.toHaveBeenCalled()
  })

  it("accès offert avec motif : enregistré sans moyen de paiement", async () => {
    mocks.recordManualPayment.mockResolvedValue({
      success: true,
      transactionId: "t1",
      recordedAt: NOW,
      grants: [
        {
          accessType: "exam",
          expiresAt: NOW + 30 * DAY,
          previousExpiresAt: null,
        },
      ],
    })
    const { onRecorded } = renderDialog()
    fireEvent.change(amount(), { target: { value: "0" } })
    fireEvent.change(screen.getByLabelText(/Motif de la gratuité/), {
      target: { value: "Panne du 21 septembre" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Offrir l'accès" }))
    await waitFor(() => expect(onRecorded).toHaveBeenCalled())
    expect(mocks.recordManualPayment).toHaveBeenCalledWith({
      userId: "u1",
      productCode: "exam_access",
      amountPaid: 0,
      currency: "CAD",
      paymentMethod: null,
      notes: "Panne du 21 septembre",
    })
    expect(onRecorded.mock.calls[0][0]).toMatchObject({
      transactionId: "t1",
      paymentMethod: null,
      amountPaid: 0,
    })
  })

  it("échec serveur : message, dialogue conservé", async () => {
    mocks.recordManualPayment.mockResolvedValue({
      success: false,
      error: "Utilisateur introuvable",
    })
    const { onRecorded } = renderDialog()
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer et accorder l'accès" }),
    )
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Utilisateur introuvable"),
    )
    expect(onRecorded).not.toHaveBeenCalled()
  })
})

describe("PaymentRecordedDialog", () => {
  it("accès prolongé : jours restants + durée, aucun courriel", () => {
    render(
      <PaymentRecordedDialog
        onClose={vi.fn()}
        onView={vi.fn()}
        recorded={{
          transactionId: "t1",
          client,
          productName: "Accès Examens · 1 mois",
          isCombo: false,
          durationDays: 30,
          amountPaid: 5000,
          currency: "CAD",
          paymentMethod: "interac",
          note: "Réf. INT-55120",
          recordedAt: NOW,
          grants: [
            {
              accessType: "exam",
              expiresAt: NOW + 45 * DAY,
              previousExpiresAt: NOW + 15 * DAY,
            },
          ],
        }}
      />,
    )
    expect(screen.getByText("Paiement enregistré")).toBeInTheDocument()
    expect(screen.getByText(/15.j restants \+ 30.j = 45.j/)).toBeInTheDocument()
    expect(screen.getByText("Interac")).toBeInTheDocument()
    expect(
      screen.getByText(/Aucun courriel n'est envoyé au client/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Voir la transaction" }),
    ).toBeInTheDocument()
  })
})

describe("AccessImpactPanel", () => {
  it("impact indisponible : avertissement qui ne bloque pas", () => {
    render(
      <AccessImpactPanel state={{ status: "failed" }} covered={["exam"]} />,
    )
    expect(
      screen.getByText("Impact sur l'accès indisponible"),
    ).toBeInTheDocument()
  })

  it("accès retiré et accès non affecté", () => {
    render(
      <AccessImpactPanel
        covered={["exam", "training"]}
        state={{
          status: "ready",
          loadedAt: NOW,
          impacts: [
            {
              accessType: "exam",
              willAffectAccess: true,
              currentAccessExpiresAt: NOW + 10 * DAY,
              restoredExpiresAt: null,
            },
            {
              accessType: "training",
              willAffectAccess: false,
              currentAccessExpiresAt: null,
              restoredExpiresAt: null,
            },
          ],
        }}
      />,
    )
    expect(screen.getByText("retiré")).toBeInTheDocument()
    expect(screen.getByText("Non affecté")).toBeInTheDocument()
  })

  it("chargement : calcul en cours", () => {
    render(
      <AccessImpactPanel state={{ status: "loading" }} covered={["exam"]} />,
    )
    expect(
      screen.getByText("Calcul de l'impact sur l'accès…"),
    ).toBeInTheDocument()
  })
})
