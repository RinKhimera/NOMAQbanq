import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { cache } from "react"
import "server-only"
import { db } from "@/db"
import {
  examParticipations,
  exams,
  products,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import { requireRole } from "@/lib/auth-guards"
import { getCurrentSession } from "@/lib/dal"

const DAY_MS = 24 * 60 * 60 * 1000

export type AccessInfo = { expiresAt: number; daysRemaining: number } | null

const toAccessInfo = (
  expiresAt: Date | null | undefined,
  now: number,
): AccessInfo => {
  if (!expiresAt) return null
  const ms = expiresAt.getTime()
  if (ms <= now) return null
  return { expiresAt: ms, daysRemaining: Math.ceil((ms - now) / DAY_MS) }
}

// Échappe les métacaractères LIKE (%, _, \) d'une recherche utilisateur pour
// que la saisie soit traitée littéralement (sinon `%` agirait comme joker).
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&")

// Lecture fraîche de l'utilisateur courant depuis Neon (pas la session cachée) :
// l'édition de profil reste à jour immédiatement après revalidation. Sélectionne
// UNIQUEMENT les colonnes utilisées par l'UI profil (pas de fat document).
export const getCurrentUser = cache(async () => {
  const session = await getCurrentSession()
  if (!session?.user) return null

  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      username: user.username,
      bio: user.bio,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(and(eq(user.id, session.user.id), isNull(user.deletedAt)))
    .limit(1)

  return row ?? null
})

export type CurrentUser = NonNullable<
  Awaited<ReturnType<typeof getCurrentUser>>
>

export type SelectableUser = { id: string; name: string; email: string }

/**
 * [Admin] Liste des utilisateurs non-admin sélectionnables (combobox du paiement
 * manuel). Remplace `getAllUsers` Convex. Colonnes minimales, exclut les admins
 * et les comptes supprimés, triés par nom. Borné à 500 (parité Convex `.take(500)`)
 * — au-delà, prévoir une recherche serveur paginée.
 */
export const getSelectableUsers = cache(async (): Promise<SelectableUser[]> => {
  await requireRole(["admin"])

  return db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(and(ne(user.role, "admin"), isNull(user.deletedAt)))
    .orderBy(asc(user.name))
    .limit(500)
})

// ============================================
// [Admin] Liste utilisateurs (filtres + tri + pagination)
// ============================================

export type AdminUserRow = {
  id: string
  name: string
  username: string | null
  email: string
  image: string | null
  bio: string | null
  role: "user" | "admin"
  /** Epoch ms. */
  createdAt: number
  examAccess: AccessInfo
  trainingAccess: AccessInfo
}

export type AdminUsersPage = {
  items: AdminUserRow[]
  /** Offset de la page suivante ; `null` si terminé. */
  nextOffset: number | null
}

export type UsersFilters = {
  search?: string
  role?: "admin" | "user"
  accessStatus?: "active" | "expiring" | "expired" | "never"
  /** Epoch ms. */
  dateFrom?: number
  dateTo?: number
  sortBy?: "name" | "role" | "createdAt"
  sortOrder?: "asc" | "desc"
  offset?: number
  limit?: number
}

/**
 * [Admin] Utilisateurs filtrés/triés/paginés. Remplace `getUsersWithFilters`
 * Convex (qui chargeait 500 users puis filtrait/triait/paginait en JS) par du
 * SQL : recherche ILIKE (nom/email/username), filtre rôle + plage de dates, et
 * **statut d'accès** via deux LEFT JOIN aliasés sur `user_access` (exam/training,
 * au plus 1 ligne chacun grâce à l'unicité). Pagination par offset (liste admin
 * bornée, tri configurable → keyset peu pratique). `limit + 1` pour savoir s'il
 * reste une page. Garde admin (defense-in-depth).
 */
export const getUsersWithFilters = async ({
  search,
  role,
  accessStatus,
  dateFrom,
  dateTo,
  sortBy = "name",
  sortOrder = "asc",
  offset = 0,
  limit = 50,
}: UsersFilters = {}): Promise<AdminUsersPage> => {
  await requireRole(["admin"])

  // Bornes dures (la règle « max 1000 docs » s'applique même si l'appelant ment).
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100)
  const safeOffset = Math.max(0, Math.floor(offset))

  const exam = alias(userAccess, "exam_access")
  const training = alias(userAccess, "training_access")

  const now = new Date()
  const in7d = new Date(now.getTime() + 7 * DAY_MS)

  let accessPredicate
  switch (accessStatus) {
    case "active":
      accessPredicate = or(gt(exam.expiresAt, now), gt(training.expiresAt, now))
      break
    case "expiring":
      accessPredicate = or(
        and(gt(exam.expiresAt, now), lt(exam.expiresAt, in7d)),
        and(gt(training.expiresAt, now), lt(training.expiresAt, in7d)),
      )
      break
    case "expired":
      // A au moins une ligne d'accès, mais aucune active.
      accessPredicate = and(
        or(eq(exam.accessType, "exam"), eq(training.accessType, "training")),
        or(isNull(exam.expiresAt), lte(exam.expiresAt, now)),
        or(isNull(training.expiresAt), lte(training.expiresAt, now)),
      )
      break
    case "never":
      accessPredicate = and(
        isNull(exam.accessType),
        isNull(training.accessType),
      )
      break
    default:
      accessPredicate = undefined
  }

  const searchTerm = search?.trim()
  const where = and(
    isNull(user.deletedAt),
    role ? eq(user.role, role) : undefined,
    searchTerm
      ? or(
          ilike(user.name, `%${escapeLike(searchTerm)}%`),
          ilike(user.email, `%${escapeLike(searchTerm)}%`),
          ilike(user.username, `%${escapeLike(searchTerm)}%`),
        )
      : undefined,
    dateFrom ? gte(user.createdAt, new Date(dateFrom)) : undefined,
    dateTo ? lte(user.createdAt, new Date(dateTo)) : undefined,
    accessPredicate,
  )

  // Tri : nom insensible à la casse (lower) ; rôle casté en texte (ordre
  // alphabétique « admin » < « user », sinon Postgres trierait par ordre de
  // déclaration de l'enum [user, admin]) ; tie-break stable par id.
  const sortCol =
    sortBy === "createdAt"
      ? user.createdAt
      : sortBy === "role"
        ? sql`${user.role}::text`
        : sql`lower(${user.name})`
  const dir = sortOrder === "desc" ? desc : asc

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      image: user.image,
      bio: user.bio,
      role: user.role,
      createdAt: user.createdAt,
      examExpiresAt: exam.expiresAt,
      trainingExpiresAt: training.expiresAt,
    })
    .from(user)
    .leftJoin(exam, and(eq(exam.userId, user.id), eq(exam.accessType, "exam")))
    .leftJoin(
      training,
      and(eq(training.userId, user.id), eq(training.accessType, "training")),
    )
    .where(where)
    .orderBy(dir(sortCol), dir(user.id))
    .limit(safeLimit + 1)
    .offset(safeOffset)

  const hasMore = rows.length > safeLimit
  const pageRows = hasMore ? rows.slice(0, safeLimit) : rows
  const nowMs = now.getTime()

  const items: AdminUserRow[] = pageRows.map((r) => ({
    id: r.id,
    name: r.name,
    username: r.username,
    email: r.email,
    image: r.image,
    bio: r.bio,
    role: r.role,
    createdAt: r.createdAt.getTime(),
    examAccess: toAccessInfo(r.examExpiresAt, nowMs),
    trainingAccess: toAccessInfo(r.trainingExpiresAt, nowMs),
  }))

  return { items, nextOffset: hasMore ? safeOffset + safeLimit : null }
}

