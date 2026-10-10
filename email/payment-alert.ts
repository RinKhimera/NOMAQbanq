import { formatLongDate, formatPresentmentAmount } from "@/lib/format"

/** Le candidat et son achat, quand la transaction est connue en base. */
export type AlertCandidate = {
  name: string
  email: string
  productName: string
  /** `null` : transaction jamais payée (en attente, échouée). */
  paidAt: Date | null
  transactionUrl: string
}

/** Montant tel que Stripe le donne : unités mineures, devise en minuscules. */
export type StripeMoney = { amount: number; currency: string }

/**
 * Accès du candidat, relu après le recalcul qui suit un retour de fonds :
 * retiré ; maintenu par un autre achat encore valide ; déjà expiré avant le
 * retour de fonds (rien à retirer) ; ou, pour un Pack Premium, un seul type
 * encore couvert (`exam_only`, `training_only`). `null` : rien à annoncer
 * (transaction inconnue, ou retour de fonds sans effet sur l'accès).
 */
export type AccessAfterRefund =
  "removed" | "kept" | "expired" | "exam_only" | "training_only" | null

/** Alerte de paiement (`CONTEXT.md`) : un événement Stripe qui demande une décision humaine. */
export type PaymentAlert =
  | {
      kind: "dispute_opened"
      /**
       * Statut Stripe à l'ouverture. `warning_*` = demande de renseignements
       * de la banque : aucun fonds retiré, pas encore un litige.
       */
      status: string
      money: StripeMoney
      dueBy: Date | null
      reason: string
      candidate: AlertCandidate | null
      stripeUrl: string
    }
  | {
      kind: "early_fraud_warning"
      /** L'événement Radar ne porte pas de montant : celui de la transaction, si elle est connue. */
      money: StripeMoney | null
      candidate: AlertCandidate | null
      stripeUrl: string
    }
  | {
      kind: "dispute_closed"
      /** Statut Stripe du litige clos, texte libre : l'énumération peut s'étendre. */
      status: string
      money: StripeMoney
      candidate: AlertCandidate | null
      access: AccessAfterRefund
      /** La transaction était déjà remboursée : aucun fonds n'est récupéré. */
      transactionRefunded: boolean
      stripeUrl: string
    }
  | {
      kind: "refunded"
      money: StripeMoney
      candidate: AlertCandidate | null
      access: AccessAfterRefund
      stripeUrl: string
    }

export type AlertTone = "info" | "warning" | "success" | "danger"

export type PaymentAlertContent = {
  subject: string
  preview: string
  heading: string
  intro: string
  /** Chiffres mis en avant, en tête du courriel. */
  figures: { label: string; value: string }[]
  rows: { label: string; value: string }[]
  notice: { tone: AlertTone; text: string } | null
  advice: string | null
  button: { label: string; href: string }
}

const DISPUTE_REASONS: Record<string, string> = {
  bank_cannot_process: "Traitement impossible par la banque",
  check_returned: "Chèque retourné",
  credit_not_processed: "Remboursement non effectué",
  customer_initiated: "Contestation du client",
  debit_not_authorized: "Prélèvement non autorisé",
  duplicate: "Paiement en double",
  fraudulent: "Paiement frauduleux",
  general: "Motif général",
  incorrect_account_details: "Coordonnées bancaires erronées",
  insufficient_funds: "Fonds insuffisants",
  noncompliant: "Non conforme aux règles du réseau",
  product_not_received: "Produit non reçu",
  product_unacceptable: "Produit non conforme",
  subscription_canceled: "Abonnement annulé",
  unrecognized: "Paiement non reconnu",
}

export const disputeReasonLabel = (reason: string): string =>
  DISPUTE_REASONS[reason] ?? "Autre motif"

/** Issues d'un litige clos où aucun fonds n'est perdu. */
const FAVORABLE_OUTCOMES: Record<string, string> = {
  won: "Gagné",
  warning_closed: "Clos sans litige",
  prevented: "Évité",
}

const money = (m: StripeMoney) => formatPresentmentAmount(m.amount, m.currency)

/** « Objet : montant · Karim Haddad », sans le nom quand le candidat est inconnu. */
const withName = (head: string, candidate: AlertCandidate | null) =>
  candidate ? `${head} · ${candidate.name}` : head

