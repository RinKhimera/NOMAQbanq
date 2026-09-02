/**
 * Assemble, en LECTURE SEULE, les preuves d'usage d'un client pour répondre à
 * un litige Stripe. Sortie Markdown dont les sections correspondent aux champs
 * de preuve Stripe pour un produit numérique (`customer_name`,
 * `customer_email_address`, `product_description`, `access_activity_log`).
 *
 * Usage :
 *   AUDIT_DATABASE_URL=... [AUDIT_STRIPE_KEY=rk_live_...] bun scripts/dispute-evidence.ts <payment_intent> [--out dossier.md]
 *
 * Env (délibérément DISTINCT des vars runtime) :
 * - AUDIT_DATABASE_URL : branche Neon à lire (idéalement clonée de la prod).
 * - AUDIT_STRIPE_KEY   : optionnelle, clé LIVE restreinte avec les droits de
 *   LECTURE « Disputes » et « Charges » (sinon `more_permissions_required`) ;
 *   ajoute motif, date limite, moyen de paiement, pays et résultat 3DS. Sans
 *   elle, ces lignes sont omises et le journal reste complet.
 *
 * N'importe pas @/db ni lib/stripe (schéma d'env complet requis hors Next).
 */
import { config } from "dotenv"
import { asc, count, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import Stripe from "stripe"
import {
  account,
  examAnswers,
  examParticipations,
  exams,
  products,
  session,
  trainingSessionItems,
  trainingSessions,
  transactions,
  user,
} from "../db/schema"
import { STRIPE_API_VERSION } from "../lib/stripe-api-version"

const LIMIT = 1000

export type EvidenceInput = {
  customer: {
    name: string
    email: string
    emailVerified: boolean
    createdAt: Date
    providers: string[]
  }
  transaction: {
    id: string
    stripePaymentIntentId: string
    productName: string
    amountPaid: number
    currency: string
    presentmentAmount: number | null
    presentmentCurrency: string | null
    completedAt: Date | null
    accessExpiresAt: Date
    confirmationEmailSentAt: Date | null
  }
  sessions: {
    createdAt: Date
    ipAddress: string | null
    userAgent: string | null
  }[]
  participations: {
    examTitle: string
    startedAt: Date | null
    completedAt: Date | null
    status: string
    answerCount: number
    resultsNotifiedAt: Date | null
  }[]
  trainings: {
    startedAt: Date
    completedAt: Date | null
    status: string
    questionCount: number
    answeredCount: number
  }[]
  dispute: {
    id: string
    reason: string
    status: string
    amount: number
    currency: string
    dueBy: Date | null
    paymentMethodType: string
    cardCountry: string | null
    threeDSecure: string
  } | null
}

export type ActivityEvent = { at: Date; kind: string; detail: string }

/** Sous-ensemble de `Stripe.Charge.PaymentMethodDetails` que le dossier lit. */
export type PaymentMethodDetailsLike = {
  type: string
  card?: {
    country?: string | null
    three_d_secure?: {
      result?: string | null
      authentication_flow?: string | null
    } | null
  } | null
  link?: { country?: string | null } | null
} | null

const stamp = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z")

// Format volontairement brut et sans locale (« 200 $ CAD », « 200,50 $ CAD »,
// « 50000 XAF ») : le journal est lu par une banque, pas par un client.
const money = (cents: number, currency: string) => {
  if (currency === "XAF") return `${Math.round(cents / 100)} XAF`
  const amount = cents / 100
  const label = Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2).replace(".", ",")
  return `${label} $ ${currency}`
}

/**
 * Un paiement Link « pur » n'a pas de `card` et ne peut structurellement pas
 * porter de résultat 3DS : dire « non tenté » laisserait croire qu'il aurait
 * pu l'être. Link comme portefeuille d'une carte passe par la branche `card`.
 */
export const describePaymentMethod = (
  details: PaymentMethodDetailsLike,
): {
  paymentMethodType: string
  cardCountry: string | null
  threeDSecure: string
} => {
  if (!details) {
    return {
      paymentMethodType: "inconnu",
      cardCountry: null,
      threeDSecure: "inconnu",
    }
  }
  if (details.card) {
    const tds = details.card.three_d_secure
    return {
      paymentMethodType: details.type,
      cardCountry: details.card.country ?? null,
      threeDSecure: tds
        ? `${tds.result ?? "?"} (${tds.authentication_flow ?? "?"})`
        : "non tenté",
    }
  }
  if (details.link) {
    return {
      paymentMethodType: details.type,
      cardCountry: details.link.country ?? null,
      threeDSecure: "non applicable (Link)",
    }
  }
  return {
    paymentMethodType: details.type,
    cardCountry: null,
    threeDSecure: "inconnu",
  }
}