// ============================================
// [Admin] Statistiques page utilisateurs
// ============================================

type CurrencyRevenue = { recent: number; previous: number; trend: number }

export type UsersStatsView = {
  totalUsers: number
  newThisMonth: number
  newThisMonthTrend: number
  activeExamAccess: number
  examExpiringCount: number
  activeTrainingAccess: number
  trainingExpiringCount: number
  revenueByCurrency: { CAD: CurrencyRevenue; XAF: CurrencyRevenue }
}

const trendPct = (recent: number, previous: number) =>
  previous > 0 ? ((recent - previous) / previous) * 100 : recent > 0 ? 100 : 0

/**
 * [Admin] KPI de la page utilisateurs. Remplace `getUsersStats` Convex (jusqu'à
 * 1000+2000+2000 lignes chargées en JS) par 3 agrégations SQL parallèles :
 * compteurs users (mois courant vs précédent), accès actifs/expirants par type,
 * revenus par devise (30 j récents vs 30 j précédents).
 */
export const getUsersStats = async (): Promise<UsersStatsView> => {
  await requireRole(["admin"])

  const now = new Date()
  const nowMs = now.getTime()
  const startOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
  const startOfLastMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  )
  const in7d = new Date(nowMs + 7 * DAY_MS)
  const ago30 = new Date(nowMs - 30 * DAY_MS)
  const ago60 = new Date(nowMs - 60 * DAY_MS)

  const [userRow, accessRow, revRows] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        newThisMonth:
          sql<number>`count(*) filter (where ${user.createdAt} >= ${startOfMonth})`.mapWith(
            Number,
          ),
        newLastMonth:
          sql<number>`count(*) filter (where ${user.createdAt} >= ${startOfLastMonth} and ${user.createdAt} < ${startOfMonth})`.mapWith(
            Number,
          ),
      })
      .from(user)
      .where(isNull(user.deletedAt)),
    db
      .select({
        activeExam:
          sql<number>`count(*) filter (where ${userAccess.accessType} = 'exam' and ${userAccess.expiresAt} > ${now})`.mapWith(
            Number,
          ),
        activeTraining:
          sql<number>`count(*) filter (where ${userAccess.accessType} = 'training' and ${userAccess.expiresAt} > ${now})`.mapWith(
            Number,
          ),
        examExpiring:
          sql<number>`count(*) filter (where ${userAccess.accessType} = 'exam' and ${userAccess.expiresAt} > ${now} and ${userAccess.expiresAt} < ${in7d})`.mapWith(
            Number,
          ),
        trainingExpiring:
          sql<number>`count(*) filter (where ${userAccess.accessType} = 'training' and ${userAccess.expiresAt} > ${now} and ${userAccess.expiresAt} < ${in7d})`.mapWith(
            Number,
          ),
      })
      .from(userAccess),
    db
      .select({
        currency: transactions.currency,
        recent:
          sql<number>`coalesce(sum(${transactions.amountPaid}) filter (where ${transactions.completedAt} > ${ago30}), 0)`.mapWith(
            Number,
          ),
        previous:
          sql<number>`coalesce(sum(${transactions.amountPaid}) filter (where ${transactions.completedAt} > ${ago60} and ${transactions.completedAt} <= ${ago30}), 0)`.mapWith(
            Number,
          ),
      })
      .from(transactions)
      .where(eq(transactions.status, "completed"))
      .groupBy(transactions.currency),
  ])

  const u = userRow[0]
  const a = accessRow[0]

  const revenueByCurrency = {
    CAD: { recent: 0, previous: 0, trend: 0 },
    XAF: { recent: 0, previous: 0, trend: 0 },
  }
  for (const r of revRows) {
    revenueByCurrency[r.currency] = {
      recent: r.recent,
      previous: r.previous,
      trend: trendPct(r.recent, r.previous),
    }
  }

  return {
    totalUsers: u?.total ?? 0,
    newThisMonth: u?.newThisMonth ?? 0,
    newThisMonthTrend: trendPct(u?.newThisMonth ?? 0, u?.newLastMonth ?? 0),
    activeExamAccess: a?.activeExam ?? 0,
    examExpiringCount: a?.examExpiring ?? 0,
    activeTrainingAccess: a?.activeTraining ?? 0,
    trainingExpiringCount: a?.trainingExpiring ?? 0,
    revenueByCurrency,
  }
}

