import { and, asc, desc, eq, gt, gte, lt, ne, or, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { cache } from "react"
import "server-only"
import { type Db, db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
import {
  APP_TIME_ZONE,
  shiftCalendarDay,
  startOfAppZoneDay,
  toAppZoneCalendarDay,
} from "@/lib/app-zone"
import { requireRole, requireSession } from "@/lib/auth-guards"
import { getCurrentSession } from "@/lib/dal"
import { env } from "@/lib/env/server"
import { type AccessType, planRebuild } from "./access-ledger"
import { TERMINAL_DISPUTE_STATUSES, isOpenDispute } from "./dispute"
import {
  CLIENT_PAGE_SIZE,
  MY_TRANSACTIONS_PAGE_SIZE,
  TIMELINE_FIRST,
  TIMELINE_MORE,
} from "./page-sizes"

const DAY_MS = 24 * 60 * 60 * 1000

// Échappe les métacaractères LIKE (%, _, \) : la saisie est cherchée telle quelle.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&")

export type AccessInfo = { expiresAt: number; daysRemaining: number } | null
export type AccessStatus = {
  examAccess: AccessInfo
  trainingAccess: AccessInfo
}

const toAccessInfo = (
  expiresAt: Date | null | undefined,
  now: number,
): AccessInfo => {
  if (!expiresAt) return null
  const ms = expiresAt.getTime()
  if (ms <= now) return null
  return { expiresAt: ms, daysRemaining: Math.ceil((ms - now) / DAY_MS) }
}

/**
 * Statut d'accès complet (exam + training). `userId` optionnel → défaut = session ;
 * celui d'un autre utilisateur exige le rôle admin. `null` si non connecté.
 * Borné par la contrainte UNIQUE(user_id, access_type) → au plus 2 lignes.
 */
export const getAccessStatus = cache(
  async (userId?: string): Promise<AccessStatus | null> => {
    const session = await getCurrentSession()
    const targetId = userId ?? session?.user.id
    if (!targetId) return null
    if (targetId !== session?.user.id) await requireRole(["admin"])

    const rows = await db
      .select({
        accessType: userAccess.accessType,
        expiresAt: userAccess.expiresAt,
      })
      .from(userAccess)
      .where(eq(userAccess.userId, targetId))

    const now = Date.now()
    return {
      examAccess: toAccessInfo(
        rows.find((r) => r.accessType === "exam")?.expiresAt,
        now,
      ),
      trainingAccess: toAccessInfo(
        rows.find((r) => r.accessType === "training")?.expiresAt,
        now,
      ),
    }
  },
)

export type LapsedAccess = {
  /** Échéance passée de l'accès Examens (epoch ms) ; `null` = actif ou jamais eu. */
  exam: number | null
  training: number | null
}

/**
 * Accès échus de l'utilisateur courant, pour « Votre accès a expiré le … ».
 * Au plus 2 lignes (UNIQUE(user_id, access_type)).
 */
export const getMyLapsedAccess = cache(async (): Promise<LapsedAccess> => {
  const session = await getCurrentSession()
  if (!session?.user) return { exam: null, training: null }
  const rows = await db
    .select({
      accessType: userAccess.accessType,
      expiresAt: userAccess.expiresAt,
    })
    .from(userAccess)
    .where(
      and(
        eq(userAccess.userId, session.user.id),
        lt(userAccess.expiresAt, new Date()),
      ),
    )
  const lapsed = (type: AccessType) =>
    rows.find((r) => r.accessType === type)?.expiresAt.getTime() ?? null
  return { exam: lapsed("exam"), training: lapsed("training") }
})

/**
 * Entitlement RÉEL d'une cible à l'instant `now`, lu par l'exécuteur donné
 * (`db` ou la transaction en cours : une garde d'écriture ne doit jamais
 * emprunter une 2ᵉ connexion du pool). Aucun bypass de rôle : c'est ce que la
 * cible a acheté. Borne exclusive : à l'échéance exacte, l'accès est clos.
 */
export const hasActiveAccess = async (
  exec: Pick<Db, "select">,
  {
    userId,
    type,
    now,
  }: { userId: string; type: "exam" | "training"; now: number },
): Promise<boolean> => {
  const [row] = await exec
    .select({ expiresAt: userAccess.expiresAt })
    .from(userAccess)
    .where(and(eq(userAccess.userId, userId), eq(userAccess.accessType, type)))
    .limit(1)

  return Boolean(row) && row.expiresAt.getTime() > now
}

/**
 * Gating d'accès pour le type donné.
 * - **Sans `userId`** (cas par défaut) : garde l'utilisateur **courant** (session).
 *   Les admins bypassent (ils accèdent à tout).
 * - **Avec `userId`** : interroge l'entitlement RÉEL de cette cible précise — **pas**
 *   de bypass sur le rôle de la cible (sinon `hasAccess("exam", adminId)` mentirait
 *   sur ce qu'a réellement acheté la cible). L'autorisation de consulter une cible
 *   arbitraire relève de l'appelant (page admin `requireRole`).
 */
export const hasAccess = async (
  type: "exam" | "training",
  userId?: string,
): Promise<boolean> => {
  let targetId = userId
  if (!targetId) {
    const session = await getCurrentSession()
    if (!session?.user) return false
    if (session.user.role === "admin") return true
    targetId = session.user.id
  }

  return hasActiveAccess(db, { userId: targetId, type, now: Date.now() })
}

// ============================================
// Produits disponibles
// ============================================

export type ProductView = {
  id: string
  code: (typeof products.code.enumValues)[number]
  name: string
  description: string
  /** En cents. Casse `priceCAD` conservée pour l'UI existante. */
  priceCAD: number
  durationDays: number
  accessType: "exam" | "training"
  isCombo: boolean
}

/**
 * Produits actifs disponibles à l'achat. Remplace `getAvailableProducts`.
 * Mappe `priceCad` → `priceCAD` (nom attendu par l'UI). Borné : ordre stable,
 * peu de produits. `cache()` pour dédupliquer par render.
 */
export const getAvailableProducts = cache(async (): Promise<ProductView[]> => {
  const rows = await db
    .select({
      id: products.id,
      code: products.code,
      name: products.name,
      description: products.description,
      priceCAD: products.priceCad,
      durationDays: products.durationDays,
      accessType: products.accessType,
      isCombo: products.isCombo,
    })
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(asc(products.priceCad), asc(products.id))
    .limit(50)

  return rows
})

// ============================================
// Historique des transactions (pagination keyset)
// ============================================

export type MyTransactionView = {
  id: string
  type: "stripe" | "manual"
  status: (typeof transactions.status.enumValues)[number]
  /** En cents. */
  amountPaid: number
  currency: "CAD" | "XAF"
  accessType: "exam" | "training"
  durationDays: number
  /** Epoch ms. */
  accessExpiresAt: number
  /** Epoch ms. */
  createdAt: number
  /** Epoch ms ou null tant que non complétée. */
  completedAt: number | null
  paymentMethod: string | null
  product: { id: string; code: string; name: string } | null
}

export type MyTransactionsPage = {
  items: MyTransactionView[]
  /** Rang (base 0) de la première ligne dans tout l'historique. */
  firstIndex: number
  /** Curseurs opaques des pages voisines ; `null` au bord de la liste. */
  prevCursor: string | null
  nextCursor: string | null
}

// Curseur keyset = base64("<createdAtISO>|<id>"). On encode l'ISO de la date
// (précision ms, stable) + l'id pour départager les égalités de createdAt.
const encodeCursor = (createdAt: Date, id: string): string =>
  Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString("base64")

const decodeCursor = (
  cursor: string,
): { createdAt: Date; id: string } | null => {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8")
    const sep = decoded.indexOf("|")
    if (sep === -1) return null
    const iso = decoded.slice(0, sep)
    const id = decoded.slice(sep + 1)
    const createdAt = new Date(iso)
    if (!id || Number.isNaN(createdAt.getTime())) return null
    return { createdAt, id }
  } catch {
    return null
  }
}

/**
 * Historique des transactions de l'utilisateur courant, les plus récentes
 * d'abord (`createdAt DESC, id DESC`), checkouts en attente masqués. Jointure
 * produit en une requête (pas de N+1).
 *
 * Pagination keyset dans les deux sens : `after` reçoit le curseur du bas de
 * la page courante (page suivante), `before` celui de son haut (page
 * précédente, lue à rebours puis remise dans l'ordre). Le rang de la première
 * ligne et le total viennent d'un agrégat sur le même filtre : « lignes 11–20 »
 * sans offset. Dates en epoch ms.
 */
export const getMyTransactions = async ({
  after,
  before,
  limit = MY_TRANSACTIONS_PAGE_SIZE,
}: {
  after?: string | null
  before?: string | null
  limit?: number
} = {}): Promise<MyTransactionsPage> => {
  const session = await requireSession()
  const userId = session.user.id

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100)
  const afterKey = after ? decodeCursor(after) : null
  const beforeKey = before && !afterKey ? decodeCursor(before) : null
  const key = sql`(${transactions.createdAt}, ${transactions.id})`
  const mine = and(
    eq(transactions.userId, userId),
    ne(transactions.status, "pending"),
  )

  const rows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      status: transactions.status,
      amountPaid: transactions.amountPaid,
      currency: transactions.currency,
      accessType: transactions.accessType,
      durationDays: transactions.durationDays,
      accessExpiresAt: transactions.accessExpiresAt,
      createdAt: transactions.createdAt,
      completedAt: transactions.completedAt,
      paymentMethod: transactions.paymentMethod,
      productId: products.id,
      productCode: products.code,
      productName: products.name,
    })
    .from(transactions)
    .leftJoin(products, eq(products.id, transactions.productId))
    .where(
      and(
        mine,
        afterKey
          ? sql`${key} < (${afterKey.createdAt}, ${afterKey.id})`
          : undefined,
        beforeKey
          ? sql`${key} > (${beforeKey.createdAt}, ${beforeKey.id})`
          : undefined,
      ),
    )
    .orderBy(
      ...(beforeKey
        ? [asc(transactions.createdAt), asc(transactions.id)]
        : [desc(transactions.createdAt), desc(transactions.id)]),
    )
    .limit(safeLimit)
  if (beforeKey) rows.reverse()

  const first = rows[0]
  const last = rows.at(-1)
  const [position] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      newer: first
        ? sql<number>`count(*) filter (where ${key} > (${first.createdAt}, ${first.id}))`.mapWith(
            Number,
          )
        : sql<number>`0`.mapWith(Number),
    })
    .from(transactions)
    .where(mine)
  const firstIndex = position?.newer ?? 0
  const total = position?.total ?? 0

  const items: MyTransactionView[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    amountPaid: r.amountPaid,
    currency: r.currency,
    accessType: r.accessType,
    durationDays: r.durationDays,
    accessExpiresAt: r.accessExpiresAt.getTime(),
    createdAt: r.createdAt.getTime(),
    completedAt: r.completedAt ? r.completedAt.getTime() : null,
    paymentMethod: r.paymentMethod,
    product: r.productId
      ? { id: r.productId, code: r.productCode!, name: r.productName! }
      : null,
  }))

  return {
    items,
    firstIndex,
    prevCursor:
      first && firstIndex > 0 ? encodeCursor(first.createdAt, first.id) : null,
    nextCursor:
      last && firstIndex + rows.length < total
        ? encodeCursor(last.createdAt, last.id)
        : null,
  }
}

