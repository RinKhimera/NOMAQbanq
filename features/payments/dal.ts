import "server-only"

import { and, asc, desc, eq, gt, lt, ne, or, sql } from "drizzle-orm"
import { cache } from "react"

import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
import { requireRole, requireSession } from "@/lib/auth-guards"
import { getCurrentSession } from "@/lib/dal"

const DAY_MS = 24 * 60 * 60 * 1000

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
 * Statut d'accès complet (exam + training). `userId` optionnel → défaut = session.
 * Remplace `getMyAccessStatus` + `getMyAccess`. `null` si non connecté.
 * Borné par la contrainte UNIQUE(user_id, access_type) → au plus 2 lignes.
 */
export const getAccessStatus = cache(
  async (userId?: string): Promise<AccessStatus | null> => {
    let targetId = userId
    if (!targetId) {
      const session = await getCurrentSession()
      if (!session?.user) return null
      targetId = session.user.id
    }

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

  const [row] = await db
    .select({ expiresAt: userAccess.expiresAt })
    .from(userAccess)
    .where(and(eq(userAccess.userId, targetId), eq(userAccess.accessType, type)))
    .limit(1)

  return Boolean(row) && row.expiresAt.getTime() > Date.now()
}

// ============================================
// Produits disponibles
// ============================================

export type ProductView = {
  id: string
  code: (typeof products.code.enumValues)[number]
  name: string
  description: string
  /** En cents. Nom conservé pour l'UI existante (était `priceCAD` côté Convex). */
  priceCAD: number
  durationDays: number
  accessType: "exam" | "training"
  isCombo: boolean
  stripeProductId: string
  stripePriceId: string
}

/**
 * Produits actifs disponibles à l'achat. Remplace `getAvailableProducts`.
 * Mappe `priceCad` → `priceCAD` (nom attendu par l'UI). Borné : ordre stable,
 * peu de produits. `cache()` pour dédupliquer par render.
 */
export const getAvailableProducts = cache(
  async (): Promise<ProductView[]> => {
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
        stripeProductId: products.stripeProductId,
        stripePriceId: products.stripePriceId,
      })
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(asc(products.priceCad), asc(products.id))
      .limit(50)

    return rows
  },
)

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
  notes: string | null
  product: { id: string; code: string; name: string } | null
}

export type MyTransactionsPage = {
  items: MyTransactionView[]
  /** Curseur opaque pour la page suivante ; `null` si terminé. */
  nextCursor: string | null
}

// Curseur keyset = base64("<createdAtISO>|<id>"). On encode l'ISO de la date
// (précision ms, stable) + l'id pour départager les égalités de createdAt.
const encodeCursor = (createdAt: Date, id: string): string =>
  Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString("base64")

const decodeCursor = (cursor: string): { createdAt: Date; id: string } | null => {
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
 * Historique des transactions de l'utilisateur courant. Remplace
 * `getMyTransactions`. Sémantique conservée :
 *  - filtre `userId = session` ET `status <> 'pending'` (checkouts abandonnés masqués),
 *  - jointure produit en une seule requête (pas de N+1),
 *  - ordre `createdAt DESC, id DESC`.
 * Pagination keyset (pas offset) : le curseur encode `(createdAt, id)` de la
 * dernière ligne. On lit `limit + 1` lignes pour savoir s'il reste une page.
 * Dates renvoyées en epoch ms (attendu par l'UI / les formatters).
 */
export const getMyTransactions = async ({
  cursor,
  limit = 20,
}: {
  cursor?: string | null
  limit?: number
} = {}): Promise<MyTransactionsPage> => {
  const session = await requireSession()
  const userId = session.user.id

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100)
  const decoded = cursor ? decodeCursor(cursor) : null

  // Prédicat "après le curseur" dans l'ordre (createdAt DESC, id DESC) :
  // createdAt < c  OU  (createdAt = c ET id < cid).
  const afterCursor = decoded
    ? or(
        lt(transactions.createdAt, decoded.createdAt),
        and(
          eq(transactions.createdAt, decoded.createdAt),
          lt(transactions.id, decoded.id),
        ),
      )
    : undefined

  const where = and(
    eq(transactions.userId, userId),
    ne(transactions.status, "pending"),
    afterCursor,
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
      notes: transactions.notes,
      productId: products.id,
      productCode: products.code,
      productName: products.name,
    })
    .from(transactions)
    .leftJoin(products, eq(products.id, transactions.productId))
    .where(where)
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(safeLimit + 1)

  const hasMore = rows.length > safeLimit
  const pageRows = hasMore ? rows.slice(0, safeLimit) : rows

  const items: MyTransactionView[] = pageRows.map((r) => ({
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
    notes: r.notes,
    product: r.productId
      ? { id: r.productId, code: r.productCode!, name: r.productName! }
      : null,
  }))

  const last = pageRows.at(-1)
  const nextCursor =
    hasMore && last ? encodeCursor(last.createdAt, last.id) : null

  return { items, nextCursor }
}

