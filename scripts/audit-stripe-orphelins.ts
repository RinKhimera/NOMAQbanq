/**
 * Audit LECTURE SEULE des paiements encaissés sans accès accordé (WH-10).
 * Filet pour les événements que le webhook n'a jamais traités : Stripe abandonne
 * après ~3 jours de tentatives, et une transaction reste alors `pending` pour
 * toujours — payée, sans accès, sans que rien dans l'application ne le signale.
 *
 * AUCUNE écriture : selects + GET Stripe. Ne corrige rien, ne rejoue rien.
 *
 * Usage :
 *   AUDIT_DATABASE_URL=... AUDIT_STRIPE_KEY=... bun scripts/audit-stripe-orphelins.ts
 *   ... -- --hours 6        # fenêtre de tolérance (défaut 24 h)
 *   ... -- --json rapport.json
 *
 * Env requis (distinct des vars runtime : un audit ne doit jamais se lancer par
 * accident sur la paire base/clé de l'environnement courant) :
 * - AUDIT_DATABASE_URL : branche Neon à lire.
 * - AUDIT_STRIPE_KEY   : clé de LECTURE du MÊME mode que cette base. Contrairement
 *   à `audit:stripe` (historique live uniquement), test et live sont acceptés ici :
 *   le défaut guetté existe dans les deux mondes. Le mode lu est affiché, et une
 *   incohérence base/clé est détectée explicitement (verdict `MODE_MISMATCH`).
 *
 * N'importe pas @/db ni lib/stripe (schéma d'env complet requis hors Next).
 *
 * Sorties : 0 aucun orphelin · 1 orphelins trouvés · 2 audit non concluant.
 */
import { config } from "dotenv"
import { and, eq, gt, isNotNull, lt } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import Stripe from "stripe"
import { transactions } from "../db/schema"
import { STRIPE_API_VERSION } from "../lib/stripe-api-version"

const BATCH = 200 // lecture DB bornée (keyset sur id)
const STRIPE_CONCURRENCY = 5
const DEFAULT_HOURS = 24 // au-delà, un `pending` n'est plus un paiement en cours

type Db = ReturnType<typeof drizzle>

type Row = {
  id: string
  userId: string
  stripeSessionId: string | null
  amountPaid: number
  currency: string
  createdAt: Date
}

export type Verdict =
  /** Payé côté Stripe, jamais octroyé côté app : l'événement s'est perdu. */
  | "ORPHELIN"
  /** Paiement différé encore en cours (virement non arrivé) : normal. */
  | "EN_ATTENTE"
  /** Session expirée sans paiement : normal, le `pending` est juste resté. */
  | "ABANDONNE"
  /** Session absente de ce mode : la clé et la base ne se correspondent pas. */
  | "MODE_MISMATCH"

type Finding = {
  transactionId: string
  userId: string
  sessionId: string
  createdAt: string
  verdict: Verdict
  sessionStatus: string | null
  paymentStatus: string | null
  amountTotal: number | null
  currency: string | null
}

/**
 * Verdict d'une session dont la transaction est restée `pending`.
 * Même règle que le fulfillment : `complete` ne veut pas dire payé, c'est
 * `payment_status` qui tranche (une promo 100 % vaut `no_payment_required`).
 * Un paiement constaté ici est donc un paiement encaissé que le webhook n'a
 * jamais converti en accès.
 */
export const classify = (
  session: Pick<Stripe.Checkout.Session, "status" | "payment_status">,
): Exclude<Verdict, "MODE_MISMATCH"> => {
  const paid =
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required"
  if (paid) return "ORPHELIN"
  return session.status === "expired" ? "ABANDONNE" : "EN_ATTENTE"
}

export const isResourceMissing = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === "resource_missing"

const mapLimit = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> => {
  const out: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      for (;;) {
        const i = next++
        if (i >= items.length) return
        out[i] = await fn(items[i]!)
      }
    })(),
  )
  await Promise.all(workers)
  return out
}

const fetchStalePending = async (db: Db, cutoff: Date): Promise<Row[]> => {
  const rows: Row[] = []
  let cursor = ""
  for (;;) {
    const batch = await db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        stripeSessionId: transactions.stripeSessionId,
        amountPaid: transactions.amountPaid,
        currency: transactions.currency,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, "stripe"),
          eq(transactions.status, "pending"),
          isNotNull(transactions.stripeSessionId),
          lt(transactions.createdAt, cutoff),
          gt(transactions.id, cursor),
        ),
      )
      .orderBy(transactions.id)
      .limit(BATCH)
    rows.push(...batch)
    if (batch.length < BATCH) return rows
    cursor = batch[batch.length - 1]!.id
  }
}