// ============================================
// [Admin] Transactions d'un client (pagination keyset)
// ============================================

type TxStatus = (typeof transactions.status.enumValues)[number]

export type AdminTransactionView = {
  id: string
  type: "stripe" | "manual"
  status: TxStatus
  /** En cents. */
  amountPaid: number
  currency: "CAD" | "XAF"
  /** Unité mineure de `presentmentCurrency` ; nul hors Adaptive Pricing. */
  presentmentAmount: number | null
  presentmentCurrency: string | null
  accessType: "exam" | "training"
  /** Un produit combo couvre Examens ET Entraînement. */
  isCombo: boolean
  durationDays: number
  /** Epoch ms : snapshot du cumul posé à l'octroi. */
  accessExpiresAt: number
  /** Epoch ms. */
  createdAt: number
  /** Epoch ms ou null tant que non complétée. */
  completedAt: number | null
  refundedAt: number | null
  paymentMethod: string | null
  notes: string | null
  /** Nom de l'admin qui a saisi un paiement manuel. */
  recordedByName: string | null
  confirmationEmailSentAt: number | null
  /** Statut Stripe brut du litige courant, null sans litige. */
  disputeStatus: string | null
  stripePaymentIntentId: string | null
  stripeSessionId: string | null
  stripeDisputeId: string | null
  /** Lien vers le Dashboard Stripe, dans le mode de la clé active. */
  stripeUrl: string | null
  product: { id: string; code: string; name: string } | null
  user: { id: string; name: string; email: string }
}