// ============================================
// [Admin] Toutes les transactions (pagination keyset + filtres)
// ============================================

type TxStatus = (typeof transactions.status.enumValues)[number]

export type AdminTransactionView = {
  id: string
  type: "stripe" | "manual"
  status: TxStatus
  /** En cents. */
  amountPaid: number
  currency: "CAD" | "XAF"
  accessType: "exam" | "training"
  durationDays: number
  /** Epoch ms. */
  createdAt: number
  /** Epoch ms ou null tant que non complétée. */
  completedAt: number | null
  paymentMethod: string | null
  notes: string | null
  product: { id: string; name: string } | null
  user: { id: string; name: string; email: string } | null
}

export type AdminTransactionsPage = {
  items: AdminTransactionView[]
  nextCursor: string | null
}

/**
 * [Admin] Toutes les transactions, filtrables par type/statut/utilisateur.
 * Remplace `getAllTransactions` Convex. Pagination keyset (même curseur
 * `(createdAt, id)` que `getMyTransactions`) au lieu du `.paginate()` Convex :
 * filtres poussés en SQL (pas de filtrage post-pagination côté JS). Jointures
 * user + produit en une requête (pas de N+1). Garde admin (defense-in-depth :
 * le layout admin garde déjà, mais le DAL ne fait jamais confiance à l'appelant).
 */
export const getAllTransactions = async ({
  cursor,
  limit = 20,
  type,
  status,
  userId,
}: {
  cursor?: string | null
  limit?: number
  type?: "stripe" | "manual"
  status?: TxStatus
  userId?: string
} = {}): Promise<AdminTransactionsPage> => {
  await requireRole(["admin"])

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100)
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

  const where = and(
    type ? eq(transactions.type, type) : undefined,
    status ? eq(transactions.status, status) : undefined,
    userId ? eq(transactions.userId, userId) : undefined,
    afterCursor,
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
      createdAt: transactions.createdAt,
      completedAt: transactions.completedAt,
      paymentMethod: transactions.paymentMethod,
      notes: transactions.notes,
      productId: products.id,
      productName: products.name,
      buyerId: user.id,
      buyerName: user.name,
      buyerEmail: user.email,
    })
    .from(transactions)
    // userId est NOT NULL + FK restrict → l'acheteur existe toujours (innerJoin sûr).
    .innerJoin(user, eq(user.id, transactions.userId))
    .leftJoin(products, eq(products.id, transactions.productId))
    .where(where)
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
    accessType: r.accessType,
    durationDays: r.durationDays,
    createdAt: r.createdAt.getTime(),
    completedAt: r.completedAt ? r.completedAt.getTime() : null,
    paymentMethod: r.paymentMethod,
    notes: r.notes,
    product: r.productId ? { id: r.productId, name: r.productName! } : null,
    user: { id: r.buyerId, name: r.buyerName, email: r.buyerEmail },
  }))

  const last = pageRows.at(-1)
  const nextCursor =
    hasMore && last ? encodeCursor(last.createdAt, last.id) : null

  return { items, nextCursor }
}

// ============================================
// [Admin] Statistiques transactions (dashboard)
// ============================================

export type TransactionStatsView = {
  revenueByCurrency: {
    CAD: { total: number; recent: number }
    XAF: { total: number; recent: number }
  }
  totalTransactions: number
  recentTransactions: number
  stripeTransactions: number
  manualTransactions: number
}

/**
 * [Admin] Revenus + compteurs sur les transactions complétées. Remplace
 * `getTransactionStats` Convex (qui chargeait jusqu'à 10000 lignes en JS) par
 * une agrégation SQL `GROUP BY currency` avec `FILTER` pour la fenêtre 30 jours :
 * O(1) lignes ramenées, calcul côté Postgres.
 */