export const buildActivityEvents = (input: EvidenceInput): ActivityEvent[] => {
  const events: ActivityEvent[] = []
  const c = input.customer
  events.push({
    at: c.createdAt,
    kind: "compte créé",
    detail: `${c.email}${c.emailVerified ? " (courriel vérifié)" : ""}`,
  })
  for (const s of input.sessions) {
    events.push({
      at: s.createdAt,
      kind: "connexion",
      detail: `IP ${s.ipAddress ?? "inconnue"} · ${s.userAgent ?? "user-agent inconnu"}`,
    })
  }
  const t = input.transaction
  if (t.completedAt) {
    events.push({
      at: t.completedAt,
      kind: "achat",
      detail: `${t.productName} · ${money(t.amountPaid, t.currency)}${
        t.presentmentAmount != null && t.presentmentCurrency
          ? ` (présenté ${t.presentmentAmount} ${t.presentmentCurrency})`
          : ""
      } · payment_intent ${t.stripePaymentIntentId} · accès jusqu'au ${stamp(t.accessExpiresAt)}`,
    })
  }
  if (t.confirmationEmailSentAt) {
    events.push({
      at: t.confirmationEmailSentAt,
      kind: "courriel de confirmation envoyé",
      detail: c.email,
    })
  }
  for (const p of input.participations) {
    if (p.startedAt)
      events.push({
        at: p.startedAt,
        kind: "examen commencé",
        detail: p.examTitle,
      })
    if (p.completedAt)
      events.push({
        at: p.completedAt,
        kind: "examen terminé",
        detail: `${p.examTitle} · ${p.answerCount} réponses · statut ${p.status}`,
      })
    if (p.resultsNotifiedAt)
      events.push({
        at: p.resultsNotifiedAt,
        kind: "courriel de résultats envoyé",
        detail: p.examTitle,
      })
  }
  for (const tr of input.trainings) {
    events.push({
      at: tr.startedAt,
      kind: "entraînement commencé",
      detail: `${tr.questionCount} questions`,
    })
    if (tr.completedAt)
      events.push({
        at: tr.completedAt,
        kind: "entraînement terminé",
        detail: `${tr.answeredCount}/${tr.questionCount} réponses · statut ${tr.status}`,
      })
  }
  return events.sort((a, b) => a.at.getTime() - b.at.getTime())
}

export const formatActivityLog = (events: ActivityEvent[]): string =>
  events.map((e) => `${stamp(e.at)} · ${e.kind} · ${e.detail}`).join("\n")

export const buildEvidenceMarkdown = (input: EvidenceInput): string => {
  const { customer, transaction, dispute } = input
  const sections = [
    `# Preuves — litige sur ${transaction.stripePaymentIntentId}`,
    `## customer_name\n\n${customer.name}`,
    `## customer_email_address\n\n${customer.email}${customer.emailVerified ? " (vérifié)" : ""}\n\nConnexion : ${customer.providers.join(", ") || "inconnue"}`,
    `## product_description\n\nAccès en ligne « ${transaction.productName} » à la plateforme NOMAQbanq (préparation à l'EACMC Partie I) : banque de questions, examens blancs et suivi de progression, livré immédiatement après paiement, valide jusqu'au ${stamp(transaction.accessExpiresAt)}.`,
    `## access_activity_log\n\n\`\`\`\n${formatActivityLog(buildActivityEvents(input))}\n\`\`\``,
  ]
  if (dispute) {
    sections.push(
      `## Contexte du litige\n\n- Litige : ${dispute.id}\n- Motif : ${dispute.reason}\n- Statut : ${dispute.status}\n- Montant : ${dispute.amount} ${dispute.currency}\n- Date limite de réponse : ${dispute.dueBy ? stamp(dispute.dueBy) : "inconnue"}\n- Moyen de paiement : ${dispute.paymentMethodType}\n- Pays de la carte : ${dispute.cardCountry ?? "inconnu"}\n- 3D Secure : ${dispute.threeDSecure}`,
    )
  }
  return sections.join("\n\n") + "\n"
}

const flagValue = (flag: string): string | null => {
  const i = process.argv.indexOf(flag)
  return i === -1 ? null : (process.argv[i + 1] ?? null)
}