export type AdminTransactionsPage = {
  items: AdminTransactionView[]
  nextCursor: string | null
}

// Préfixe `/test/` du Dashboard : la clé active dit dans quel mode vivent les
// identifiants `pi_…` / `dp_…`, que leur préfixe n'encode pas.
const stripeDashboardBase = () =>
  /^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY ?? "")
    ? "https://dashboard.stripe.com/test"
    : "https://dashboard.stripe.com"

/**
 * Page du Dashboard qui porte l'action : le litige s'il est ouvert, sinon le
 * paiement, sinon (tentative sans PaymentIntent) une recherche de la session.
 */
export const stripeDashboardUrl = (t: {
  type: "stripe" | "manual"
  disputeStatus: string | null
  stripeDisputeId: string | null
  stripePaymentIntentId: string | null
  stripeSessionId: string | null
}): string | null => {
  if (t.type !== "stripe") return null
  const base = stripeDashboardBase()
  if (t.stripeDisputeId && isOpenDispute(t.disputeStatus))
    return `${base}/disputes/${t.stripeDisputeId}`
  if (t.stripePaymentIntentId)
    return `${base}/payments/${t.stripePaymentIntentId}`
  if (t.stripeSessionId)
    return `${base}/search?query=${encodeURIComponent(t.stripeSessionId)}`
  return null
}

const recorder = alias(user, "recorder")

const adminTransactionColumns = {
  id: transactions.id,
  type: transactions.type,
  status: transactions.status,
  amountPaid: transactions.amountPaid,
  currency: transactions.currency,
  presentmentAmount: transactions.presentmentAmount,
  presentmentCurrency: transactions.presentmentCurrency,
  accessType: transactions.accessType,
  durationDays: transactions.durationDays,
  accessExpiresAt: transactions.accessExpiresAt,
  createdAt: transactions.createdAt,
  completedAt: transactions.completedAt,
  refundedAt: transactions.refundedAt,
  paymentMethod: transactions.paymentMethod,
  notes: transactions.notes,
  recordedByName: recorder.name,
  confirmationEmailSentAt: transactions.confirmationEmailSentAt,
  disputeStatus: transactions.disputeStatus,
  stripePaymentIntentId: transactions.stripePaymentIntentId,
  stripeSessionId: transactions.stripeSessionId,
  stripeDisputeId: transactions.stripeDisputeId,
  productId: products.id,
  productCode: products.code,
  productName: products.name,
  isCombo: products.isCombo,
  buyerId: user.id,
  buyerName: user.name,
  buyerEmail: user.email,
}

