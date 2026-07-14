/**
 * Audit LECTURE SEULE des transactions Stripe historiques (#81, épic #76).
 * Compare `amountPaid`/`currency` en base avec `amount_total`/`currency` des
 * sessions Checkout réelles (codes promo + Adaptive Pricing XAF jamais
 * réconciliés avant le fix #79). AUCUNE écriture : selects + GET Stripe.
 *
 * Usage :
 *   AUDIT_DATABASE_URL=... STRIPE_AUDIT_KEY=rk_live_... bun scripts/audit-stripe-transactions.ts
 *   ... -- --json rapport.json   # dump JSON détaillé en plus du rapport console
 *
 * Env requis (délibérément DISTINCT des vars runtime, pour qu'un `.env.local`
 * dev ne soit jamais audité contre le Stripe live par accident) :
 * - AUDIT_DATABASE_URL : branche Neon lecture (idéalement clonée de la prod).
 * - STRIPE_AUDIT_KEY   : clé live à permissions lecture (Checkout Sessions).
 *
 * N'importe pas @/db ni lib/stripe (schéma d'env complet requis hors Next) :
 * pool pg et client Stripe locaux.
 */
import { config } from "dotenv"
import { and, eq, gt, isNotNull } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import Stripe from "stripe"
import { transactions } from "../db/schema"

config({ path: ".env.local" })
config()

// Parité avec lib/stripe.ts (non importable ici).
const STRIPE_API_VERSION = "2026-06-24.dahlia" as const

const BATCH = 200 // lecture DB bornée (keyset sur id)
const STRIPE_CONCURRENCY = 5

const jsonFlag = process.argv.indexOf("--json")
const JSON_OUT =
  jsonFlag === -1 ? null : (process.argv[jsonFlag + 1] ?? "stripe-audit.json")

const dbUrl = process.env.AUDIT_DATABASE_URL
const stripeKey = process.env.STRIPE_AUDIT_KEY
if (!dbUrl || !stripeKey) {
  console.error(
    "Env manquant : AUDIT_DATABASE_URL (branche Neon lue) et STRIPE_AUDIT_KEY (clé live lecture).",
  )
  process.exit(1)
}
if (!/^(rk|sk)_live_/.test(stripeKey)) {
  console.error(
    "STRIPE_AUDIT_KEY n'est pas une clé live (rk_live_/sk_live_) : les sessions historiques sont en mode live.",
  )
  process.exit(1)
}

console.log(
  `Cible : db=${new URL(dbUrl).hostname} · stripe=${stripeKey.slice(0, 8)}…${stripeKey.slice(-4)} (lecture seule)`,
)

const pool = new Pool({ connectionString: dbUrl, max: 3 })
const db = drizzle(pool)
const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION })

type Row = {
  id: string
  stripeSessionId: string | null
  amountPaid: number
  currency: "CAD" | "XAF"
  createdAt: Date
  completedAt: Date | null
}

type Finding = {
  transactionId: string
  sessionId: string
  createdAt: string
  db: { amountPaid: number; currency: string }
  stripe: { amountTotal: number | null; currency: string | null }
  expected: { amountPaid: number; currency: string } | null
  kind:
    | "montant"
    | "devise"
    | "montant+devise"
    | "devise_hors_enum"
    | "inexploitable"
    | "session_introuvable"
}

/** Valeur attendue en base (centièmes) depuis la session Stripe — même règle
 * que le fulfillment : XAF zéro-décimal chez Stripe → ×100 en base. Contrairement
 * au fulfillment (qui conserve le provisoire), une devise réelle hors enum n'est
 * PAS ignorée ici : l'audit doit la remonter, c'est précisément une divergence. */
const expectedFromSession = (
  amountTotal: number | null,
  currency: string | null,
): { amountPaid: number; currency: string } | null => {
  if (amountTotal == null || currency == null) return null
  const upper = currency.toUpperCase()
  if (upper !== "CAD" && upper !== "XAF") return null
  return {
    amountPaid: upper === "XAF" ? amountTotal * 100 : amountTotal,
    currency: upper,
  }
}

const fetchAllCompleted = async (): Promise<Row[]> => {
  const rows: Row[] = []
  let cursor = ""
  for (;;) {
    const batch = await db
      .select({
        id: transactions.id,
        stripeSessionId: transactions.stripeSessionId,
        amountPaid: transactions.amountPaid,
        currency: transactions.currency,
        createdAt: transactions.createdAt,
        completedAt: transactions.completedAt,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, "stripe"),
          eq(transactions.status, "completed"),
          isNotNull(transactions.stripeSessionId),
          gt(transactions.id, cursor),
        ),
      )
      .orderBy(transactions.id)
      .limit(BATCH)
    rows.push(...batch)
    if (batch.length < BATCH) return rows
    cursor = batch[batch.length - 1].id
  }
}