const main = async (): Promise<number> => {
  config({ path: ".env.local" })
  config()

  const paymentIntentId = process.argv[2]
  const dbUrl = process.env.AUDIT_DATABASE_URL
  const stripeKey = process.env.AUDIT_STRIPE_KEY
  if (!paymentIntentId || !paymentIntentId.startsWith("pi_") || !dbUrl) {
    console.error(
      "Usage : AUDIT_DATABASE_URL=... [AUDIT_STRIPE_KEY=rk_live_...] bun scripts/dispute-evidence.ts <pi_...> [--out fichier.md]",
    )
    return 2
  }
  if (stripeKey && !/^(rk|sk)_live_/.test(stripeKey)) {
    console.error(
      "AUDIT_STRIPE_KEY doit être une clé live (rk_live_/sk_live_).",
    )
    return 2
  }
  console.error(
    `Cible : db=${new URL(dbUrl).hostname} · stripe=${stripeKey ? "oui" : "non"} (lecture seule)`,
  )

  const pool = new Pool({ connectionString: dbUrl, max: 2 })
  const db = drizzle(pool)
  try {
    const [tx] = await db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        productName: products.name,
        amountPaid: transactions.amountPaid,
        currency: transactions.currency,
        presentmentAmount: transactions.presentmentAmount,
        presentmentCurrency: transactions.presentmentCurrency,
        completedAt: transactions.completedAt,
        accessExpiresAt: transactions.accessExpiresAt,
        confirmationEmailSentAt: transactions.confirmationEmailSentAt,
      })
      .from(transactions)
      .leftJoin(products, eq(products.id, transactions.productId))
      .where(eq(transactions.stripePaymentIntentId, paymentIntentId))
      .limit(1)
    if (!tx) {
      console.error(`Aucune transaction pour ${paymentIntentId}.`)
      return 1
    }

    const [customer] = await db
      .select({
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, tx.userId))
      .limit(1)
    const providers = await db
      .select({ providerId: account.providerId })
      .from(account)
      .where(eq(account.userId, tx.userId))
      .orderBy(asc(account.createdAt))
      .limit(LIMIT)
    const sessions = await db
      .select({
        createdAt: session.createdAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      })
      .from(session)
      .where(eq(session.userId, tx.userId))
      .orderBy(asc(session.createdAt))
      .limit(LIMIT)
    // Jointure + groupBy par clé primaire plutôt qu'une sous-requête `.as()` :
    // Drizzle déqualifie les colonnes d'une sous-requête mono-table et casse
    // la corrélation. `count(col)` ignore déjà les NULL (questions non répondues).
    const participations = await db
      .select({
        examTitle: exams.title,
        startedAt: examParticipations.startedAt,
        completedAt: examParticipations.completedAt,
        status: examParticipations.status,
        resultsNotifiedAt: examParticipations.resultsNotifiedAt,
        answerCount: count(examAnswers.selectedAnswer),
      })
      .from(examParticipations)
      .innerJoin(exams, eq(exams.id, examParticipations.examId))
      .leftJoin(
        examAnswers,
        eq(examAnswers.participationId, examParticipations.id),
      )
      .where(eq(examParticipations.userId, tx.userId))
      .groupBy(examParticipations.id, exams.title)
      .orderBy(asc(examParticipations.startedAt))
      .limit(LIMIT)
    const trainings = await db
      .select({
        startedAt: trainingSessions.startedAt,
        completedAt: trainingSessions.completedAt,
        status: trainingSessions.status,
        questionCount: trainingSessions.questionCount,
        answeredCount: count(trainingSessionItems.selectedAnswer),
      })
      .from(trainingSessions)
      .leftJoin(
        trainingSessionItems,
        eq(trainingSessionItems.sessionId, trainingSessions.id),
      )
      .where(eq(trainingSessions.userId, tx.userId))
      .groupBy(trainingSessions.id)
      .orderBy(asc(trainingSessions.startedAt))
      .limit(LIMIT)

    let dispute: EvidenceInput["dispute"] = null
    if (stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION })
      const disputes = await stripe.disputes.list({
        payment_intent: paymentIntentId,
        limit: 1,
      })
      const d = disputes.data[0]
      if (d) {
        const chargeId = typeof d.charge === "string" ? d.charge : d.charge.id
        const charge = await stripe.charges.retrieve(chargeId)
        dispute = {
          id: d.id,
          reason: d.reason,
          status: d.status,
          amount: d.amount,
          currency: d.currency,
          dueBy: d.evidence_details.due_by
            ? new Date(d.evidence_details.due_by * 1000)
            : null,
          ...describePaymentMethod(charge.payment_method_details),
        }
      }
    }

    const markdown = buildEvidenceMarkdown({
      customer: {
        name: customer.name,
        email: customer.email,
        emailVerified: customer.emailVerified,
        createdAt: customer.createdAt,
        providers: providers.map((p) => p.providerId),
      },
      transaction: {
        id: tx.id,
        stripePaymentIntentId: paymentIntentId,
        productName: tx.productName ?? "Accès NOMAQbanq",
        amountPaid: tx.amountPaid,
        currency: tx.currency,
        presentmentAmount: tx.presentmentAmount,
        presentmentCurrency: tx.presentmentCurrency,
        completedAt: tx.completedAt,
        accessExpiresAt: tx.accessExpiresAt,
        confirmationEmailSentAt: tx.confirmationEmailSentAt,
      },
      sessions,
      participations,
      trainings,
      dispute,
    })

    const out = flagValue("--out")
    if (out) {
      const { writeFileSync } = await import("node:fs")
      writeFileSync(out, markdown)
      console.error(`Preuves écrites dans ${out}`)
    } else {
      process.stdout.write(markdown)
    }
    return 0
  } finally {
    await pool.end()
  }
}

const isDirectRun = process.argv[1]?.endsWith("dispute-evidence.ts") ?? false
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error("Assemblage interrompu :", error)
      process.exit(1)
    })
}