/**
 * [Admin] Transactions, les plus récentes d'abord, d'un client ou de tous.
 * Pagination keyset (même curseur `(createdAt, id)` que `getMyTransactions`).
 * Jointures acheteur, produit et admin saisissant en une requête (pas de N+1).
 * Garde admin (le layout garde déjà, mais le DAL ne fait jamais confiance à
 * l'appelant).
 */
// Plafond de la chronologie chargée d'un coup pour atteindre une transaction
// liée (`?tx=`) : un dossier compte quelques dizaines de lignes au plus.
const TIMELINE_MAX = 500

export const getAllTransactions = async ({
  cursor,
  limit = 20,
  userId,
}: {
  cursor?: string | null
  limit?: number
  userId?: string
} = {}): Promise<AdminTransactionsPage> => {
  await requireRole(["admin"])

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), TIMELINE_MAX)
  const decoded = cursor ? decodeCursor(cursor) : null
  const afterCursor = decoded
    ? or(
        lt(transactions.createdAt, decoded.createdAt),
        and(
          eq(transactions.createdAt, decoded.createdAt),
          lt(transactions.id, decoded.id),
        ),
      )
    : undefined

  const rows = await db
    .select(adminTransactionColumns)
    .from(transactions)
    // userId est NOT NULL + FK restrict → l'acheteur existe toujours (innerJoin sûr).
    .innerJoin(user, eq(user.id, transactions.userId))
    .leftJoin(products, eq(products.id, transactions.productId))
    .leftJoin(recorder, eq(recorder.id, transactions.recordedBy))
    .where(
      and(userId ? eq(transactions.userId, userId) : undefined, afterCursor),
    )
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(safeLimit + 1)

  const hasMore = rows.length > safeLimit
  const pageRows = hasMore ? rows.slice(0, safeLimit) : rows

  const items: AdminTransactionView[] = pageRows.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    amountPaid: r.amountPaid,
    currency: r.currency,
    presentmentAmount: r.presentmentAmount,
    presentmentCurrency: r.presentmentCurrency,
    accessType: r.accessType,
    isCombo: r.isCombo ?? false,
    durationDays: r.durationDays,
    accessExpiresAt: r.accessExpiresAt.getTime(),
    createdAt: r.createdAt.getTime(),
    completedAt: r.completedAt?.getTime() ?? null,
    refundedAt: r.refundedAt?.getTime() ?? null,
    paymentMethod: r.paymentMethod,
    notes: r.notes,
    recordedByName: r.recordedByName,
    confirmationEmailSentAt: r.confirmationEmailSentAt?.getTime() ?? null,
    disputeStatus: r.disputeStatus,
    stripePaymentIntentId: r.stripePaymentIntentId,
    stripeSessionId: r.stripeSessionId,
    stripeDisputeId: r.stripeDisputeId,
    stripeUrl: stripeDashboardUrl(r),
    product: r.productId
      ? { id: r.productId, code: r.productCode!, name: r.productName! }
      : null,
    user: { id: r.buyerId, name: r.buyerName, email: r.buyerEmail },
  }))

  const last = pageRows.at(-1)
  const nextCursor =
    hasMore && last ? encodeCursor(last.createdAt, last.id) : null

  return { items, nextCursor }
}

// ============================================
// [Admin] Clients des transactions (liste groupée par client)
// ============================================

export type ClientFilter = "all" | "failed" | "dispute" | "manual"

export type TransactionClientRow = {
  userId: string
  name: string
  email: string
  image: string | null
  /** Epoch ms : création de sa transaction la plus récente. */
  lastActivityAt: number
  transactionCount: number
  lastStatus: TxStatus
  /** Au moins un litige encore ouvert. */
  openDispute: boolean
}

export type TransactionClientsPage = {
  items: TransactionClientRow[]
  /** Clients qui répondent à la recherche et au filtre. */
  total: number
  /** Rang (base 0) du premier client de la tranche dans `total`. */
  firstIndex: number
  prevCursor: string | null
  nextCursor: string | null
  /** Effectif de chaque filtre sur l'ensemble des clients, sans la recherche. */
  counts: { failed: number; dispute: number; manual: number }
}

const openDisputeSql = sql`(t.dispute_status is not null and t.dispute_status not in (${sql.join(
  TERMINAL_DISPUTE_STATUSES.map((s) => sql`${s}`),
  sql`, `,
)}))`

