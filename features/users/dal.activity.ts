import { and, desc, eq, isNull, sql } from "drizzle-orm"
import { cache } from "react"
import "server-only"
import { db } from "@/db"
import {
  exams,
  products,
  questions,
  transactions,
  user,
  userBans,
} from "@/db/schema"
import { requireRole } from "@/lib/auth-guards"

const FEED_LIMIT = 10
/** Début de l'énoncé affiché pour une clé confirmée. */
const QUESTION_EXCERPT = 120

export type AdminActivityItem = {
  kind:
    | "manual_payment"
    | "exam_created"
    | "key_confirmed"
    | "suspension"
    | "suspension_lifted"
  at: Date
  label: string
  /** Transaction, examen, question, ou compte suspendu selon `kind`. */
  id: string
  /** Paiement manuel : le client dont le dossier s'ouvre. */
  clientId?: string
}

export type AdminActivity = {
  manualPayments: {
    count: number
    /** Montants en unités mineures, une entrée par devise utilisée. */
    totals: { currency: "CAD" | "XAF"; amount: number }[]
    lastAt: Date | null
  }
  exams: { count: number; openOrUpcoming: number }
  /** Confirmations encore en place : une modification de la question les efface. */
  confirmedKeys: number
  suspensions: { pronounced: number; active: number; lifted: number }
  feed: AdminActivityItem[]
}

/**
 * [Admin] Activité de l'administrateur connecté (`CONTEXT.md`) : ce qu'il a
 * fait lui-même et que la base lui attribue, depuis toujours. Comptes en SQL
 * agrégé ; le fil fusionne les 10 dernières lignes de chaque source.
 */
export const getMyAdminActivity = cache(async (): Promise<AdminActivity> => {
  const session = await requireRole(["admin"])
  const me = session.user.id

  const [paymentTotals, counts, payments, createdExams, keys, bans, lifts] =
    await Promise.all([
      db
        .select({
          currency: transactions.currency,
          count: sql<number>`count(*)::int`,
          // Encaissé seulement : un paiement manuel remboursé compte comme
          // enregistré, pas dans le total. bigint : une somme en centièmes de
          // XAF dépasse vite l'int4.
          amount:
            sql<number>`coalesce(sum(${transactions.amountPaid}) filter (where ${transactions.status} = 'completed'), 0)`.mapWith(
              Number,
            ),
          lastAt: sql<Date>`max(${transactions.createdAt})`.mapWith(
            transactions.createdAt,
          ),
        })
        .from(transactions)
        .where(manualBy(me))
        .groupBy(transactions.currency)
        .orderBy(transactions.currency),
      // Six compteurs en une requête plutôt que six : moins d'attente sur le
      // pool (cinq connexions) que partagent les lectures de cette page.
      db.execute<{
        exams: number
        open_or_upcoming: number
        confirmed_keys: number
        pronounced: number
        active: number
        lifted: number
      }>(sql`
      select
        (select count(*)::int from exams where created_by = ${me}) as exams,
        (select count(*)::int from exams
          where created_by = ${me}
            and finalized_at is not null and end_date > now()) as open_or_upcoming,
        (select count(*)::int from questions
          where key_confirmed_by = ${me} and deleted_at is null) as confirmed_keys,
        (select count(*)::int from user_bans where banned_by = ${me}) as pronounced,
        (select count(*)::int from user_bans
          where banned_by = ${me} and lifted_at is null) as active,
        (select count(*)::int from user_bans where lifted_by = ${me}) as lifted
    `),
      db
        .select({
          id: transactions.id,
          clientId: transactions.userId,
          clientName: user.name,
          productName: products.name,
          at: transactions.createdAt,
        })
        .from(transactions)
        .innerJoin(user, eq(user.id, transactions.userId))
        .innerJoin(products, eq(products.id, transactions.productId))
        .where(manualBy(me))
        .orderBy(desc(transactions.createdAt))
        .limit(FEED_LIMIT),
      db
        .select({ id: exams.id, label: exams.title, at: exams.createdAt })
        .from(exams)
        .where(eq(exams.createdBy, me))
        .orderBy(desc(exams.createdAt))
        .limit(FEED_LIMIT),
      db
        .select({
          id: questions.id,
          // Un caractère de plus que l'extrait : de quoi savoir s'il est coupé.
          label: sql<string>`left(${questions.question}, ${QUESTION_EXCERPT + 1})`,
          at: questions.keyConfirmedAt,
        })
        .from(questions)
        .where(
          and(eq(questions.keyConfirmedBy, me), isNull(questions.deletedAt)),
        )
        .orderBy(desc(questions.keyConfirmedAt))
        .limit(FEED_LIMIT),
      db
        .select({
          id: userBans.userId,
          label: user.name,
          at: userBans.bannedAt,
        })
        .from(userBans)
        .innerJoin(user, eq(user.id, userBans.userId))
        .where(eq(userBans.bannedBy, me))
        .orderBy(desc(userBans.bannedAt))
        .limit(FEED_LIMIT),
      db
        .select({
          id: userBans.userId,
          label: user.name,
          at: userBans.liftedAt,
        })
        .from(userBans)
        .innerJoin(user, eq(user.id, userBans.userId))
        .where(eq(userBans.liftedBy, me))
        .orderBy(desc(userBans.liftedAt))
        .limit(FEED_LIMIT),
    ])

  // Une ligne exactement : un select sans FROM.
  const c = counts.rows[0]!

  const dated = <T extends { at: Date | null }>(rows: T[]) =>
    rows.filter((r): r is T & { at: Date } => r.at !== null)

  const feed: AdminActivityItem[] = [
    ...payments.map((p) => ({
      kind: "manual_payment" as const,
      at: p.at,
      label: `${p.clientName} · ${p.productName}`,
      id: p.id,
      clientId: p.clientId,
    })),
    ...createdExams.map((e) => ({ kind: "exam_created" as const, ...e })),
    ...dated(keys).map((k) => ({
      kind: "key_confirmed" as const,
      ...k,
      label:
        k.label.length > QUESTION_EXCERPT
          ? `${k.label.slice(0, QUESTION_EXCERPT).trimEnd()}…`
          : k.label,
    })),
    ...bans.map((b) => ({ kind: "suspension" as const, ...b })),
    ...dated(lifts).map((l) => ({ kind: "suspension_lifted" as const, ...l })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, FEED_LIMIT)

  return {
    manualPayments: {
      count: paymentTotals.reduce((n, t) => n + t.count, 0),
      totals: paymentTotals
        .filter((t) => t.amount > 0)
        .map((t) => ({ currency: t.currency, amount: t.amount })),
      lastAt: paymentTotals.reduce<Date | null>(
        (last, t) => (last === null || t.lastAt > last ? t.lastAt : last),
        null,
      ),
    },
    exams: { count: c.exams, openOrUpcoming: c.open_or_upcoming },
    confirmedKeys: c.confirmed_keys,
    suspensions: {
      pronounced: c.pronounced,
      active: c.active,
      lifted: c.lifted,
    },
    feed,
  }
})

const manualBy = (adminId: string) =>
  and(eq(transactions.type, "manual"), eq(transactions.recordedBy, adminId))
