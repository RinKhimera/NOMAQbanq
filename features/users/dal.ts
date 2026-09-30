import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  isNotNull,
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
  account,
  examParticipations,
  exams,
  products,
  questionBookmarks,
  session,
  trainingSessions,
  transactions,
  user,
  userAccess,
  userBans,
} from "@/db/schema"
import type { AccessType } from "@/features/payments/access-ledger"
import { describeUserAgent } from "@/features/users/lib/user-agent"
import { startOfAppZoneDay, startOfNextAppZoneDay } from "@/lib/app-zone"
import { requireRole } from "@/lib/auth-guards"
import { getCurrentSession } from "@/lib/dal"

const DAY_MS = 24 * 60 * 60 * 1000

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

export type LoginMethods = {
  hasPassword: boolean
  // `accountId` = clé primaire de la ligne `account` (ce que `unlinkAccount`
  // attend), pas l'identifiant Google de l'utilisateur.
  google:
    { linked: true; linkedAt: Date; accountId: string } | { linked: false }
  emailVerified: boolean
}

// Méthodes de connexion de l'utilisateur courant. Lit `account` (id, providerId,
// date seulement — JAMAIS password/accessToken/refreshToken/idToken/scope) et
// `user.emailVerified`. Self-scoped : filtré sur la session courante.
export const getLoginMethods = cache(async (): Promise<LoginMethods | null> => {
  const authSession = await getCurrentSession()
  if (!authSession?.user) return null
  const uid = authSession.user.id

  const rows = await db
    .select({
      id: account.id,
      providerId: account.providerId,
      createdAt: account.createdAt,
    })
    .from(account)
    .where(eq(account.userId, uid))
    .limit(10)

  const [u] = await db
    .select({ emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, uid))
    .limit(1)

  const google = rows.find((r) => r.providerId === "google")
  return {
    hasPassword: rows.some((r) => r.providerId === "credential"),
    google: google
      ? { linked: true, linkedAt: google.createdAt, accountId: google.id }
      : { linked: false },
    emailVerified: u?.emailVerified ?? false,
  }
})

// Formateur de date fixe (fuseau Québec) → chaîne stable serveur/client, pas de
// mismatch d'hydratation. Défini au scope module (pas dans un rendu React).
const SESSION_DATE_FMT = new Intl.DateTimeFormat("fr-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
})

export type UserSession = {
  id: string
  deviceLabel: string
  ipAddress: string | null
  lastActiveLabel: string
  isCurrent: boolean
}