// Instant de ce qui est arrivé à une transaction : remboursement, sinon
// aboutissement, sinon création. Un paiement abouti après une tentative créée
// plus tard est bien le dernier événement du client.
const eventAtSql = sql`coalesce(t.refunded_at, t.completed_at, t.created_at)`

// Un client = un acheteur ayant au moins une transaction. Sa transaction au
// dernier événement (`distinct on`) donne le statut affiché et le filtre
// Échec ; le reste est agrégé en une passe. La dernière ACTIVITÉ (tri,
// curseur) reste la dernière création.
const clientsCte = sql`
  clients as (
    select a.user_id, a.last_at, a.n, a.open_dispute, a.has_dispute,
           a.has_manual, l.status as last_status,
           u.name, u.email, u.image
      from (
        select t.user_id,
               max(t.created_at) as last_at,
               count(*)::int as n,
               bool_or(${openDisputeSql}) as open_dispute,
               bool_or(t.dispute_status is not null) as has_dispute,
               bool_or(t.type = 'manual') as has_manual
          from transactions t
         group by t.user_id
      ) a
      join (
        select distinct on (t.user_id) t.user_id, t.status
          from transactions t
         order by t.user_id, ${eventAtSql} desc, t.id desc
      ) l on l.user_id = a.user_id
      join "user" u on u.id = a.user_id
  )`

const clientFilterSql = (filter: ClientFilter) => {
  switch (filter) {
    case "failed":
      return sql`c.last_status = 'failed'`
    case "dispute":
      return sql`c.has_dispute`
    case "manual":
      return sql`c.has_manual`
    default:
      return sql`true`
  }
}

type ClientSqlRow = {
  user_id: string
  last_at: Date | string
  n: number
  open_dispute: boolean
  last_status: TxStatus
  name: string
  email: string
  image: string | null
  rn: number
}

const toClientRow = (r: ClientSqlRow): TransactionClientRow => ({
  userId: r.user_id,
  name: r.name,
  email: r.email,
  image: r.image,
  lastActivityAt: new Date(r.last_at).getTime(),
  transactionCount: Number(r.n),
  lastStatus: r.last_status,
  openDispute: r.open_dispute,
})

/**
 * [Admin] Clients des transactions, par dernière activité décroissante puis
 * `user_id`, en tranches de 20. Keyset sur `(dernière activité, user_id)` :
 * `after` / `before` reçoivent le curseur d'un bord de tranche ; `around`
 * place la tranche sur un client (lien direct vers un dossier). Recherche
 * `ilike` sur nom et courriel ; les compteurs des filtres portent sur
 * l'ensemble, sans la recherche. Deux requêtes jointes (tranche, puis total et
 * compteurs) : jamais tout l'historique vers le serveur d'app.
 */
export const getTransactionClients = async ({
  q,
  filter = "all",
  after,
  before,
  around,
  limit = CLIENT_PAGE_SIZE,
}: {
  q?: string
  filter?: ClientFilter
  after?: string | null
  before?: string | null
  around?: string | null
  limit?: number
}): Promise<TransactionClientsPage> => {
  await requireRole(["admin"])

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100)
  const term = q?.trim()
  const pattern = term ? `%${escapeLike(term)}%` : null
  const search = pattern
    ? sql`(c.name ilike ${pattern} or c.email ilike ${pattern})`
    : sql`true`
  const ranked = sql`
    with ${clientsCte},
    ranked as (
      select c.*, row_number() over (order by c.last_at desc, c.user_id desc)::int as rn
        from clients c
       where ${search} and ${clientFilterSql(filter)}
    )`

  const afterKey = after ? decodeCursor(after) : null
  const beforeKey = before ? decodeCursor(before) : null

  let page
  if (afterKey) {
    page = db.execute<ClientSqlRow>(sql`${ranked}
      select * from ranked
       where (last_at, user_id) < (${afterKey.createdAt}, ${afterKey.id})
       order by rn limit ${safeLimit}`)
  } else if (beforeKey) {
    page = db.execute<ClientSqlRow>(sql`${ranked}
      select * from (
        select * from ranked
         where (last_at, user_id) > (${beforeKey.createdAt}, ${beforeKey.id})
         order by rn desc limit ${safeLimit}
      ) p order by rn`)
  } else if (around) {
    page = db.execute<ClientSqlRow>(sql`${ranked},
      anchor as (
        select coalesce(
          (select (rn - 1) / ${safeLimit} * ${safeLimit} from ranked where user_id = ${around}),
          0
        ) as start
      )
      select ranked.* from ranked, anchor
       where rn > anchor.start
       order by rn limit ${safeLimit}`)
  } else {
    page = db.execute<ClientSqlRow>(sql`${ranked}
      select * from ranked order by rn limit ${safeLimit}`)
  }

  const [pageResult, summaryResult] = await Promise.all([
    page,
    db.execute<{
      total: number
      failed: number
      dispute: number
      manual: number
    }>(sql`
      with ${clientsCte}
      select count(*) filter (where ${search} and ${clientFilterSql(filter)})::int as total,
             count(*) filter (where c.last_status = 'failed')::int as failed,
             count(*) filter (where c.has_dispute)::int as dispute,
             count(*) filter (where c.has_manual)::int as manual
        from clients c`),
  ])

  const rows = pageResult.rows
  const summary = summaryResult.rows[0]
  const total = Number(summary?.total ?? 0)
  const first = rows[0]
  const last = rows.at(-1)
  const cursorOf = (r: ClientSqlRow) =>
    encodeCursor(new Date(r.last_at), r.user_id)

  return {
    items: rows.map(toClientRow),
    total,
    firstIndex: first ? Number(first.rn) - 1 : 0,
    prevCursor: first && Number(first.rn) > 1 ? cursorOf(first) : null,
    nextCursor: last && Number(last.rn) < total ? cursorOf(last) : null,
    counts: {
      failed: Number(summary?.failed ?? 0),
      dispute: Number(summary?.dispute ?? 0),
      manual: Number(summary?.manual ?? 0),
    },
  }
}

