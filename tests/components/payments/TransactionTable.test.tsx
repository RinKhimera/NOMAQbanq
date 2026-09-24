import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { TIER_MIN_REM } from "@/components/shared/data-table/column-visibility"
import type { Transaction } from "@/components/shared/payments/transaction-table"
import { TransactionTable } from "@/components/shared/payments/transaction-table"

vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="next-image" />
  ),
}))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@/lib/format", () => ({
  formatCurrency: (amount: number, currency?: string) =>
    `${(amount / 100).toFixed(0)} ${currency || "CAD"}`,
  formatShortDate: (ts: number) => `date-${ts}`,
  formatTimeOnly: (ts: number) => `time-${ts}`,
}))

const makeTransaction = (
  overrides: Partial<Transaction> = {},
): Transaction => ({
  _id: "txn_1",
  type: "stripe",
  status: "completed",
  amountPaid: 5000,
  currency: "CAD",
  accessType: "exam",
  durationDays: 30,
  createdAt: 1700000000000,
  product: { _id: "prod_1", name: "Accès Examens 30 jours" },
  user: { _id: "user_1", name: "Jean Dupont", email: "jean@example.com" },
  ...overrides,
})

describe("TransactionTable", () => {
  describe("état vide", () => {
    it("affiche le message vide par défaut", () => {
      render(<TransactionTable transactions={[]} />)

      expect(screen.getByText("Aucune transaction trouvée")).toBeInTheDocument()
    })

    it("affiche un message vide personnalisé", () => {
      render(
        <TransactionTable
          transactions={[]}
          emptyMessage="Rien à afficher ici"
        />,
      )

      expect(screen.getByText("Rien à afficher ici")).toBeInTheDocument()
    })

    it("affiche le texte explicatif sous le message vide", () => {
      render(<TransactionTable transactions={[]} />)

      expect(
        screen.getByText(
          "Les transactions apparaîtront ici une fois effectuées",
        ),
      ).toBeInTheDocument()
    })
  })

  describe("lignes de transactions", () => {
    it("affiche les données d'une transaction", () => {
      const transaction = makeTransaction()
      render(<TransactionTable transactions={[transaction]} />)

      expect(screen.getByText("Accès Examens 30 jours")).toBeInTheDocument()
      expect(screen.getByText("date-1700000000000")).toBeInTheDocument()
      expect(screen.getByText("time-1700000000000")).toBeInTheDocument()
      expect(screen.getByText(/30 jours · Examens/)).toBeInTheDocument()
    })

    it("affiche le badge de litige à côté du statut", () => {
      const transaction = makeTransaction({ disputeStatus: "needs_response" })
      render(<TransactionTable transactions={[transaction]} />)

      expect(screen.getByText("Litige en cours")).toBeInTheDocument()
    })

    it("n'affiche aucun badge de litige sans litige", () => {
      render(<TransactionTable transactions={[makeTransaction()]} />)

      expect(screen.queryByText(/Litige/)).not.toBeInTheDocument()
    })

    it("affiche 'Produit inconnu' quand le produit est null", () => {
      const transaction = makeTransaction({ product: null })
      render(<TransactionTable transactions={[transaction]} />)

      expect(screen.getByText("Produit inconnu")).toBeInTheDocument()
    })

    it("affiche plusieurs lignes de transactions", () => {
      const transactions = [
        makeTransaction({ _id: "txn_1" }),
        makeTransaction({
          _id: "txn_2",
          product: { _id: "prod_2", name: "Accès Entraînement" },
          accessType: "training",
        }),
      ]
      render(<TransactionTable transactions={transactions} />)

      expect(screen.getByText("Accès Examens 30 jours")).toBeInTheDocument()
      expect(screen.getByText("Accès Entraînement")).toBeInTheDocument()
    })

    it("affiche 'Entraînement' pour le type d'accès training", () => {
      const transaction = makeTransaction({ accessType: "training" })
      render(<TransactionTable transactions={[transaction]} />)

      expect(screen.getByText(/Entraînement/)).toBeInTheDocument()
    })

    it("affiche le montant formaté", () => {
      const transaction = makeTransaction({
        amountPaid: 10000,
        currency: "CAD",
      })
      render(<TransactionTable transactions={[transaction]} />)

      expect(screen.getByText("100 CAD")).toBeInTheDocument()
    })
  })

  describe("badges de statut", () => {
    it("affiche 'Complété' pour le statut completed", () => {
      const transaction = makeTransaction({ status: "completed" })
      render(<TransactionTable transactions={[transaction]} />)

      expect(screen.getByText("Complété")).toBeInTheDocument()
    })

    it("affiche 'En attente' pour le statut pending", () => {
      const transaction = makeTransaction({ status: "pending" })
      render(<TransactionTable transactions={[transaction]} />)

      expect(screen.getByText("En attente")).toBeInTheDocument()
    })

    it("affiche 'Échoué' pour le statut failed", () => {
      const transaction = makeTransaction({ status: "failed" })
      render(<TransactionTable transactions={[transaction]} />)

      expect(screen.getByText("Échoué")).toBeInTheDocument()
    })

    it("affiche 'Remboursé' pour le statut refunded", () => {
      const transaction = makeTransaction({ status: "refunded" })
      render(<TransactionTable transactions={[transaction]} />)

      expect(screen.getByText("Remboursé")).toBeInTheDocument()
    })
  })

  describe("badges de type", () => {
    it("affiche 'Stripe' pour le type stripe", () => {
      const transaction = makeTransaction({ type: "stripe" })
      render(<TransactionTable transactions={[transaction]} />)

      expect(screen.getByText("Stripe")).toBeInTheDocument()
    })

    it("affiche 'Manuel' pour le type manual", () => {
      const transaction = makeTransaction({ type: "manual" })
      render(<TransactionTable transactions={[transaction]} />)

      expect(screen.getByText("Manuel")).toBeInTheDocument()
    })
  })

  describe("colonne utilisateur", () => {
    it("affiche la colonne utilisateur quand showUserColumn est true", () => {
      const transaction = makeTransaction()
      render(
        <TransactionTable transactions={[transaction]} showUserColumn={true} />,
      )

      expect(screen.getByText("Jean Dupont")).toBeInTheDocument()
      expect(screen.getByText("jean@example.com")).toBeInTheDocument()
    })

    it("affiche l'en-tête Utilisateur quand showUserColumn est true", () => {
      const transaction = makeTransaction()
      render(
        <TransactionTable transactions={[transaction]} showUserColumn={true} />,
      )

      expect(screen.getByText("Utilisateur")).toBeInTheDocument()
    })

    it("n'affiche pas la colonne utilisateur par défaut", () => {
      const transaction = makeTransaction()
      render(<TransactionTable transactions={[transaction]} />)

      expect(screen.queryByText("Utilisateur")).not.toBeInTheDocument()
      expect(screen.queryByText("Jean Dupont")).not.toBeInTheDocument()
    })

    it("affiche 'Utilisateur' quand user est null", () => {
      const transaction = makeTransaction({ user: null })
      render(
        <TransactionTable transactions={[transaction]} showUserColumn={true} />,
      )

      // Le fallback pour user.name est "Utilisateur" (texte de l'en-tête ET du fallback)
      const userCells = screen.getAllByText("Utilisateur")
      expect(userCells.length).toBeGreaterThanOrEqual(2) // header + fallback
    })
  })

  describe("bouton charger plus", () => {
    it("affiche le bouton quand hasMore est true et onLoadMore est fourni", () => {
      const onLoadMore = vi.fn()
      render(
        <TransactionTable
          transactions={[makeTransaction()]}
          hasMore={true}
          onLoadMore={onLoadMore}
        />,
      )

      expect(screen.getByText("Charger plus")).toBeInTheDocument()
    })

    it("reste proposé sous le message vide, pour chercher au-delà de la page chargée", () => {
      render(
        <TransactionTable
          transactions={[]}
          hasMore
          onLoadMore={vi.fn()}
          emptyMessage="Aucune transaction ne correspond aux filtres"
        />,
      )

      expect(
        screen.getByText("Aucune transaction ne correspond aux filtres"),
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /charger plus/i }),
      ).toBeInTheDocument()
    })

    it("n'affiche pas le bouton quand hasMore est false", () => {
      const onLoadMore = vi.fn()
      render(
        <TransactionTable
          transactions={[makeTransaction()]}
          hasMore={false}
          onLoadMore={onLoadMore}
        />,
      )

      expect(screen.queryByText("Charger plus")).not.toBeInTheDocument()
    })

    it("n'affiche pas le bouton sans onLoadMore", () => {
      render(
        <TransactionTable transactions={[makeTransaction()]} hasMore={true} />,
      )

      expect(screen.queryByText("Charger plus")).not.toBeInTheDocument()
    })

    it("appelle onLoadMore au clic", () => {
      const onLoadMore = vi.fn()
      render(
        <TransactionTable
          transactions={[makeTransaction()]}
          hasMore={true}
          onLoadMore={onLoadMore}
        />,
      )

      const button = screen.getByRole("button", { name: /charger plus/i })
      fireEvent.click(button)

      expect(onLoadMore).toHaveBeenCalledTimes(1)
    })

    it("affiche 'Chargement...' sur le bouton pendant un chargement supplémentaire", () => {
      const onLoadMore = vi.fn()
      render(
        <TransactionTable
          transactions={[makeTransaction()]}
          hasMore={true}
          onLoadMore={onLoadMore}
          isPending
        />,
      )

      expect(screen.getByText("Chargement...")).toBeInTheDocument()
    })

    it("désactive le bouton charger plus pendant un chargement", () => {
      const onLoadMore = vi.fn()
      render(
        <TransactionTable
          transactions={[makeTransaction()]}
          hasMore={true}
          onLoadMore={onLoadMore}
          isPending
        />,
      )

      const button = screen.getByRole("button")
      expect(button).toBeDisabled()
    })
  })

  describe("en-têtes de table", () => {
    it("affiche les en-têtes de base", () => {
      render(<TransactionTable transactions={[makeTransaction()]} />)

      expect(screen.getByText("Date")).toBeInTheDocument()
      expect(screen.getByText("Produit")).toBeInTheDocument()
      expect(screen.getByText("Type")).toBeInTheDocument()
      expect(screen.getByText("Statut")).toBeInTheDocument()
      expect(screen.getByText("Montant")).toBeInTheDocument()
    })
  })

  describe("rechargement en place", () => {
    it("garde les lignes affichées et marque la zone occupée", () => {
      const { container } = render(
        <TransactionTable transactions={[makeTransaction()]} isPending />,
      )

      // Le contenu reste : pas de squelette qui remplace une liste non vide.
      expect(screen.getByText("Accès Examens 30 jours")).toBeInTheDocument()
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    })

    it("un filtre appliqué à une liste vide garde le message, grisé", () => {
      const { container } = render(
        <TransactionTable transactions={[]} isPending />,
      )

      expect(
        screen
          .getByText("Aucune transaction trouvée")
          .closest('[aria-busy="true"]'),
      ).not.toBeNull()
      expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
        0,
      )
    })
  })

  describe("colonnes selon la largeur du tableau", () => {
    const header = (name: string) => screen.getByRole("columnheader", { name })
    const MEDIUM_CLASS = `@min-[${TIER_MIN_REM.medium}rem]:table-cell`

    it("Date, Produit, Statut et Montant restent affichés sur un tableau étroit", () => {
      render(<TransactionTable transactions={[makeTransaction()]} />)

      for (const name of ["Date", "Produit", "Statut", "Montant"])
        expect(header(name)).not.toHaveClass("hidden")
    })

    it("Type et Utilisateur n'apparaissent qu'à partir du palier moyen", () => {
      render(
        <TransactionTable transactions={[makeTransaction()]} showUserColumn />,
      )

      expect(header("Type")).toHaveClass("hidden", MEDIUM_CLASS)
      expect(header("Utilisateur")).toHaveClass("hidden", MEDIUM_CLASS)
    })

    it("n'offre pas de menu « Colonnes »", () => {
      render(<TransactionTable transactions={[makeTransaction()]} />)

      expect(
        screen.queryByRole("button", { name: /Colonnes/ }),
      ).not.toBeInTheDocument()
    })
  })

  describe("actions sur une transaction manuelle", () => {
    const manual = makeTransaction({ _id: "txn_manual", type: "manual" })
    const stripe = makeTransaction({ _id: "txn_stripe", type: "stripe" })
    const rowOf = (text: string) => {
      const row = screen.getAllByText(text)[0].closest("tr")
      if (!row) throw new Error(`ligne introuvable : ${text}`)
      return row
    }

    it("propose le menu ⋮ sur une ligne manuelle, jamais sur une ligne Stripe", () => {
      render(
        <TransactionTable
          transactions={[manual, stripe]}
          showUserColumn
          onEditTransaction={vi.fn()}
          onDeleteTransaction={vi.fn()}
        />,
      )

      expect(
        within(rowOf("Manuel")).getByRole("button", { name: "Actions" }),
      ).toBeInTheDocument()
      expect(
        within(rowOf("Stripe")).queryByRole("button", { name: "Actions" }),
      ).not.toBeInTheDocument()
    })

    it("« Modifier » et « Supprimer » visent la transaction de la ligne", async () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn()
      render(
        <TransactionTable
          transactions={[stripe, manual]}
          showUserColumn
          onEditTransaction={onEdit}
          onDeleteTransaction={onDelete}
        />,
      )
      const user = userEvent.setup()

      await user.click(screen.getByRole("button", { name: "Actions" }))
      await user.click(
        await screen.findByRole("menuitem", { name: /Modifier/ }),
      )
      await user.click(screen.getByRole("button", { name: "Actions" }))
      await user.click(
        await screen.findByRole("menuitem", { name: /Supprimer/ }),
      )

      expect(onEdit).toHaveBeenCalledWith(manual)
      expect(onDelete).toHaveBeenCalledWith(manual)
    })

    it("sans callback d'action, aucune colonne d'action", () => {
      render(<TransactionTable transactions={[manual]} showUserColumn />)

      expect(
        screen.queryByRole("button", { name: "Actions" }),
      ).not.toBeInTheDocument()
      expect(screen.getAllByRole("columnheader")).toHaveLength(6)
    })
  })
})