const auditRow = async (stripe: Stripe, row: Row): Promise<Finding> => {
  const sessionId = row.stripeSessionId as string
  const base = {
    transactionId: row.id,
    userId: row.userId,
    sessionId,
    createdAt: row.createdAt.toISOString(),
  }
  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch (error) {
    if (isResourceMissing(error)) {
      return {
        ...base,
        verdict: "MODE_MISMATCH",
        sessionStatus: null,
        paymentStatus: null,
        amountTotal: null,
        currency: null,
      }
    }
    throw error
  }

  return {
    ...base,
    verdict: classify(session),
    sessionStatus: session.status,
    paymentStatus: session.payment_status,
    amountTotal: session.amount_total,
    currency: session.currency,
  }
}

const arg = (flag: string): string | null => {
  const i = process.argv.indexOf(flag)
  return i === -1 ? null : (process.argv[i + 1] ?? null)
}

const main = async (): Promise<number> => {
  config({ path: ".env.local" })
  config()

  const hours = Number(arg("--hours") ?? DEFAULT_HOURS)
  const jsonOut = process.argv.includes("--json")
    ? (arg("--json") ?? "stripe-orphelins.json")
    : null

  const dbUrl = process.env.AUDIT_DATABASE_URL
  const stripeKey = process.env.AUDIT_STRIPE_KEY
  if (!dbUrl || !stripeKey) {
    console.error(
      "Env manquant : AUDIT_DATABASE_URL (branche Neon lue) et AUDIT_STRIPE_KEY (clé lecture, même mode que la base).",
    )
    return 1
  }
  if (!Number.isFinite(hours) || hours < 0) {
    console.error("--hours doit être un nombre positif.")
    return 1
  }

  const keyMode = /^(rk|sk)_live_/.test(stripeKey) ? "LIVE" : "test"
  console.log(
    `Cible : db=${new URL(dbUrl).hostname} · stripe=${stripeKey.slice(0, 8)}…${stripeKey.slice(-4)} (mode ${keyMode}, lecture seule) · fenêtre ${hours} h`,
  )

  const pool = new Pool({ connectionString: dbUrl, max: 3 })
  const db = drizzle(pool)
  const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION })

  try {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    const rows = await fetchStalePending(db, cutoff)
    console.log(
      `${rows.length} transaction(s) Stripe restée(s) « pending » avant ${cutoff.toISOString()}.`,
    )
    if (rows.length === 0) {
      console.log("Rien à auditer.")
      return 0
    }

    const findings = await mapLimit(rows, STRIPE_CONCURRENCY, (row) =>
      auditRow(stripe, row),
    )
    const by = (v: Verdict) => findings.filter((f) => f.verdict === v)
    const orphelins = by("ORPHELIN")
    const mismatch = by("MODE_MISMATCH")

    // Toutes les sessions introuvables = la clé n'est pas du mode de la base
    // (KEY-04). Le dire explicitement évite de lire « 0 orphelin » comme un
    // satisfecit alors que l'audit n'a rien pu vérifier.
    if (mismatch.length === findings.length) {
      console.error(
        `\n⚠ Aucune des ${findings.length} sessions n'existe en mode ${keyMode} : la clé et la base ne correspondent pas. Audit non concluant.`,
      )
      return 2
    }

    console.log(
      `\nOrphelins ${orphelins.length} · en attente ${by("EN_ATTENTE").length} · abandonnés ${by("ABANDONNE").length} · introuvables ${mismatch.length}`,
    )
    for (const f of orphelins) {
      console.log(
        `  ORPHELIN  tx=${f.transactionId} user=${f.userId} session=${f.sessionId} ${f.amountTotal} ${f.currency} créée le ${f.createdAt} (payment_status=${f.paymentStatus})`,
      )
    }
    if (mismatch.length > 0) {
      console.log(
        `  ${mismatch.length} session(s) introuvable(s) en mode ${keyMode} — vérifier qu'elles ne viennent pas de l'autre mode.`,
      )
    }

    if (jsonOut) {
      const { writeFileSync } = await import("node:fs")
      writeFileSync(jsonOut, JSON.stringify(findings, null, 2))
      console.log(`\nRapport détaillé : ${jsonOut}`)
    }

    if (orphelins.length > 0) {
      console.log(
        "\nCes paiements sont encaissés sans accès. Rejouer l'événement depuis le tableau de bord Stripe (Resend) est le geste le plus sûr : il repasse par le webhook, donc par le chemin idempotent habituel.",
      )
    }
    return orphelins.length > 0 ? 1 : 0
  } finally {
    await pool.end()
  }
}

const isDirectRun =
  process.argv[1]?.endsWith("audit-stripe-orphelins.ts") ?? false
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error("Audit interrompu :", error)
      process.exit(1)
    })
}