/**
 * [Admin] Clients dont la dernière transaction a échoué : le compteur de
 * l'alerte du tableau de bord, qui mène au filtre Échec de la même définition.
 */
export const getFailedClientsCount = async (): Promise<number> => {
  await requireRole(["admin"])
  const res = await db.execute<{ n: number }>(sql`
    with ${clientsCte}
    select count(*) filter (where c.last_status = 'failed')::int as n
      from clients c`)
  return Number(res.rows[0]?.n ?? 0)
}

// ============================================
// [Admin] Dossier d'un client
// ============================================

export type ClientVerdict =
  | { kind: "dispute" }
  | {
      kind: "failed"
      /** Échecs consécutifs depuis la dernière tentative non échouée. */
      failedStreak: number
      lastFailedAt: number
      /** Au moins un paiement d'un montant > 0 abouti (complété ou remboursé depuis). */
      everPaid: boolean
    }
  | { kind: "refunded"; refundedAt: number }
  | { kind: "completed"; completedAt: number; manual: boolean }
  | { kind: "pending"; createdAt: number }

export type TransactionClientFile = {
  client: {
    id: string
    name: string
    email: string
    image: string | null
    /** Compte supprimé ou anonymisé : plus aucun octroi possible. */
    deleted: boolean
  }
  /** Epoch ms de `user_access.expires_at`, passé compris ; null = aucune ligne. */
  access: { exam: number | null; training: number | null }
  /** Sans ligne d'accès mais avec un paiement remboursé : accès retiré, pas « jamais acheté ». */
  refunded: { exam: boolean; training: boolean }
  verdict: ClientVerdict
  transactionCount: number
  timeline: AdminTransactionsPage
}

type FileSqlRow = {
  name: string
  email: string
  image: string | null
  deleted: boolean
  refunded_exam: boolean
  refunded_training: boolean
  n: number
  open_dispute: boolean
  ever_paid: boolean
  last_status: TxStatus
  last_type: "stripe" | "manual"
  last_created: Date | string
  last_completed: Date | string | null
  last_refunded: Date | string | null
  failed_streak: number
  through_rank: number | null
}

const toMs = (d: Date | string | null): number | null =>
  d ? new Date(d).getTime() : null

const verdictOf = (s: FileSqlRow): ClientVerdict => {
  const created = toMs(s.last_created)!
  if (s.open_dispute) return { kind: "dispute" }
  switch (s.last_status) {
    case "failed":
      return {
        kind: "failed",
        failedStreak: Number(s.failed_streak),
        lastFailedAt: created,
        everPaid: s.ever_paid,
      }
    case "refunded":
      return { kind: "refunded", refundedAt: toMs(s.last_refunded) ?? created }
    case "completed":
      return {
        kind: "completed",
        completedAt: toMs(s.last_completed) ?? created,
        manual: s.last_type === "manual",
      }
    default:
      return { kind: "pending", createdAt: created }
  }
}

/**
 * [Admin] Dossier d'un client : identité, accès actuels lus dans `user_access`
 * (la source de l'octroi, jamais recalculés depuis les transactions), constat
 * et début de chronologie. `throughTransactionId` étend la chronologie jusqu'à
 * cette transaction (lien direct `?tx=`), par pas de 20 au-delà des 8
 * premières. `null` si le compte n'a aucune transaction.
 */