// Sessions ACTIVES (non expirées) de l'utilisateur courant. Colonnes NON-secrètes
// uniquement — JAMAIS `session.token`. `isCurrent` par comparaison de l'id à la
// session courante. Dates pré-formatées serveur (fuseau fixe) → pas de mismatch
// d'hydratation. Borné à 50.
export const getUserSessions = cache(async (): Promise<UserSession[]> => {
  const authSession = await getCurrentSession()
  if (!authSession?.user) return []
  const currentId = authSession.session.id

  const rows = await db
    .select({
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      updatedAt: session.updatedAt,
    })
    .from(session)
    .where(
      and(
        eq(session.userId, authSession.user.id),
        gt(session.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(session.updatedAt))
    .limit(50)

  return rows.map((r) => ({
    id: r.id,
    deviceLabel: describeUserAgent(r.userAgent),
    ipAddress: r.ipAddress,
    lastActiveLabel: SESSION_DATE_FMT.format(r.updatedAt),
    isCurrent: r.id === currentId,
  }))
})

export type SelectableUser = { id: string; name: string; email: string }

/**
 * [Admin] Recherche serveur d'utilisateurs sélectionnables (picker d'audience
 * d'examen). Tous les utilisateurs non-admin / non supprimés, filtrés par nom ou
 * email (ILIKE, métacaractères échappés). Borné 1–50. Sans terme : début de
 * liste trié par nom. Garde admin (defense-in-depth).
 */
export const searchSelectableUsers = async ({
  query,
  limit = 20,
}: {
  query?: string
  limit?: number
}): Promise<SelectableUser[]> => {
  await requireRole(["admin"])
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 50)
  const term = query?.trim()
  return db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(
      and(
        ne(user.role, "admin"),
        isNull(user.deletedAt),
        term
          ? or(
              ilike(user.name, `%${escapeLike(term)}%`),
              ilike(user.email, `%${escapeLike(term)}%`),
            )
          : undefined,
      ),
    )
    .orderBy(asc(user.name))
    .limit(safeLimit)
}

// ============================================
// [Admin] Liste utilisateurs (segments d'accès + filtres + tri + pagination)
// ============================================

/** Lignes par page de la liste des utilisateurs. */
export const USERS_PAGE_SIZE = 20

export type UserSegment = "all" | "active" | "expiring" | "expired" | "never"

export type AdminUserRow = {
  id: string
  name: string
  username: string | null
  email: string
  image: string | null
  role: "user" | "admin"
  banned: boolean
  /** Epoch ms. */
  createdAt: number
  /** Epoch ms de `user_access.expires_at`, passé compris ; null = jamais eu. */
  examExpiresAt: number | null
  trainingExpiresAt: number | null
  /**
   * Epoch ms. Null pour un compte importé (aucune ligne `account`, jamais
   * reconnecté) : la valeur remplie d'office à la migration ne dit rien de lui.
   */
  lastLoginAt: number | null
}

export type AdminUsersPage = {
  items: AdminUserRow[]
  /** Total filtré, segment compris (pagination numérotée). */
  total: number
  /** Effectif de chaque segment sous les autres filtres. */
  segmentCounts: Record<UserSegment, number>
}

export type UsersFilters = {
  search?: string
  role?: "admin" | "user"
  segment?: UserSegment
  suspended?: boolean
  /**
   * Journées civiles `YYYY-MM-DD`, bornes **incluses**, interprétées dans le
   * fuseau de la plateforme — pas des instants : c'est la seule forme qui
   * désigne le même jour que celui affiché dans la liste, quel que soit le
   * fuseau du navigateur de l'admin.
   */
  dateFrom?: string
  dateTo?: string
}

const examAccess = alias(userAccess, "exam_access")
const trainingAccess = alias(userAccess, "training_access")

// Un compte sans ligne `account` n'a jamais ouvert de session depuis la
// migration de juin 2026 (Convex/Clerk) : c'est un compte importé.
const hasAccount = sql<boolean>`exists (select 1 from ${account} where ${account.userId} = ${user.id})`

/** Segments d'accès, sur les deux jointures `user_access` ; un admin n'y entre pas. */
const segmentPredicate = (segment: UserSegment, now: Date) => {
  const in7d = new Date(now.getTime() + 7 * DAY_MS)
  const student = eq(user.role, "user")
  const anyActive = or(
    gt(examAccess.expiresAt, now),
    gt(trainingAccess.expiresAt, now),
  )
  switch (segment) {
    case "active":
      return and(student, anyActive)
    case "expiring":
      return and(
        student,
        or(
          and(gt(examAccess.expiresAt, now), lte(examAccess.expiresAt, in7d)),
          and(
            gt(trainingAccess.expiresAt, now),
            lte(trainingAccess.expiresAt, in7d),
          ),
        ),
      )
    case "expired":
      return and(
        student,
        or(isNotNull(examAccess.id), isNotNull(trainingAccess.id)),
        or(isNull(examAccess.expiresAt), lte(examAccess.expiresAt, now)),
        or(
          isNull(trainingAccess.expiresAt),
          lte(trainingAccess.expiresAt, now),
        ),
      )
    case "never":
      return and(student, isNull(examAccess.id), isNull(trainingAccess.id))
    default:
      return undefined
  }
}

const usersBaseWhere = (f: UsersFilters) => {
  const term = f.search?.trim()
  return and(
    isNull(user.deletedAt),
    f.role ? eq(user.role, f.role) : undefined,
    f.suspended ? eq(user.banned, true) : undefined,
    term
      ? or(
          ilike(user.name, `%${escapeLike(term)}%`),
          ilike(user.email, `%${escapeLike(term)}%`),
          ilike(user.username, `%${escapeLike(term)}%`),
        )
      : undefined,
    f.dateFrom ? gte(user.createdAt, startOfAppZoneDay(f.dateFrom)) : undefined,
    // Semi-ouvert : la journée de fin compte en entier.
    f.dateTo ? lt(user.createdAt, startOfNextAppZoneDay(f.dateTo)) : undefined,
  )
}

// L'unicité (user_id, access_type) de `user_access` garantit au plus une
// ligne par jointure : ni doublon de page, ni compte gonflé.
const segmentCountSql = (segment: UserSegment, now: Date) =>
  sql<number>`count(*) filter (where ${segmentPredicate(segment, now) ?? sql`true`})`.mapWith(
    Number,
  )

/**
 * [Admin] Utilisateurs filtrés, triés et paginés en SQL : recherche ILIKE
 * (nom, courriel, nom d'utilisateur), rôle, suspendus, plage d'inscription,
 * segment d'accès par deux LEFT JOIN aliasés sur `user_access`. Pagination par
 * offset (tri par colonne) de 20, `total` et compteurs des segments sur le même
 * WHERE hors segment. « Dernière connexion » vaut null pour un compte importé.
 */
export const getUsersWithFilters = async ({
  sortBy = "createdAt",
  sortOrder = "desc",
  offset = 0,
  limit = USERS_PAGE_SIZE,
  ...filters
}: UsersFilters & {
  sortBy?: "name" | "createdAt" | "lastLogin"
  sortOrder?: "asc" | "desc"
  offset?: number
  limit?: number
} = {}): Promise<AdminUsersPage> => {
  await requireRole(["admin"])

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100)
  const safeOffset = Math.max(0, Math.floor(offset))
  const now = new Date()
  const base = usersBaseWhere(filters)
  const segment = filters.segment ?? "all"
  const lastLogin = sql`case when ${hasAccount} then ${user.lastLoginAt} end`

  const dir = sortOrder === "asc" ? "asc" : "desc"
  const order =
    sortBy === "name"
      ? [
          sortOrder === "asc"
            ? asc(sql`lower(${user.name})`)
            : desc(sql`lower(${user.name})`),
        ]
      : sortBy === "lastLogin"
        ? [sql`${lastLogin} ${sql.raw(dir)} nulls last`]
        : [sortOrder === "asc" ? asc(user.createdAt) : desc(user.createdAt)]

  const [rows, [counts]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        image: user.image,
        role: user.role,
        banned: user.banned,
        createdAt: user.createdAt,
        examExpiresAt: examAccess.expiresAt,
        trainingExpiresAt: trainingAccess.expiresAt,
        lastLoginAt: sql<Date | string | null>`${lastLogin}`,
      })
      .from(user)
      .leftJoin(
        examAccess,
        and(eq(examAccess.userId, user.id), eq(examAccess.accessType, "exam")),
      )
      .leftJoin(
        trainingAccess,
        and(
          eq(trainingAccess.userId, user.id),
          eq(trainingAccess.accessType, "training"),
        ),
      )
      .where(and(base, segmentPredicate(segment, now)))
      .orderBy(...order, sortOrder === "asc" ? asc(user.id) : desc(user.id))
      .limit(safeLimit)
      .offset(safeOffset),
    db
      .select({
        all: segmentCountSql("all", now),
        active: segmentCountSql("active", now),
        expiring: segmentCountSql("expiring", now),
        expired: segmentCountSql("expired", now),
        never: segmentCountSql("never", now),
      })
      .from(user)
      .leftJoin(
        examAccess,
        and(eq(examAccess.userId, user.id), eq(examAccess.accessType, "exam")),
      )
      .leftJoin(
        trainingAccess,
        and(
          eq(trainingAccess.userId, user.id),
          eq(trainingAccess.accessType, "training"),
        ),
      )
      .where(base),
  ])

  const segmentCounts: Record<UserSegment, number> = {
    all: counts?.all ?? 0,
    active: counts?.active ?? 0,
    expiring: counts?.expiring ?? 0,
    expired: counts?.expired ?? 0,
    never: counts?.never ?? 0,
  }

  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      username: r.username,
      email: r.email,
      image: r.image,
      role: r.role,
      banned: r.banned,
      createdAt: r.createdAt.getTime(),
      examExpiresAt: r.examExpiresAt?.getTime() ?? null,
      trainingExpiresAt: r.trainingExpiresAt?.getTime() ?? null,
      lastLoginAt: r.lastLoginAt ? new Date(r.lastLoginAt).getTime() : null,
    })),
    total: segmentCounts[segment],
    segmentCounts,
  }
}