export const getTransactionStats = async (): Promise<TransactionStatsView> => {
  await requireRole(["admin"])

  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS)

  const rows = await db
    .select({
      currency: transactions.currency,
      total: sql<number>`coalesce(sum(${transactions.amountPaid}), 0)`.mapWith(
        Number,
      ),
      recent:
        sql<number>`coalesce(sum(${transactions.amountPaid}) filter (where ${transactions.completedAt} > ${thirtyDaysAgo}), 0)`.mapWith(
          Number,
        ),
      count: sql<number>`count(*)`.mapWith(Number),
      recentCount:
        sql<number>`count(*) filter (where ${transactions.completedAt} > ${thirtyDaysAgo})`.mapWith(
          Number,
        ),
      stripeCount:
        sql<number>`count(*) filter (where ${transactions.type} = 'stripe')`.mapWith(
          Number,
        ),
      manualCount:
        sql<number>`count(*) filter (where ${transactions.type} = 'manual')`.mapWith(
          Number,
        ),
    })
    .from(transactions)
    .where(eq(transactions.status, "completed"))
    .groupBy(transactions.currency)

  const revenueByCurrency = {
    CAD: { total: 0, recent: 0 },
    XAF: { total: 0, recent: 0 },
  }
  let totalTransactions = 0
  let recentTransactions = 0
  let stripeTransactions = 0
  let manualTransactions = 0

  for (const r of rows) {
    revenueByCurrency[r.currency] = { total: r.total, recent: r.recent }
    totalTransactions += r.count
    recentTransactions += r.recentCount
    stripeTransactions += r.stripeCount
    manualTransactions += r.manualCount
  }

  return {
    revenueByCurrency,
    totalTransactions,
    recentTransactions,
    stripeTransactions,
    manualTransactions,
  }
}

// ============================================
// [Admin] Impact d'accès d'une transaction (avant remboursement/suppression)
// ============================================

export type AccessImpact = {
  willRevokeAccess: boolean
  /** Epoch ms ou null. */
  currentAccessExpiresAt: number | null
  accessType: "exam" | "training"
}

/**
 * [Admin] Indique si rembourser/supprimer cette transaction révoquera l'accès,
 * c.-à-d. si elle est la dernière à l'avoir accordé (`lastTransactionId`).
 * Remplace `getTransactionAccessImpact` Convex. Renvoie `null` si la transaction
 * n'existe pas (l'UI traite alors « aucun impact »).
 */
export const getTransactionAccessImpact = async (
  transactionId: string,
): Promise<AccessImpact | null> => {
  await requireRole(["admin"])

  const [tx] = await db
    .select({
      userId: transactions.userId,
      accessType: transactions.accessType,
    })
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1)
  if (!tx) return null

  const [access] = await db
    .select({
      expiresAt: userAccess.expiresAt,
      lastTransactionId: userAccess.lastTransactionId,
    })
    .from(userAccess)
    .where(
      and(
        eq(userAccess.userId, tx.userId),
        eq(userAccess.accessType, tx.accessType),
      ),
    )
    .limit(1)

  return {
    willRevokeAccess: access?.lastTransactionId === transactionId,
    currentAccessExpiresAt: access ? access.expiresAt.getTime() : null,
    accessType: tx.accessType,
  }
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
 * filtrait 2000 lignes en JS) : agrégation SQL `GROUP BY (jour UTC, devise)` puis
 * remplissage des jours manquants. Jours en UTC (TZ=UTC en prod/CI).
 */
export const getRevenueByDay = async (days = 30): Promise<RevenueByDay> => {
  await requireRole(["admin"])

  const safeDays = Math.min(Math.max(1, Math.floor(days)), 365)
  const now = Date.now()
  const startDate = new Date(now - safeDays * DAY_MS)

  const dayExpr = sql<string>`to_char(${transactions.completedAt} at time zone 'UTC', 'YYYY-MM-DD')`
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
        gt(transactions.completedAt, startDate),
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
      const day = new Date(now - i * DAY_MS).toISOString().slice(0, 10)
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
    .where(and(gt(userAccess.expiresAt, nowDate), lt(userAccess.expiresAt, in7d)))
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