export const getTransactionClientFile = async (
  userId: string,
  { throughTransactionId }: { throughTransactionId?: string | null } = {},
): Promise<TransactionClientFile | null> => {
  await requireRole(["admin"])

  const [summaryResult, accessRows] = await Promise.all([
    db.execute<FileSqlRow>(sql`
      with mine as (
        select t.*, p.is_combo,
               row_number() over (order by t.created_at desc, t.id desc)::int as rn,
               row_number() over (order by ${eventAtSql} desc, t.id desc)::int as ev
          from transactions t
          left join products p on p.id = t.product_id
         where t.user_id = ${userId}
      )
      select u.name, u.email, u.image, u.deleted_at is not null as deleted,
             (select count(*)::int from mine) as n,
             (select coalesce(bool_or(${openDisputeSql}), false) from mine t) as open_dispute,
             (select coalesce(bool_or(t.status in ('completed', 'refunded') and t.amount_paid > 0), false) from mine t) as ever_paid,
             (select coalesce(bool_or(t.status = 'refunded' and (t.access_type = 'exam' or t.is_combo)), false) from mine t) as refunded_exam,
             (select coalesce(bool_or(t.status = 'refunded' and (t.access_type = 'training' or t.is_combo)), false) from mine t) as refunded_training,
             l.status as last_status, l.type as last_type,
             l.created_at as last_created, l.completed_at as last_completed,
             l.refunded_at as last_refunded,
             (select count(*)::int from mine f
               where f.status = 'failed'
                 and f.ev < coalesce((select min(o.ev) from mine o where o.status <> 'failed'), 2147483647)
             ) as failed_streak,
             (select m.rn from mine m where m.id = ${throughTransactionId ?? ""}) as through_rank
        from "user" u
        join mine l on l.ev = 1
       where u.id = ${userId}`),
    db
      .select({
        accessType: userAccess.accessType,
        expiresAt: userAccess.expiresAt,
      })
      .from(userAccess)
      .where(eq(userAccess.userId, userId)),
  ])

  const s = summaryResult.rows[0]
  if (!s) return null

  const rank = s.through_rank === null ? 0 : Number(s.through_rank)
  const timelineSize =
    rank > TIMELINE_FIRST
      ? TIMELINE_FIRST +
        Math.ceil((rank - TIMELINE_FIRST) / TIMELINE_MORE) * TIMELINE_MORE
      : TIMELINE_FIRST
  const timeline = await getAllTransactions({
    userId,
    limit: Math.min(timelineSize, TIMELINE_MAX),
  })

  const expiry = (type: AccessType) =>
    accessRows.find((r) => r.accessType === type)?.expiresAt.getTime() ?? null

  return {
    client: {
      id: userId,
      name: s.name,
      email: s.email,
      image: s.image,
      deleted: s.deleted,
    },
    access: { exam: expiry("exam"), training: expiry("training") },
    refunded: { exam: s.refunded_exam, training: s.refunded_training },
    verdict: verdictOf(s),
    transactionCount: Number(s.n),
    timeline,
  }
}

// ============================================
// [Admin] Statistiques transactions (dashboard)
// ============================================

export type TransactionStatsView = {
  revenueByCurrency: {
    CAD: { total: number; recent: number }
    XAF: { total: number; recent: number }
  }
  /** Comptes avec au moins une transaction complétée d'un montant > 0. */
  buyerCount: number
  /** Toutes les transactions, tous statuts. */
  transactionCount: number
}

/**
 * [Admin] Revenus + compteurs sur les transactions complétées via
 * une agrégation SQL `GROUP BY currency` avec `FILTER` pour la fenêtre 30 jours :
 * O(1) lignes ramenées, calcul côté Postgres. Un accès offert (montant nul)
 * compte comme transaction mais ne fait pas un acheteur.
 */
export const getTransactionStats = async (): Promise<TransactionStatsView> => {
  await requireRole(["admin"])

  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS)

  const [rows, [overall]] = await Promise.all([
    db
      .select({
        currency: transactions.currency,
        total:
          sql<number>`coalesce(sum(${transactions.amountPaid}), 0)`.mapWith(
            Number,
          ),
        recent:
          sql<number>`coalesce(sum(${transactions.amountPaid}) filter (where ${transactions.completedAt} > ${thirtyDaysAgo}), 0)`.mapWith(
            Number,
          ),
      })
      .from(transactions)
      .where(eq(transactions.status, "completed"))
      .groupBy(transactions.currency),
    db
      .select({
        buyers:
          sql<number>`count(distinct ${transactions.userId}) filter (where ${transactions.status} = 'completed' and ${transactions.amountPaid} > 0)`.mapWith(
            Number,
          ),
        all: sql<number>`count(*)`.mapWith(Number),
      })
      .from(transactions),
  ])

  const revenueByCurrency = {
    CAD: { total: 0, recent: 0 },
    XAF: { total: 0, recent: 0 },
  }
  for (const r of rows) {
    revenueByCurrency[r.currency] = { total: r.total, recent: r.recent }
  }

  return {
    revenueByCurrency,
    buyerCount: overall?.buyers ?? 0,
    transactionCount: overall?.all ?? 0,
  }
}

// ============================================
// [Admin] Impact d'accès d'une transaction (avant remboursement/suppression)
// ============================================

export type AccessImpact = {
  accessType: AccessType
  /** true si retirer cette transaction SUPPRIME ou RACCOURCIT cet accès. */
  willAffectAccess: boolean
  /** Epoch ms ou null. */
  currentAccessExpiresAt: number | null
  /**
   * Échéance après retrait de cette transaction, recalculée depuis les
   * transactions restantes (epoch ms) — null si l'accès disparaît.
   */
  restoredExpiresAt: number | null
}