export type UsersHeadline = { total: number; newLast30Days: number }

/** [Admin] « N comptes · N nouveaux sur 30 jours » (comptes non supprimés). */
export const getUsersHeadline = async (): Promise<UsersHeadline> => {
  await requireRole(["admin"])
  const since = new Date(Date.now() - 30 * DAY_MS)
  const [row] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      recent:
        sql<number>`count(*) filter (where ${user.createdAt} >= ${since})`.mapWith(
          Number,
        ),
    })
    .from(user)
    .where(isNull(user.deletedAt))
  return { total: row?.total ?? 0, newLast30Days: row?.recent ?? 0 }
}

// ============================================
// [Admin] Fiche d'un utilisateur
// ============================================

export type UserFileParticipation = {
  id: string
  examId: string
  examTitle: string
  status: "in_progress" | "completed" | "auto_submitted"
  /** Score brut : un admin n'est jamais retenu par le verrou de clé. */
  score: number
  /** Epoch ms : fermeture de l'examen (score non publié à l'étudiant avant). */
  examEndsAt: number
  /** Epoch ms : soumission, ou début d'une participation en cours. */
  at: number
}

export type UserFile = {
  user: {
    id: string
    name: string
    username: string | null
    email: string
    image: string | null
    bio: string | null
    role: "user" | "admin"
    banned: boolean
    createdAt: number
    /** Null pour un compte importé, jamais la valeur remplie d'office. */
    lastLoginAt: number | null
    /** Aucune ligne `account` : créé avant la migration, jamais reconnecté. */
    imported: boolean
    /** `account.provider_id` distincts (« credential », « google »). */
    loginMethods: string[]
  }
  /** Epoch ms de `user_access.expires_at`, passé compris ; null = jamais eu. */
  access: { exam: number | null; training: number | null }
  /** Type du paiement qui porte chaque accès (Stripe se rembourse dans Stripe). */
  accessPaidBy: {
    exam: "stripe" | "manual" | null
    training: "stripe" | "manual" | null
  }
  payments: {
    count: number
    totalCad: number
    totalXaf: number
    last: {
      createdAt: number
      productName: string | null
      amountPaid: number
      currency: "CAD" | "XAF"
      status: (typeof transactions.status.enumValues)[number]
      disputeStatus: string | null
    }
  } | null
  activity: {
    lastActivity: {
      kind: "participation" | "series"
      label: string
      at: number
    } | null
    participations: UserFileParticipation[]
    participationCount: number
    series: {
      count: number
      lastAt: number
      /** Moyenne des séries terminées, au plancher ; null sans série notée. */
      average: number | null
      /** Part des séries en mode tuteur, en %. */
      tutorShare: number
    } | null
    bookmarkCount: number
  }
  communications: {
    prefs: { examResults: boolean; accessExpiry: boolean; marketing: boolean }
    sent: {
      welcome: number | null
      inactivity: number | null
      cart: number | null
      expiry: number | null
    }
  }
}