// ============================================
// [Admin] Détail utilisateur + panel latéral
// ============================================

export type AdminUserDetail = {
  id: string
  name: string
  username: string | null
  email: string
  image: string | null
  bio: string | null
  role: "user" | "admin"
  /** Epoch ms. */
  createdAt: number
}

/**
 * [Admin] Un utilisateur par id (page détail). Remplace `getUserById`. `null`
 * si introuvable ou supprimé. Garde admin (IDOR : ne jamais exposer un userId
 * arbitraire sans rôle admin — la page détail re-garde aussi `requireRole`).
 */
export const getUserForAdmin = async (
  userId: string,
): Promise<AdminUserDetail | null> => {
  await requireRole(["admin"])

  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      image: user.image,
      bio: user.bio,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(and(eq(user.id, userId), isNull(user.deletedAt)))
    .limit(1)

  if (!row) return null
  return { ...row, createdAt: row.createdAt.getTime() }
}

export type PanelAccess = {
  expiresAt: number
  daysRemaining: number
  isActive: boolean
} | null

export type PanelTransaction = {
  id: string
  type: "stripe" | "manual"
  status: (typeof transactions.status.enumValues)[number]
  amountPaid: number
  currency: "CAD" | "XAF"
  /** Epoch ms. */
  createdAt: number
  product: { name: string } | null
}

export type UserPanelData = {
  user: AdminUserDetail
  examAccess: PanelAccess
  trainingAccess: PanelAccess
  recentTransactions: PanelTransaction[]
  totalTransactionCount: number
}