/**
 * [Admin] Ce que la suppression ou le remboursement de cette transaction fera
 * à chaque type d'accès : le plan de reconstruction, lu sans écrire, en
 * excluant la transaction. Renvoie `null` si la transaction n'existe pas
 * (l'UI traite alors « aucun impact »).
 */
export const getTransactionAccessImpact = async (
  transactionId: string,
): Promise<AccessImpact[] | null> => {
  await requireRole(["admin"])

  const [tx] = await db
    .select({ userId: transactions.userId })
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1)
  if (!tx) return null

  const plans = await planRebuild(db, {
    userId: tx.userId,
    excludeTransactionId: transactionId,
  })
  return plans.map((p) => ({
    accessType: p.accessType,
    willAffectAccess: p.reducedOrRemoved,
    currentAccessExpiresAt: p.existingExpiresAt?.getTime() ?? null,
    restoredExpiresAt: p.best?.accessExpiresAt.getTime() ?? null,
  }))
}

// ============================================
// [Admin] Revenus par jour (graphique dashboard)
// ============================================

export type RevenueByDay = {
  CAD: { date: string; revenue: number }[]
  XAF: { date: string; revenue: number }[]
}

/**
 * [Admin] Revenus quotidiens (transactions complétées) des `days` derniers jours,
 * par devise, chaque jour présent (0 si aucun). Remplace `getRevenueByDay` (qui
 * filtrait 2000 lignes en JS) : agrégation SQL `GROUP BY (jour, devise)` puis
 * remplissage des jours manquants.
 *
 * Jours civils de l'Est, comme les dates affichées dans la table des
 * transactions : un encaissement de 21:00 appartient à sa propre journée, pas
 * à la suivante. La fenêtre part du PREMIER instant du plus ancien jour affiché
 * — sinon sa barre ne compterait qu'une fraction de la journée.
 */
export const getRevenueByDay = async (days = 30): Promise<RevenueByDay> => {
  await requireRole(["admin"])

  const safeDays = Math.min(Math.max(1, Math.floor(days)), 365)
  const today = toAppZoneCalendarDay(Date.now())
  const firstDay = shiftCalendarDay(today, -(safeDays - 1))

  // Le fuseau doit être un littéral SQL, pas un paramètre lié : réémis dans le
  // GROUP BY, un `$n` distinct de celui du SELECT empêche Postgres de
  // reconnaître la même expression (42803, must appear in the GROUP BY clause).
  const zone = sql.raw(`'${APP_TIME_ZONE}'`)
  const dayExpr = sql<string>`to_char(${transactions.completedAt} at time zone ${zone}, 'YYYY-MM-DD')`
  const rows = await db
    .select({
      day: dayExpr,
      currency: transactions.currency,
      revenue:
        sql<number>`coalesce(sum(${transactions.amountPaid}), 0)`.mapWith(
          Number,
        ),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, "completed"),
        gte(transactions.completedAt, startOfAppZoneDay(firstDay)),
      ),
    )
    .groupBy(dayExpr, transactions.currency)

  const byCurrency: Record<"CAD" | "XAF", Record<string, number>> = {
    CAD: {},
    XAF: {},
  }
  for (const r of rows) byCurrency[r.currency][r.day] = r.revenue

  const buildDays = (data: Record<string, number>) => {
    const result: { date: string; revenue: number }[] = []
    for (let i = safeDays - 1; i >= 0; i--) {
      const day = shiftCalendarDay(today, -i)
      result.push({ date: day, revenue: data[day] ?? 0 })
    }
    return result
  }

  return { CAD: buildDays(byCurrency.CAD), XAF: buildDays(byCurrency.XAF) }
}

// ============================================
// [Admin] Accès expirant (alertes dashboard)
// ============================================

export type ExpiringAccessItem = {
  id: string
  userId: string
  accessType: "exam" | "training"
  /** Epoch ms. */
  expiresAt: number
  daysRemaining: number
  user: { name: string; email: string } | null
}

/**
 * [Admin] Accès expirant dans les 7 prochains jours (encore actifs), avec
 * l'utilisateur (jointure, pas de N+1), triés par échéance. Remplace
 * `getExpiringAccess`. Borné à 200.
 */
export const getExpiringAccess = async (): Promise<ExpiringAccessItem[]> => {
  await requireRole(["admin"])

  const now = Date.now()
  const nowDate = new Date(now)
  const in7d = new Date(now + 7 * DAY_MS)

  const rows = await db
    .select({
      id: userAccess.id,
      userId: userAccess.userId,
      accessType: userAccess.accessType,
      expiresAt: userAccess.expiresAt,
      name: user.name,
      email: user.email,
    })
    .from(userAccess)
    .innerJoin(user, eq(user.id, userAccess.userId))
    .where(
      and(gt(userAccess.expiresAt, nowDate), lt(userAccess.expiresAt, in7d)),
    )
    .orderBy(asc(userAccess.expiresAt))
    .limit(200)

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    accessType: r.accessType,
    expiresAt: r.expiresAt.getTime(),
    daysRemaining: Math.ceil((r.expiresAt.getTime() - now) / DAY_MS),
    user: { name: r.name, email: r.email },
  }))
}