const candidateRows = (
  candidate: AlertCandidate | null,
  amount: string | null,
) => [
  ...(candidate
    ? [
        { label: "Candidat", value: `${candidate.name} (${candidate.email})` },
        { label: "Produit", value: candidate.productName },
      ]
    : []),
  ...(amount ? [{ label: "Montant", value: amount }] : []),
  ...(candidate?.paidAt
    ? [{ label: "Payé le", value: formatLongDate(candidate.paidAt) }]
    : []),
]

const transactionButton = (
  candidate: AlertCandidate | null,
  stripeUrl: string,
) =>
  candidate
    ? { label: "Voir la transaction", href: candidate.transactionUrl }
    : { label: "Ouvrir le paiement dans Stripe", href: stripeUrl }

const ACCESS_NAME = { exam: "Examens", training: "Entraînement" } as const

/** Un accès est effectivement perdu : l'objet du courriel le dit. */
const accessLost = (access: AccessAfterRefund) =>
  access === "removed" || access === "exam_only" || access === "training_only"

/** Retour de fonds (litige perdu, remboursement) : ce que devient l'accès. */
const accessNotice = (
  access: AccessAfterRefund,
  candidate: AlertCandidate | null,
): PaymentAlertContent["notice"] => {
  const who = candidate?.name ?? "le candidat"
  switch (access) {
    case "removed":
      return {
        tone: "danger",
        text: candidate
          ? `L'accès de ${who} a été retiré automatiquement.`
          : "L'accès ouvert par ce paiement a été retiré automatiquement.",
      }
    case "exam_only":
    case "training_only": {
      const kept = access === "exam_only" ? "exam" : "training"
      const lost = kept === "exam" ? "training" : "exam"
      return {
        tone: "danger",
        text: `L'accès ${ACCESS_NAME[lost]} de ${who} a été retiré ; son accès ${ACCESS_NAME[kept]} reste ouvert par un autre achat.`,
      }
    }
    case "kept":
      return {
        tone: "warning",
        text: `Ce paiement ne compte plus, mais ${who} garde un accès ouvert par un autre achat.`,
      }
    case "expired":
      return {
        tone: "info",
        text: "L'accès ouvert par ce paiement avait déjà expiré : rien n'est retiré.",
      }
    default:
      return null
  }
}

/**
 * Litige clos sans perte : ce qui est vrai des fonds et de l'accès, relu en
 * base. Un remboursement antérieur ou un retrait au litige perdu (gagné après
 * coup) ne se rétablit pas seul.
 */
const favorableNotice = (
  alert: Extract<PaymentAlert, { kind: "dispute_closed" }>,
  amount: string,
): NonNullable<PaymentAlertContent["notice"]> => {
  const funds = alert.transactionRefunded
    ? "Le paiement avait déjà été remboursé : aucun montant n'est récupéré."
    : `Le montant de ${amount} vous reste acquis.`
  if (accessLost(alert.access))
    return {
      tone: "warning",
      text: `${funds} L'accès retiré au candidat n'est pas rétabli automatiquement : recréditez-le à la main si besoin.`,
    }
  if (alert.transactionRefunded) return { tone: "warning", text: funds }
  return {
    tone: "success",
    text: `${funds}${alert.access === "kept" ? " L'accès du candidat est maintenu." : ""} Aucune action n'est requise.`,
  }
}

