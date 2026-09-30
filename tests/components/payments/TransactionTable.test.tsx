import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TIER_MIN_REM } from "@/components/shared/data-table/column-visibility"
import { TransactionTable } from "@/components/shared/payments/transaction-table"
import type { MyTransactionView } from "@/features/payments/dal"

vi.mock("@/lib/format", () => ({
  formatCurrency: (amount: number, currency?: string) =>
    `${(amount / 100).toFixed(0)} ${currency || "CAD"}`,
  formatShortDate: (ts: number) => `date-${ts}`,
  formatTimeOnly: (ts: number) => `time-${ts}`,
}))

const makeTransaction = (
  overrides: Partial<MyTransactionView> = {},
): MyTransactionView => ({
  id: "txn_1",
  type: "stripe",
  status: "completed",
  amountPaid: 5000,
  currency: "CAD",
  accessType: "exam",
  durationDays: 30,
  accessExpiresAt: 1702592000000,
  createdAt: 1700000000000,
  completedAt: 1700000000000,
  paymentMethod: null,
  notes: null,
  product: { id: "prod_1", code: "exam_access", name: "Accès Examens" },
  ...overrides,
})

describe("TransactionTable", () => {
  describe("état vide", () => {
    it("message vide personnalisé et texte explicatif", () => {
      render(<TransactionTable transactions={[]} emptyMessage="Rien ici" />)
      expect(screen.getByText("Rien ici")).toBeInTheDocument()
      expect(
        screen.getByText(
          "Les transactions apparaîtront ici une fois effectuées.",
        ),
      ).toBeInTheDocument()
    })

    it("pas de pied de pagination sous une liste vide", () => {
      render(
        <TransactionTable transactions={[]} footer={<p>pied de liste</p>} />,
      )
      expect(screen.queryByText("pied de liste")).not.toBeInTheDocument()
    })
  })

  describe("lignes", () => {
    it("date, produit, durée et type d'accès, montant", () => {
      render(<TransactionTable transactions={[makeTransaction()]} />)
      expect(screen.getByText("Accès Examens")).toBeInTheDocument()
      expect(screen.getByText("date-1700000000000")).toBeInTheDocument()
      expect(screen.getByText("time-1700000000000")).toBeInTheDocument()
      expect(screen.getByText("30 jours · Examens")).toBeInTheDocument()
      expect(screen.getByText("50 CAD")).toBeInTheDocument()
    })

    it("« Produit inconnu » quand le produit a disparu", () => {
      render(
        <TransactionTable
          transactions={[makeTransaction({ product: null })]}
        />,
      )
      expect(screen.getByText("Produit inconnu")).toBeInTheDocument()
    })

    it.each([
      ["completed", "Complété"],
      ["pending", "En attente"],
      ["failed", "Échoué"],
      ["refunded", "Remboursé"],
    ] as const)("statut %s → « %s »", (status, label) => {
      render(<TransactionTable transactions={[makeTransaction({ status })]} />)
      expect(screen.getByText(label)).toBeInTheDocument()
    })

    it("montant barré quand remboursé", () => {
      render(
        <TransactionTable
          transactions={[makeTransaction({ status: "refunded" })]}
        />,
      )
      expect(screen.getByText("50 CAD")).toHaveClass("line-through")
    })

    it("type Stripe ou Manuel", () => {
      render(
        <TransactionTable
          transactions={[
            makeTransaction(),
            makeTransaction({ id: "txn_2", type: "manual" }),
          ]}
        />,
      )
      expect(screen.getByText("Stripe")).toBeInTheDocument()
      expect(screen.getByText("Manuel")).toBeInTheDocument()
    })

    it("le pied de pagination suit les lignes", () => {
      render(
        <TransactionTable
          transactions={[makeTransaction()]}
          footer={<p>pied de liste</p>}
        />,
      )
      expect(screen.getByText("pied de liste")).toBeInTheDocument()
    })
  })

  describe("rechargement en place", () => {
    it("garde les lignes affichées et marque la zone occupée", () => {
      const { container } = render(
        <TransactionTable transactions={[makeTransaction()]} isPending />,
      )
      expect(screen.getByText("Accès Examens")).toBeInTheDocument()
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    })
  })

  describe("colonnes selon la largeur du tableau", () => {
    const header = (name: string) => screen.getByRole("columnheader", { name })

    it("Type n'apparaît qu'à partir du palier moyen", () => {
      render(<TransactionTable transactions={[makeTransaction()]} />)
      for (const name of ["Date", "Produit", "Statut", "Montant"])
        expect(header(name)).not.toHaveClass("hidden")
      expect(header("Type")).toHaveClass(
        "hidden",
        `@min-[${TIER_MIN_REM.medium}rem]:table-cell`,
      )
    })
  })
})