const ms = (d: Date | string | null | undefined) =>
  d ? new Date(d).getTime() : null

/**
 * [Admin] Fiche d'un utilisateur, en une poignée de requêtes bornées lancées
 * ensemble : identité et préférences, méthodes de connexion
 * (`account.provider_id` seulement), accès (expiration même passée), résumé des
 * paiements, participations (score brut, 200 au plus), résumé des séries,
 * marquages. `null` si introuvable ou supprimé.
 */
export const getUserFile = async (userId: string): Promise<UserFile | null> => {
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
      banned: user.banned,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      notifyExamResults: user.notifyExamResults,
      notifyAccessExpiry: user.notifyAccessExpiry,
      notifyMarketing: user.notifyMarketing,
      welcomeEmailSentAt: user.welcomeEmailSentAt,
      inactivityReminderSentAt: user.inactivityReminderSentAt,
      cartReminderSentAt: user.cartReminderSentAt,
    })
    .from(user)
    .where(and(eq(user.id, userId), isNull(user.deletedAt)))
    .limit(1)
  if (!row) return null

  const [
    providers,
    accessRows,
    paymentRows,
    lastPayment,
    participations,
    seriesRows,
    bookmarkRows,
  ] = await Promise.all([
    // Exception de confidentialité (data-layer.md) : le fournisseur seul.
    db
      .selectDistinct({ providerId: account.providerId })
      .from(account)
      .where(eq(account.userId, userId))
      .orderBy(asc(account.providerId))
      .limit(10),
    db
      .select({
        accessType: userAccess.accessType,
        expiresAt: userAccess.expiresAt,
        expiryReminderSentAt: userAccess.expiryReminderSentAt,
        paidBy: transactions.type,
      })
      .from(userAccess)
      .leftJoin(transactions, eq(transactions.id, userAccess.lastTransactionId))
      .where(eq(userAccess.userId, userId)),
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        totalCad:
          sql<number>`coalesce(sum(${transactions.amountPaid}) filter (where ${transactions.status} = 'completed' and ${transactions.currency} = 'CAD'), 0)`.mapWith(
            Number,
          ),
        totalXaf:
          sql<number>`coalesce(sum(${transactions.amountPaid}) filter (where ${transactions.status} = 'completed' and ${transactions.currency} = 'XAF'), 0)`.mapWith(
            Number,
          ),
      })
      .from(transactions)
      .where(eq(transactions.userId, userId)),
    db
      .select({
        createdAt: transactions.createdAt,
        productName: products.name,
        amountPaid: transactions.amountPaid,
        currency: transactions.currency,
        status: transactions.status,
        disputeStatus: transactions.disputeStatus,
      })
      .from(transactions)
      .leftJoin(products, eq(products.id, transactions.productId))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt), desc(transactions.id))
      .limit(1),
    db
      .select({
        id: examParticipations.id,
        examId: exams.id,
        examTitle: exams.title,
        status: examParticipations.status,
        score: examParticipations.score,
        examEndsAt: exams.endDate,
        at: sql<
          Date | string
        >`coalesce(${examParticipations.completedAt}, ${examParticipations.startedAt}, ${examParticipations.createdAt})`,
      })
      .from(examParticipations)
      .innerJoin(exams, eq(exams.id, examParticipations.examId))
      .where(eq(examParticipations.userId, userId))
      .orderBy(
        desc(
          sql`coalesce(${examParticipations.completedAt}, ${examParticipations.startedAt}, ${examParticipations.createdAt})`,
        ),
      )
      .limit(200),
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        lastAt: sql<
          Date | string | null
        >`max(coalesce(${trainingSessions.completedAt}, ${trainingSessions.startedAt}))`,
        average: sql<
          number | null
        >`floor(avg(${trainingSessions.score}) filter (where ${trainingSessions.status} = 'completed'))`,
        tutor:
          sql<number>`count(*) filter (where ${trainingSessions.mode} = 'tutor')`.mapWith(
            Number,
          ),
      })
      .from(trainingSessions)
      .where(eq(trainingSessions.userId, userId)),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(questionBookmarks)
      .where(eq(questionBookmarks.userId, userId)),
  ])

  const accessOf = (type: AccessType) =>
    accessRows.find((r) => r.accessType === type)
  const pay = paymentRows[0]
  const last = lastPayment[0]
  const series = seriesRows[0]
  const lastSeriesAt = ms(series?.lastAt)
  const lastParticipation = participations[0]
  const participationAt = lastParticipation ? ms(lastParticipation.at)! : null

  const lastActivity =
    participationAt !== null &&
    (lastSeriesAt === null || participationAt >= lastSeriesAt)
      ? {
          kind: "participation" as const,
          label: lastParticipation.examTitle,
          at: participationAt,
        }
      : lastSeriesAt !== null
        ? {
            kind: "series" as const,
            label: `${series.count} série${series.count > 1 ? "s" : ""} au total`,
            at: lastSeriesAt,
          }
        : null

  const imported = providers.length === 0
  const expiryReminders = accessRows
    .map((r) => r.expiryReminderSentAt?.getTime() ?? null)
    .filter((t): t is number => t !== null)

  return {
    user: {
      id: row.id,
      name: row.name,
      username: row.username,
      email: row.email,
      image: row.image,
      bio: row.bio,
      role: row.role,
      banned: row.banned,
      createdAt: row.createdAt.getTime(),
      lastLoginAt: imported ? null : ms(row.lastLoginAt),
      imported,
      loginMethods: providers.map((p) => p.providerId),
    },
    access: {
      exam: accessOf("exam")?.expiresAt.getTime() ?? null,
      training: accessOf("training")?.expiresAt.getTime() ?? null,
    },
    accessPaidBy: {
      exam: accessOf("exam")?.paidBy ?? null,
      training: accessOf("training")?.paidBy ?? null,
    },
    payments:
      pay && pay.count > 0 && last
        ? {
            count: pay.count,
            totalCad: pay.totalCad,
            totalXaf: pay.totalXaf,
            last: {
              createdAt: last.createdAt.getTime(),
              productName: last.productName,
              amountPaid: last.amountPaid,
              currency: last.currency,
              status: last.status,
              disputeStatus: last.disputeStatus,
            },
          }
        : null,
    activity: {
      lastActivity,
      participations: participations.map((p) => ({
        id: p.id,
        examId: p.examId,
        examTitle: p.examTitle,
        status: p.status,
        score: p.score,
        examEndsAt: p.examEndsAt.getTime(),
        at: ms(p.at)!,
      })),
      participationCount: participations.length,
      series:
        series && series.count > 0 && lastSeriesAt !== null
          ? {
              count: series.count,
              lastAt: lastSeriesAt,
              average: series.average === null ? null : Number(series.average),
              tutorShare: Math.round((100 * series.tutor) / series.count),
            }
          : null,
      bookmarkCount: bookmarkRows[0]?.count ?? 0,
    },
    communications: {
      prefs: {
        examResults: row.notifyExamResults,
        accessExpiry: row.notifyAccessExpiry,
        marketing: row.notifyMarketing,
      },
      sent: {
        welcome: ms(row.welcomeEmailSentAt),
        inactivity: ms(row.inactivityReminderSentAt),
        cart: ms(row.cartReminderSentAt),
        expiry: expiryReminders.length ? Math.max(...expiryReminders) : null,
      },
    },
  }
}