export const paymentAlertContent = (
  alert: PaymentAlert,
): PaymentAlertContent => {
  const { candidate } = alert

  if (alert.kind === "early_fraud_warning") {
    const amount = alert.money ? money(alert.money) : null
    return {
      subject: withName(
        amount
          ? `Alerte de fraude : ${amount}`
          : "Alerte de fraude sur un paiement",
        candidate,
      ),
      preview: "Un remboursement immédiat évite un litige.",
      heading: "Alerte de fraude sur un paiement",
      intro:
        "La banque du titulaire de la carte signale ce paiement comme potentiellement frauduleux. Aucun litige n'est ouvert pour l'instant.",
      figures: [],
      rows: candidateRows(candidate, amount),
      notice: {
        tone: "warning",
        text: "Nous recommandons de rembourser ce paiement dès maintenant : un remboursement avant l'ouverture d'un litige évite les frais de litige et ne pèse pas sur votre compte Stripe.",
      },
      advice: null,
      button: {
        label: "Ouvrir le paiement dans Stripe",
        href: alert.stripeUrl,
      },
    }
  }

  const amount = money(alert.money)
  switch (alert.kind) {
    case "dispute_opened": {
      const due = alert.dueBy ? formatLongDate(alert.dueBy) : null
      const inquiry = alert.status.startsWith("warning_")
      return {
        subject: withName(
          `${inquiry ? "Demande de la banque" : "Litige ouvert"} : ${amount}`,
          candidate,
        ),
        preview: due
          ? `Réponse attendue avant le ${due}.`
          : inquiry
            ? "La banque demande des précisions sur un paiement."
            : "Un paiement est contesté.",
        heading: inquiry
          ? "La banque demande des précisions"
          : "Un paiement est contesté",
        intro: inquiry
          ? "La banque du titulaire de la carte demande des précisions sur ce paiement. Aucun fonds n'est retiré pour l'instant."
          : candidate
            ? `${candidate.name} conteste auprès de sa banque le paiement de son achat ${candidate.productName}.`
            : "Un paiement est contesté auprès de la banque du titulaire de la carte.",
        figures: [
          {
            label: inquiry ? "Montant concerné" : "Montant contesté",
            value: amount,
          },
          ...(due ? [{ label: "Répondre avant le", value: due }] : []),
        ],
        rows: [
          ...(candidate ? candidateRows(candidate, amount) : []),
          {
            label: "Motif de la banque",
            value: disputeReasonLabel(alert.reason),
          },
        ],
        notice: null,
        advice: inquiry
          ? "Répondez dans Stripe avec les preuves d'utilisation (connexions, examens réalisés) avant la date limite : sans réponse, la demande peut devenir un litige."
          : "Répondez dans Stripe avec les preuves d'utilisation (connexions, examens réalisés) avant la date limite. Sans réponse, le litige est perdu.",
        button: { label: "Répondre dans Stripe", href: alert.stripeUrl },
      }
    }

    case "dispute_closed": {
      const favorable = FAVORABLE_OUTCOMES[alert.status]
      if (favorable) {
        const won = alert.status === "won"
        const heading = won
          ? "Litige clos en votre faveur"
          : "Litige clos sans perte de fonds"
        return {
          subject: withName(heading, candidate),
          preview: alert.transactionRefunded
            ? "Le paiement avait déjà été remboursé."
            : "Le montant vous reste acquis.",
          heading,
          intro: won
            ? "La banque a tranché en votre faveur."
            : "Le litige est clos sans que les fonds soient retirés.",
          figures: [],
          rows: [
            ...candidateRows(candidate, amount),
            { label: "Issue", value: favorable },
          ],
          notice: favorableNotice(alert, amount),
          advice: null,
          button: transactionButton(candidate, alert.stripeUrl),
        }
      }
      if (alert.status === "lost") {
        return {
          subject: withName(
            accessLost(alert.access)
              ? "Litige perdu : accès retiré"
              : "Litige perdu",
            candidate,
          ),
          preview: "La banque a tranché en faveur du titulaire de la carte.",
          heading: "Litige clos : perdu",
          intro:
            "La banque a tranché en faveur du titulaire de la carte. Le montant lui est rendu.",
          figures: [],
          rows: [
            ...candidateRows(candidate, amount),
            { label: "Issue", value: "Perdu" },
          ],
          notice: accessNotice(alert.access, candidate),
          advice:
            "Aucune action n'est requise. Vérifiez la transaction si le candidat vous recontacte.",
          button: transactionButton(candidate, alert.stripeUrl),
        }
      }
      return {
        subject: withName("Litige clos", candidate),
        preview: "Un litige est clos.",
        heading: "Litige clos",
        intro: "Stripe signale la clôture d'un litige sur ce paiement.",
        figures: [],
        rows: [
          ...candidateRows(candidate, amount),
          { label: "Issue", value: alert.status },
        ],
        notice: null,
        advice: "Vérifiez l'issue du litige dans Stripe.",
        button: {
          label: "Ouvrir le paiement dans Stripe",
          href: alert.stripeUrl,
        },
      }
    }

    case "refunded":
      return {
        subject: withName(
          accessLost(alert.access)
            ? `Paiement remboursé : accès retiré`
            : `Paiement remboursé : ${amount}`,
          candidate,
        ),
        preview: `Remboursement complet de ${amount}.`,
        heading: "Paiement remboursé en totalité",
        intro: candidate
          ? `Le paiement de ${candidate.name} a été remboursé en totalité dans Stripe.`
          : "Un paiement a été remboursé en totalité dans Stripe.",
        figures: [],
        rows: candidateRows(candidate, amount),
        notice: accessNotice(alert.access, candidate),
        advice:
          "Si ce remboursement était prévu, aucune action n'est requise. Sinon, vérifiez qui l'a effectué dans Stripe.",
        button: transactionButton(candidate, alert.stripeUrl),
      }
  }
}