const auditRow = async (row: Row): Promise<Finding | null> => {
  const sessionId = row.stripeSessionId as string
  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch (error) {
    if (
      error instanceof Stripe.errors.StripeError &&
      error.code === "resource_missing"
    ) {
      return {
        transactionId: row.id,
        sessionId,
        createdAt: row.createdAt.toISOString(),
        db: { amountPaid: row.amountPaid, currency: row.currency },
        stripe: { amountTotal: null, currency: null },
        expected: null,
        kind: "session_introuvable",
      }
    }
    throw error
  }

  const expected = expectedFromSession(session.amount_total, session.currency)
  if (!expected) {
    const realCurrencyOutsideEnum =
      session.amount_total != null &&
      session.currency != null &&
      !["cad", "xaf"].includes(session.currency.toLowerCase())
    return {
      transactionId: row.id,
      sessionId,
      createdAt: row.createdAt.toISOString(),
      db: { amountPaid: row.amountPaid, currency: row.currency },
      stripe: { amountTotal: session.amount_total, currency: session.currency },
      expected: null,
      kind: realCurrencyOutsideEnum ? "devise_hors_enum" : "inexploitable",
    }
  }

  const amountDiff = expected.amountPaid !== row.amountPaid
  const currencyDiff = expected.currency !== row.currency
  if (!amountDiff && !currencyDiff) return null

  return {
    transactionId: row.id,
    sessionId,
    createdAt: row.createdAt.toISOString(),
    db: { amountPaid: row.amountPaid, currency: row.currency },
    stripe: { amountTotal: session.amount_total, currency: session.currency },
    expected,
    kind:
      amountDiff && currencyDiff
        ? "montant+devise"
        : amountDiff
          ? "montant"
          : "devise",
  }
}

const main = async () => {
  const rows = await fetchAllCompleted()
  console.log(`${rows.length} transaction(s) Stripe completed à auditer.`)

  const findings: Finding[] = []
  let done = 0
  for (let i = 0; i < rows.length; i += STRIPE_CONCURRENCY) {
    const chunk = rows.slice(i, i + STRIPE_CONCURRENCY)
    const results = await Promise.all(chunk.map(auditRow))
    findings.push(...results.filter((f): f is Finding => f !== null))
    done += chunk.length
    if (done % 100 === 0 || done === rows.length)
      console.log(`  … ${done}/${rows.length}`)
  }

  const divergent = findings.filter((f) => f.kind !== "session_introuvable")
  const missing = findings.filter((f) => f.kind === "session_introuvable")

  // Deux sommes par devise plutôt qu'un « écart » net : une divergence
  // cross-devise (DB CAD vs réel XAF) n'a pas de soustraction qui ait un sens.
  const dbSide: Record<string, number> = {}
  const realSide: Record<string, number> = {}
  for (const f of divergent) {
    dbSide[f.db.currency] = (dbSide[f.db.currency] ?? 0) + f.db.amountPaid
    if (f.expected)
      realSide[f.expected.currency] =
        (realSide[f.expected.currency] ?? 0) + f.expected.amountPaid
  }

  console.log("\n=== Rapport d'audit (#81) ===")
  console.log(`Transactions auditées : ${rows.length}`)
  console.log(`Divergentes           : ${divergent.length}`)
  console.log(`Sessions introuvables : ${missing.length}`)
  for (const cur of new Set([
    ...Object.keys(dbSide),
    ...Object.keys(realSide),
  ])) {
    console.log(
      `Lignes divergentes en ${cur} : DB ${((dbSide[cur] ?? 0) / 100).toFixed(2)} · réel ${((realSide[cur] ?? 0) / 100).toFixed(2)}`,
    )
  }
  for (const f of [...divergent, ...missing]) {
    console.log(
      `- ${f.transactionId} · ${f.sessionId} · ${f.kind} · DB ${f.db.amountPaid} ${f.db.currency}` +
        (f.expected
          ? ` → réel ${f.expected.amountPaid} ${f.expected.currency}`
          : "") +
        ` · créée ${f.createdAt.slice(0, 10)}`,
    )
  }
  if (divergent.length === 0 && missing.length === 0) {
    console.log("Aucune divergence : l'historique est fidèle. ✅")
  }

  if (JSON_OUT) {
    const { writeFileSync } = await import("node:fs")
    writeFileSync(
      JSON_OUT,
      JSON.stringify({ audited: rows.length, findings }, null, 2),
    )
    console.log(`\nDétail JSON : ${JSON_OUT}`)
  }

  await pool.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