// ============================================
// [Admin] Journal des suspensions
// ============================================

export type UserBanView = {
  id: string
  reason: string
  /** Epoch ms. */
  bannedAt: number
  /** Nul uniquement si la ligne `user` de l'auteur a disparu (FK set null). */
  bannedByName: string | null
  /** Epoch ms ; nul = épisode ouvert (au plus un par compte). */
  liftedAt: number | null
  liftedByName: string | null
  liftReason: string | null
}

/**
 * [Admin] Épisodes de suspension d'un compte, du plus récent au plus ancien,
 * noms des admins joints (deux alias sur `user`). Borné à 20. Garde admin.
 */
export const getUserBans = async (userId: string): Promise<UserBanView[]> => {
  await requireRole(["admin"])

  const bannedBy = alias(user, "banned_by_user")
  const liftedBy = alias(user, "lifted_by_user")

  const rows = await db
    .select({
      id: userBans.id,
      reason: userBans.reason,
      bannedAt: userBans.bannedAt,
      bannedByName: bannedBy.name,
      liftedAt: userBans.liftedAt,
      liftedByName: liftedBy.name,
      liftReason: userBans.liftReason,
    })
    .from(userBans)
    .leftJoin(bannedBy, eq(bannedBy.id, userBans.bannedBy))
    .leftJoin(liftedBy, eq(liftedBy.id, userBans.liftedBy))
    .where(eq(userBans.userId, userId))
    .orderBy(desc(userBans.bannedAt), desc(userBans.id))
    .limit(20)

  return rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    bannedAt: r.bannedAt.getTime(),
    bannedByName: r.bannedByName,
    liftedAt: r.liftedAt ? r.liftedAt.getTime() : null,
    liftedByName: r.liftedByName,
    liftReason: r.liftReason,
  }))
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
  /** Epoch ms, passé compris ; null = jamais eu. */
  examExpiresAt: number | null
  trainingExpiresAt: number | null
  banned: boolean
}