const toPanelAccess = (
  expiresAt: Date | null | undefined,
  now: number,
): PanelAccess => {
  if (!expiresAt) return null
  const ms = expiresAt.getTime()
  return {
    expiresAt: ms,
    daysRemaining: Math.max(0, Math.ceil((ms - now) / DAY_MS)),
    isActive: ms > now,
  }
}

/**
 * [Admin] Données du panneau latéral : utilisateur + accès (exam/training avec
 * `isActive`) + 5 dernières transactions (produit joint) + total. Remplace
 * `getUserPanelData`. Garde admin.
 */
export const getUserPanelData = async (
  userId: string,
): Promise<UserPanelData | null> => {
  const detail = await getUserForAdmin(userId)
  if (!detail) return null

  const [accessRows, txRows, countRows] = await Promise.all([
    db
      .select({
        accessType: userAccess.accessType,
        expiresAt: userAccess.expiresAt,
      })
      .from(userAccess)
      .where(eq(userAccess.userId, userId)),
    db
      .select({
        id: transactions.id,
        type: transactions.type,
        status: transactions.status,
        amountPaid: transactions.amountPaid,
        currency: transactions.currency,
        createdAt: transactions.createdAt,
        productName: products.name,
      })
      .from(transactions)
      .leftJoin(products, eq(products.id, transactions.productId))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt), desc(transactions.id))
      .limit(5),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(transactions)
      .where(eq(transactions.userId, userId)),
  ])

  const now = Date.now()
  return {
    user: detail,
    examAccess: toPanelAccess(
      accessRows.find((r) => r.accessType === "exam")?.expiresAt,
      now,
    ),
    trainingAccess: toPanelAccess(
      accessRows.find((r) => r.accessType === "training")?.expiresAt,
      now,
    ),
    recentTransactions: txRows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      amountPaid: r.amountPaid,
      currency: r.currency,
      createdAt: r.createdAt.getTime(),
      product: r.productName ? { name: r.productName } : null,
    })),
    totalTransactionCount: countRows[0]?.count ?? 0,
  }
}

// ============================================
// [Admin] Export utilisateurs
// ============================================

export type ExportUser = {
  name: string
  username: string | null
  email: string
  role: "user" | "admin"
  /** Epoch ms. */
  createdAt: number
  bio: string | null
}

/**
 * [Admin] Tous les utilisateurs (non supprimés) pour l'export CSV/XLSX. Remplace
 * l'usage export de `getAllUsers`. Borné à 1000.
 */
export const getUsersForExport = async (): Promise<ExportUser[]> => {
  await requireRole(["admin"])

  const rows = await db
    .select({
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      bio: user.bio,
    })
    .from(user)
    .where(isNull(user.deletedAt))
    .orderBy(asc(user.name))
    .limit(1000)

  return rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() }))
}

// ============================================
// [Admin] Stats globales (dashboard admin)
// ============================================

export type AdminStats = {
  totalUsers: number
  adminCount: number
  regularUserCount: number
  totalExams: number
  activeExams: number
  totalParticipations: number
}

/**
 * [Admin] Compteurs globaux du dashboard admin : utilisateurs (non supprimés, par
 * rôle — cohérent avec `getUsersStats`), examens (total + actifs en fenêtre),
 * participations. Remplace `users.getAdminStats` (qui chargeait jusqu'à 1000
 * users / 500 exams / 2000 participations en JS) par des `count(*)` SQL.
 */
export const getAdminStats = async (): Promise<AdminStats> => {
  await requireRole(["admin"])
  const now = new Date()

  const [userRow, examRow, partRow] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        admins:
          sql<number>`count(*) filter (where ${user.role} = 'admin')`.mapWith(
            Number,
          ),
        regular:
          sql<number>`count(*) filter (where ${user.role} = 'user')`.mapWith(
            Number,
          ),
      })
      .from(user)
      .where(isNull(user.deletedAt)),
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        active:
          sql<number>`count(*) filter (where ${exams.isActive} and ${exams.startDate} <= ${now} and ${exams.endDate} >= ${now})`.mapWith(
            Number,
          ),
      })
      .from(exams),
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(examParticipations),
  ])

  return {
    totalUsers: userRow[0]?.total ?? 0,
    adminCount: userRow[0]?.admins ?? 0,
    regularUserCount: userRow[0]?.regular ?? 0,
    totalExams: examRow[0]?.total ?? 0,
    activeExams: examRow[0]?.active ?? 0,
    totalParticipations: partRow[0]?.n ?? 0,
  }
}
