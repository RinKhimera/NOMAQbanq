import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TransactionDetail } from "@/app/(admin)/admin/transactions/_components/transaction-detail"
import type { AdminTransactionView } from "@/features/payments/dal"
import { NOW, makeTx } from "./fixtures"

const renderDetail = (t: AdminTransactionView) => {
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  render(
    <TransactionDetail transaction={t} onEdit={onEdit} onDelete={onDelete} />,
  )
  return { onEdit, onDelete }
}

/** Valeur affichée en face d'un libellé de la liste de détail. */
const row = (label: string) => {
  const term = screen.queryByText(label, { selector: "dt" })
  return term?.nextElementSibling ?? null
}

describe("TransactionDetail", () => {
  it("paiement Stripe sans litige : lien « Ouvrir dans Stripe », sans bandeau ni boutons d'édition", () => {
    renderDetail(makeTx())

    const link = screen.getByRole("link", { name: "Ouvrir dans Stripe" })
    expect(link).toHaveAttribute(
      "href",
      "https://dashboard.stripe.com/test/payments/pi_1",
    )
    expect(link).toHaveAttribute("target", "_blank")
    expect(screen.queryByRole("note")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Modifier" }),
    ).not.toBeInTheDocument()
  })

  it("litige ouvert : bandeau et lien « Traiter le litige dans Stripe »", () => {
    renderDetail(makeTx({ disputeStatus: "needs_response" }))

    expect(screen.getByRole("note")).toHaveTextContent("Litige en cours.")
    expect(
      screen.getByRole("link", { name: "Traiter le litige dans Stripe" }),
    ).toBeInTheDocument()
  })

  it("litige clos : ni bandeau, ni lien de traitement", () => {
    renderDetail(makeTx({ disputeStatus: "won" }))

    expect(screen.queryByRole("note")).not.toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Ouvrir dans Stripe" }),
    ).toBeInTheDocument()
  })

  it("paiement Stripe sans lien de tableau de bord : aucune action", () => {
    renderDetail(makeTx({ stripeUrl: null }))

    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("paiement manuel : « Modifier » et « Supprimer » remontent la transaction", () => {
    const t = makeTx({ type: "manual", stripeUrl: null })
    const { onEdit, onDelete } = renderDetail(t)

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }))
    expect(onEdit).toHaveBeenCalledWith(t)
    expect(onDelete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }))
    expect(onDelete).toHaveBeenCalledWith(t)
  })

  it("paiement manuel : auteur inconnu en tiret, aucun courriel au client", () => {
    renderDetail(makeTx({ type: "manual", recordedByName: null }))

    expect(row("Enregistré par")).toHaveTextContent("—")
    expect(row("Courriel au client")).toHaveTextContent("Aucun courriel envoyé")
  })

  it("paiement manuel : auteur et note interne affichés", () => {
    renderDetail(
      makeTx({
        type: "manual",
        recordedByName: "Admin Awa",
        notes: "Virement Interac",
      }),
    )

    expect(row("Enregistré par")).toHaveTextContent("Admin Awa")
    expect(row("Note interne")).toHaveTextContent("Virement Interac")
  })

  it("paiement Stripe abouti : courriel de confirmation envoyé ou non", () => {
    renderDetail(makeTx({ confirmationEmailSentAt: NOW }))
    expect(row("Courriel au client")).toHaveTextContent(
      /^Confirmation envoyée le /,
    )
  })

  it("paiement Stripe abouti sans confirmation : « Non envoyé »", () => {
    renderDetail(makeTx())
    expect(row("Courriel au client")).toHaveTextContent("Non envoyé")
    expect(row("Enregistré par")).toBeNull()
  })

  it("tentative échouée : pas d'expiration, paiement non abouti, pas de ligne courriel", () => {
    renderDetail(makeTx({ status: "failed", completedAt: null }))

    expect(row("Expiration de l'accès")).toBeNull()
    expect(row("Complétée le")).toHaveTextContent("Paiement non abouti")
    expect(row("Courriel au client")).toBeNull()
  })

  it("remboursement : date de remboursement et expiration affichées", () => {
    renderDetail(makeTx({ status: "refunded", refundedAt: NOW }))

    expect(row("Remboursée le")).not.toBeNull()
    expect(row("Expiration de l'accès")).not.toBeNull()
  })

  it("sans remboursement ni montant présenté : lignes absentes", () => {
    renderDetail(makeTx())

    expect(row("Remboursée le")).toBeNull()
    expect(row("Montant présenté")).toBeNull()
    expect(row("Note interne")).toBeNull()
  })

  it("Adaptive Pricing : montant présenté et avertissement", () => {
    renderDetail(
      makeTx({ presentmentAmount: 3500, presentmentCurrency: "eur" }),
    )

    const value = row("Montant présenté")
    expect(value).not.toBeNull()
    expect(
      within(value as HTMLElement).getByText(/jamais comptabilisé/),
    ).toBeInTheDocument()
  })

  it("produit disparu : « Produit inconnu »", () => {
    renderDetail(makeTx({ product: null }))
    expect(row("Produit")).toHaveTextContent("Produit inconnu")
  })

  it("identifiant de la transaction en dernière ligne", () => {
    renderDetail(makeTx({ id: "tx-42" }))
    expect(row("Identifiant")).toHaveTextContent("tx-42")
  })
})