/**
 * [Admin] Utilisateurs à exporter selon les filtres courants de la liste
 * (mêmes filtres et segment que `getUsersWithFilters`), triés par nom.
 * Borné à 1000.
 */
export const getUsersForExport = async (
  filters: UsersFilters = {},
): Promise<ExportUser[]> => {
  await requireRole(["admin"])

  const rows = await db
    .select({
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      examExpiresAt: examAccess.expiresAt,
      trainingExpiresAt: trainingAccess.expiresAt,
      banned: user.banned,
    })
    .from(user)
    .leftJoin(
      examAccess,
      and(eq(examAccess.userId, user.id), eq(examAccess.accessType, "exam")),
    )
    .leftJoin(
      trainingAccess,
      and(
        eq(trainingAccess.userId, user.id),
        eq(trainingAccess.accessType, "training"),
      ),
    )
    .where(
      and(
        usersBaseWhere(filters),
        segmentPredicate(filters.segment ?? "all", new Date()),
      ),
    )
    .orderBy(asc(sql`lower(${user.name})`), asc(user.id))
    .limit(1000)

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.getTime(),
    examExpiresAt: r.examExpiresAt?.getTime() ?? null,
    trainingExpiresAt: r.trainingExpiresAt?.getTime() ?? null,
  }))
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
