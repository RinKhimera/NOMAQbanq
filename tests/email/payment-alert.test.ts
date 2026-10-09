import { describe, expect, it } from "vitest"
import {
  type AlertCandidate,
  type PaymentAlert,
  disputeReasonLabel,
  paymentAlertContent,
} from "@/email/payment-alert"

const candidate: AlertCandidate = {
  name: "Karim Haddad",
  email: "karim@test.invalid",
  productName: "Accès Examens",
  paidAt: new Date("2026-09-14T16:00:00Z"),
  transactionUrl: "https://nomaqbanq.ca/admin/transactions?client=u1&tx=t1",
}
const cad = { amount: 20000, currency: "cad" }
const stripeUrl = "https://dashboard.stripe.com/payments/pi_1"

const closed = (
  status: string,
  access: "removed" | "kept" | null = null,
): PaymentAlert => ({
  kind: "dispute_closed",
  status,
  money: cad,
  candidate,
  access,
  stripeUrl,
})

describe("contenu d'une alerte de paiement", () => {
  it("litige ouvert : montant, date limite et motif traduit", () => {
    const content = paymentAlertContent({
      kind: "dispute_opened",
      status: "needs_response",
      money: cad,
      dueBy: new Date("2026-10-23T12:00:00Z"),
      reason: "product_not_received",
      candidate,
      stripeUrl,
    })

    expect(content.subject).toBe("Litige ouvert : 200,00 $ · Karim Haddad")
    expect(content.figures).toEqual([
      { label: "Montant contesté", value: "200,00 $" },
      { label: "Répondre avant le", value: "23 octobre 2026" },
    ])
    expect(content.rows).toContainEqual({
      label: "Motif de la banque",
      value: "Produit non reçu",
    })
    expect(content.button).toEqual({
      label: "Répondre dans Stripe",
      href: stripeUrl,
    })
  })

  it("litige ouvert sans date limite ni transaction connue", () => {
    const content = paymentAlertContent({
      kind: "dispute_opened",
      status: "needs_response",
      money: cad,
      dueBy: null,
      reason: "fraudulent",
      candidate: null,
      stripeUrl,
    })

    expect(content.subject).toBe("Litige ouvert : 200,00 $")
    expect(content.figures).toEqual([
      { label: "Montant contesté", value: "200,00 $" },
    ])
    expect(content.rows).toEqual([
      { label: "Motif de la banque", value: "Paiement frauduleux" },
    ])
  })

  it("une demande de renseignements n'est pas présentée comme un litige", () => {
    const content = paymentAlertContent({
      kind: "dispute_opened",
      status: "warning_needs_response",
      money: cad,
      dueBy: new Date("2026-10-23T12:00:00Z"),
      reason: "general",
      candidate,
      stripeUrl,
    })

    expect(content.subject).toBe(
      "Demande de la banque : 200,00 $ · Karim Haddad",
    )
    expect(content.heading).toBe("La banque demande des précisions")
    expect(content.figures[0]).toEqual({
      label: "Montant concerné",
      value: "200,00 $",
    })
    expect(JSON.stringify(content)).not.toMatch(/contest|litige est perdu/)
  })

  it("un montant en XAF s'affiche en francs entiers", () => {
    const content = paymentAlertContent({
      kind: "early_fraud_warning",
      money: { amount: 85000, currency: "xaf" },
      candidate,
      stripeUrl,
    })

    expect(content.subject).toBe("Alerte de fraude : 85 000 XAF · Karim Haddad")
    expect(content.button.label).toBe("Ouvrir le paiement dans Stripe")
  })

  it.each([
    ["won", "Litige clos en votre faveur", "Gagné"],
    ["warning_closed", "Litige clos sans perte de fonds", "Clos sans litige"],
    ["prevented", "Litige clos sans perte de fonds", "Évité"],
  ])(
    "litige clos %s : aucun fonds perdu, accès maintenu",
    (status, heading, issue) => {
      const content = paymentAlertContent(closed(status))

      expect(content.heading).toBe(heading)
      expect(content.notice?.tone).toBe("success")
      expect(content.rows).toContainEqual({ label: "Issue", value: issue })
      expect(content.button).toEqual({
        label: "Voir la transaction",
        href: candidate.transactionUrl,
      })
    },
  )

  it("litige perdu : l'accès retiré est annoncé", () => {
    const content = paymentAlertContent(closed("lost", "removed"))

    expect(content.subject).toBe("Litige perdu : accès retiré · Karim Haddad")
    expect(content.notice).toEqual({
      tone: "danger",
      text: "L'accès de Karim Haddad a été retiré automatiquement.",
    })
  })

  it("litige perdu : un autre achat maintient l'accès, rien n'est affirmé à tort", () => {
    const content = paymentAlertContent(closed("lost", "kept"))

    expect(content.subject).toBe("Litige perdu · Karim Haddad")
    expect(content.notice?.tone).toBe("warning")
    expect(content.notice?.text).toContain("un autre achat")
    expect(JSON.stringify(content)).not.toContain("retiré")
  })

  it("remboursement complet sans transaction connue : lien vers Stripe", () => {
    const content = paymentAlertContent({
      kind: "refunded",
      money: cad,
      candidate: null,
      access: null,
      stripeUrl,
    })

    expect(content.subject).toBe("Paiement remboursé : 200,00 $")
    expect(content.notice).toBeNull()
    expect(content.button).toEqual({
      label: "Ouvrir le paiement dans Stripe",
      href: stripeUrl,
    })
  })

  it("un motif de litige inconnu reçoit un libellé générique", () => {
    expect(disputeReasonLabel("nouveau_motif_stripe")).toBe("Autre motif")
  })
})
