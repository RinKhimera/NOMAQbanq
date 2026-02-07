import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import {
  QueryCtx,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server"
import {
  getAdminUserOrThrow,
  getCurrentUserOrNull,
  getCurrentUserOrThrow,
} from "./lib/auth"
import { batchGetByIds } from "./lib/batchFetch"

async function userByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
    .unique()
}

// Validator pour les données Clerk webhook (seulement les champs utilisés)
const clerkUserDataValidator = v.object({
  id: v.string(),
  first_name: v.optional(v.union(v.string(), v.null())),
  last_name: v.optional(v.union(v.string(), v.null())),
  email_addresses: v.array(
    v.object({
      email_address: v.string(),
    })
  ),
  image_url: v.optional(v.union(v.string(), v.null())),
})

export const upsertFromClerk = internalMutation({
  args: { data: clerkUserDataValidator },
  returns: v.null(),
  async handler(ctx, { data }) {
    const firstName = data.first_name?.trim() || ""
    const lastName = data.last_name?.trim() || ""
    const fullName = `${firstName} ${lastName}`.trim() || "Utilisateur"

    const baseAttributes = {
      externalId: data.id,
      tokenIdentifier: `${process.env.NEXT_PUBLIC_CLERK_FRONTEND_API_URL}|${data.id}`,
      name: fullName,
      email: data.email_addresses[0]?.email_address,
      image: data.image_url ?? "",
    }

    const user = await userByExternalId(ctx, data.id)
    if (user === null) {
      await ctx.db.insert("users", {
        ...baseAttributes,
        role: "user" as const,
      })
    } else {
      await ctx.db.patch(user._id, baseAttributes)
    }
  },
})

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  returns: v.null(),
  async handler(ctx, { clerkUserId }) {
    const user = await userByExternalId(ctx, clerkUserId)

    if (user !== null) {
      await ctx.db.delete(user._id)
    } else {
      console.warn(
        `Can't delete user, there is none for Clerk user ID: ${clerkUserId}`,
      )
    }
  },
})

export const createUser = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    image: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
    externalId: v.string(),
    tokenIdentifier: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("users", {
      externalId: args.externalId,
      tokenIdentifier: args.tokenIdentifier,
      name: args.name,
      email: args.email,
      image: args.image,
      role: args.role,
    })
  },
})

/**
 * [Internal] Récupère un utilisateur par son tokenIdentifier
 * Utilisé par les actions Stripe pour obtenir l'utilisateur courant
 */
export const getUserByTokenIdentifier = internalQuery({
  args: { tokenIdentifier: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.string(),
      username: v.optional(v.string()),
      email: v.string(),
      image: v.string(),
      avatarStoragePath: v.optional(v.string()),
      bio: v.optional(v.string()),
      tokenIdentifier: v.string(),
      externalId: v.optional(v.string()),
      role: v.union(v.literal("admin"), v.literal("user")),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", args.tokenIdentifier),
      )
      .unique()
  },
})

export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.string(),
      username: v.optional(v.string()),
      email: v.string(),
      image: v.string(),
      avatarStoragePath: v.optional(v.string()),
      bio: v.optional(v.string()),
      tokenIdentifier: v.string(),
      externalId: v.optional(v.string()),
      role: v.union(v.literal("admin"), v.literal("user")),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    return await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique()
  },
})

export const isCurrentUserAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return false

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique()

    return user?.role === "admin"
  },
})

export const updateUserProfile = mutation({
  args: {
    name: v.string(),
    username: v.string(),
    bio: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

    const usernameTaken = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .filter((q) => q.neq(q.field("_id"), user._id))
      .first()
    if (usernameTaken)
      return { success: false, error: "Ce nom d'utilisateur est déjà pris !" }

    await ctx.db.patch(user._id, {
      name: args.name,
      username: args.username,
      bio: args.bio,
    })

    return { success: true }
  },
})

export const getAllUsers = query({
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        _id: v.id("users"),
        _creationTime: v.number(),
        name: v.string(),
        username: v.optional(v.string()),
        email: v.string(),
        image: v.string(),
        avatarStoragePath: v.optional(v.string()),
        bio: v.optional(v.string()),
        tokenIdentifier: v.string(),
        externalId: v.optional(v.string()),
        role: v.union(v.literal("admin"), v.literal("user")),
      }),
    ),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user || user.role !== "admin") {
      return null
    }

    // Limit to 500 users for performance; use getUsersWithPagination for full list
    return await ctx.db.query("users").take(500)
  },
})

export const getUserById = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.string(),
      username: v.optional(v.string()),
      email: v.string(),
      image: v.string(),
      avatarStoragePath: v.optional(v.string()),
      bio: v.optional(v.string()),
      tokenIdentifier: v.string(),
      externalId: v.optional(v.string()),
      role: v.union(v.literal("admin"), v.literal("user")),
    }),
  ),
  handler: async (ctx, { userId }) => {
    await getAdminUserOrThrow(ctx)
    return await ctx.db.get(userId)
  },
})

/**
 * [Internal] Met à jour l'avatar d'un utilisateur
 * Appelé par l'action HTTP d'upload d'avatar
 */
export const updateUserAvatar = internalMutation({
  args: {
    userId: v.id("users"),
    avatarUrl: v.string(),
    avatarStoragePath: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      image: args.avatarUrl,
      avatarStoragePath: args.avatarStoragePath,
    })
  },
})

// Récupérer les statistiques pour le dashboard admin
// Note: For scale, consider creating adminStats aggregation table like questionStats
export const getAdminStats = query({
  args: {},
  returns: v.object({
    totalUsers: v.number(),
    adminCount: v.number(),
    regularUserCount: v.number(),
    totalExams: v.number(),
    activeExams: v.number(),
    totalParticipations: v.number(),
  }),
  handler: async (ctx) => {
    await getAdminUserOrThrow(ctx)

    // Limit reads for performance - admin stats are approximate at scale
    const userLimit = 1000
    const examLimit = 500
    const participationLimit = 2000

    const allUsers = await ctx.db.query("users").take(userLimit)
    const totalUsers = allUsers.length

    const adminCount = allUsers.filter((u) => u.role === "admin").length
    const regularUserCount = allUsers.filter((u) => u.role === "user").length

    const allExams = await ctx.db.query("exams").take(examLimit)

    const allParticipations = await ctx.db
      .query("examParticipations")
      .take(participationLimit)
    const totalParticipations = allParticipations.length

    const now = Date.now()
    const activeExamsCount = allExams.filter(
      (exam) => exam.isActive && exam.startDate <= now && exam.endDate >= now,
    ).length

    return {
      totalUsers,
      adminCount,
      regularUserCount,
      totalExams: allExams.length,
      activeExams: activeExamsCount,
      totalParticipations,
    }
  },
})

// ============================================
// ADMIN USERS PAGE - New queries
// ============================================

/**
 * [Admin] Statistiques pour la page utilisateurs
 * Retourne: total, nouveaux ce mois, accès actifs, revenus
 */
export const getUsersStats = query({
  args: {},
  returns: v.object({
    totalUsers: v.number(),
    newThisMonth: v.number(),
    newThisMonthTrend: v.number(),
    activeExamAccess: v.number(),
    examExpiringCount: v.number(),
    activeTrainingAccess: v.number(),
    trainingExpiringCount: v.number(),
    revenueByCurrency: v.object({
      CAD: v.object({ recent: v.number(), previous: v.number(), trend: v.number() }),
      XAF: v.object({ recent: v.number(), previous: v.number(), trend: v.number() }),
    }),
  }),
  handler: async (ctx) => {
    await getAdminUserOrThrow(ctx)

    const now = Date.now()
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const startOfMonthTs = startOfMonth.getTime()

    const startOfLastMonth = new Date(startOfMonth)
    startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1)
    const startOfLastMonthTs = startOfLastMonth.getTime()

    const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

    // Batch fetch
    const [users, userAccess, transactions] = await Promise.all([
      ctx.db.query("users").take(1000),
      ctx.db.query("userAccess").take(2000),
      ctx.db
        .query("transactions")
        .withIndex("by_status", (q) => q.eq("status", "completed"))
        .take(2000),
    ])

    // User counts
    const totalUsers = users.length
    const newThisMonth = users.filter(
      (u) => u._creationTime >= startOfMonthTs,
    ).length
    const newLastMonth = users.filter(
      (u) =>
        u._creationTime >= startOfLastMonthTs &&
        u._creationTime < startOfMonthTs,
    ).length
    const newThisMonthTrend =
      newLastMonth > 0
        ? ((newThisMonth - newLastMonth) / newLastMonth) * 100
        : newThisMonth > 0
          ? 100
          : 0

    // Active access counts
    const activeExamAccess = userAccess.filter(
      (a) => a.accessType === "exam" && a.expiresAt > now,
    ).length
    const activeTrainingAccess = userAccess.filter(
      (a) => a.accessType === "training" && a.expiresAt > now,
    ).length

    // Expiring soon (7 days)
    const examExpiringCount = userAccess.filter(
      (a) =>
        a.accessType === "exam" &&
        a.expiresAt > now &&
        a.expiresAt < sevenDaysFromNow,
    ).length
    const trainingExpiringCount = userAccess.filter(
      (a) =>
        a.accessType === "training" &&
        a.expiresAt > now &&
        a.expiresAt < sevenDaysFromNow,
    ).length

    // Revenue by currency (last 30 days vs previous 30 days)
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000

    const recentTransactions = transactions.filter(
      (tx) => tx.completedAt && tx.completedAt > thirtyDaysAgo,
    )
    const previousPeriodTransactions = transactions.filter(
      (tx) =>
        tx.completedAt &&
        tx.completedAt > sixtyDaysAgo &&
        tx.completedAt <= thirtyDaysAgo,
    )

    // Grouper par devise (seulement CAD et XAF supportés)
    const revenueByCurrency = {
      CAD: { recent: 0, previous: 0, trend: 0 },
      XAF: { recent: 0, previous: 0, trend: 0 },
    }

    for (const tx of recentTransactions) {
      const currency = (tx.currency || "CAD") as "CAD" | "XAF"
      if (currency === "CAD" || currency === "XAF") {
        revenueByCurrency[currency].recent += tx.amountPaid
      }
    }

    for (const tx of previousPeriodTransactions) {
      const currency = (tx.currency || "CAD") as "CAD" | "XAF"
      if (currency === "CAD" || currency === "XAF") {
        revenueByCurrency[currency].previous += tx.amountPaid
      }
    }

    // Calculer les trends pour chaque devise
    for (const key of ["CAD", "XAF"] as const) {
      const { recent, previous } = revenueByCurrency[key]
      revenueByCurrency[key].trend =
        previous > 0
          ? Math.round(((recent - previous) / previous) * 1000) / 10
          : recent > 0
            ? 100
            : 0
    }

    return {
      totalUsers,
      newThisMonth,
      newThisMonthTrend,
      activeExamAccess,
      examExpiringCount,
      activeTrainingAccess,
      trainingExpiringCount,
      revenueByCurrency,
    }
  },
})

/**
 * [Admin] Liste des utilisateurs avec filtres avancés
 */
export const getUsersWithFilters = query({
  args: {
    paginationOpts: paginationOptsValidator,
    searchQuery: v.optional(v.string()),
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
    accessStatus: v.optional(
      v.union(
        v.literal("active"),
        v.literal("expiring"),
        v.literal("expired"),
        v.literal("never"),
      ),
    ),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    sortBy: v.optional(
      v.union(v.literal("name"), v.literal("role"), v.literal("_creationTime")),
    ),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("users"),
        _creationTime: v.number(),
        name: v.string(),
        username: v.optional(v.string()),
        email: v.string(),
        image: v.string(),
        avatarStoragePath: v.optional(v.string()),
        bio: v.optional(v.string()),
        tokenIdentifier: v.string(),
        externalId: v.optional(v.string()),
        role: v.union(v.literal("admin"), v.literal("user")),
        examAccess: v.union(
          v.null(),
          v.object({
            expiresAt: v.number(),
            daysRemaining: v.number(),
          }),
        ),
        trainingAccess: v.union(
          v.null(),
          v.object({
            expiresAt: v.number(),
            daysRemaining: v.number(),
          }),
        ),
      }),
    ),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    const {
      paginationOpts,
      searchQuery,
      role,
      accessStatus,
      dateFrom,
      dateTo,
      sortBy = "name",
      sortOrder = "asc",
    } = args

    // Fetch users
    let users = await ctx.db.query("users").take(500)

    // Apply basic filters
    if (role) {
      users = users.filter((u) => u.role === role)
    }

    if (searchQuery?.trim()) {
      const query = searchQuery.toLowerCase().trim()
      users = users.filter(
        (u) =>
          u.name?.toLowerCase().includes(query) ||
          u.email?.toLowerCase().includes(query) ||
          u.username?.toLowerCase().includes(query),
      )
    }

    if (dateFrom) {
      users = users.filter((u) => u._creationTime >= dateFrom)
    }
    if (dateTo) {
      users = users.filter((u) => u._creationTime <= dateTo)
    }

    // Access status filtering requires joining with userAccess
    const accessMap: Map<
      string,
      { exam?: number; training?: number }
    > = new Map()

    {
      // Always fetch access for enrichment (needed for access badges in UI)
      const allAccess = await ctx.db.query("userAccess").take(2000)

      for (const access of allAccess) {
        const existing = accessMap.get(access.userId) || {}
        existing[access.accessType] = access.expiresAt
        accessMap.set(access.userId, existing)
      }

      if (accessStatus) {
        const now = Date.now()
        const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000

        users = users.filter((user) => {
          const access = accessMap.get(user._id)

          switch (accessStatus) {
            case "active":
              return (
                access &&
                ((access.exam && access.exam > now) ||
                  (access.training && access.training > now))
              )
            case "expiring":
              return (
                access &&
                ((access.exam &&
                  access.exam > now &&
                  access.exam < sevenDaysFromNow) ||
                  (access.training &&
                    access.training > now &&
                    access.training < sevenDaysFromNow))
              )
            case "expired":
              return (
                access &&
                (!access.exam || access.exam <= now) &&
                (!access.training || access.training <= now) &&
                (access.exam || access.training)
              )
            case "never":
              return !access
            default:
              return true
          }
        })
      }
    }

    // Sort
    users = users.toSorted((a, b) => {
      let valueA: string | number
      let valueB: string | number

      if (sortBy === "_creationTime") {
        valueA = a._creationTime
        valueB = b._creationTime
      } else if (sortBy === "role") {
        valueA = a.role || "user"
        valueB = b.role || "user"
      } else {
        valueA = a.name || ""
        valueB = b.name || ""
      }

      if (typeof valueA === "string" && typeof valueB === "string") {
        valueA = valueA.toLowerCase()
        valueB = valueB.toLowerCase()
      }

      const comparison = valueA < valueB ? -1 : valueA > valueB ? 1 : 0
      return sortOrder === "desc" ? -comparison : comparison
    })

    // Paginate
    const startIndex = paginationOpts.cursor
      ? parseInt(paginationOpts.cursor, 10)
      : 0
    const endIndex = startIndex + paginationOpts.numItems
    const pageResults = users.slice(startIndex, endIndex)

    // Enrich with access status
    const now = Date.now()
    const enrichedResults = pageResults.map((user) => {
      const access = accessMap.get(user._id)
      return {
        ...user,
        examAccess:
          access?.exam && access.exam > now
            ? {
                expiresAt: access.exam,
                daysRemaining: Math.ceil(
                  (access.exam - now) / (24 * 60 * 60 * 1000),
                ),
              }
            : null,
        trainingAccess:
          access?.training && access.training > now
            ? {
                expiresAt: access.training,
                daysRemaining: Math.ceil(
                  (access.training - now) / (24 * 60 * 60 * 1000),
                ),
              }
            : null,
      }
    })

    return {
      page: enrichedResults,
      continueCursor: endIndex < users.length ? endIndex.toString() : "",
      isDone: endIndex >= users.length,
    }
  },
})

/**
 * [Admin] Données complètes pour le panel utilisateur
 */
export const getUserPanelData = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      user: v.object({
        _id: v.id("users"),
        _creationTime: v.number(),
        name: v.string(),
        username: v.optional(v.string()),
        email: v.string(),
        image: v.string(),
        avatarStoragePath: v.optional(v.string()),
        bio: v.optional(v.string()),
        tokenIdentifier: v.string(),
        externalId: v.optional(v.string()),
        role: v.union(v.literal("admin"), v.literal("user")),
      }),
      examAccess: v.union(
        v.null(),
        v.object({
          expiresAt: v.number(),
          daysRemaining: v.number(),
          isActive: v.boolean(),
        }),
      ),
      trainingAccess: v.union(
        v.null(),
        v.object({
          expiresAt: v.number(),
          daysRemaining: v.number(),
          isActive: v.boolean(),
        }),
      ),
      recentTransactions: v.array(
        v.object({
          _id: v.id("transactions"),
          _creationTime: v.number(),
          userId: v.id("users"),
          productId: v.id("products"),
          type: v.union(v.literal("stripe"), v.literal("manual")),
          status: v.union(
            v.literal("pending"),
            v.literal("completed"),
            v.literal("failed"),
            v.literal("refunded"),
          ),
          amountPaid: v.number(),
          currency: v.union(v.literal("CAD"), v.literal("XAF")),
          stripeSessionId: v.optional(v.string()),
          stripePaymentIntentId: v.optional(v.string()),
          stripeEventId: v.optional(v.string()),
          paymentMethod: v.optional(v.string()),
          recordedBy: v.optional(v.id("users")),
          notes: v.optional(v.string()),
          accessType: v.union(v.literal("exam"), v.literal("training")),
          durationDays: v.number(),
          accessExpiresAt: v.number(),
          createdAt: v.number(),
          completedAt: v.optional(v.number()),
          product: v.union(
            v.null(),
            v.object({
              _id: v.id("products"),
              _creationTime: v.number(),
              code: v.union(
                v.literal("exam_access"),
                v.literal("training_access"),
                v.literal("exam_access_promo"),
                v.literal("training_access_promo"),
                v.literal("premium_access"),
              ),
              name: v.string(),
              description: v.string(),
              priceCAD: v.number(),
              durationDays: v.number(),
              accessType: v.union(v.literal("exam"), v.literal("training")),
              stripeProductId: v.string(),
              stripePriceId: v.string(),
              isActive: v.boolean(),
              isCombo: v.optional(v.boolean()),
            }),
          ),
        }),
      ),
      totalTransactionCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    const user = await ctx.db.get(args.userId)
    if (!user) return null

    // Fetch access records, recent transactions, and total count in parallel
    const [accessRecords, recentTransactions, allUserTransactions] =
      await Promise.all([
        ctx.db
          .query("userAccess")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId))
          .take(10),
        ctx.db
          .query("transactions")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId))
          .order("desc")
          .take(5),
        ctx.db
          .query("transactions")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId))
          .take(100),
      ])

    // Get product details for transactions using batch fetch
    const productIds = recentTransactions.map((tx) => tx.productId)
    const productMap = await batchGetByIds(ctx, "products", productIds)

    const enrichedTransactions = recentTransactions.map((tx) => ({
      ...tx,
      product: productMap.get(tx.productId) ?? null,
    }))

    const now = Date.now()
    const examAccess = accessRecords.find((a) => a.accessType === "exam")
    const trainingAccess = accessRecords.find(
      (a) => a.accessType === "training",
    )

    return {
      user,
      examAccess: examAccess
        ? {
            expiresAt: examAccess.expiresAt,
            daysRemaining: Math.ceil(
              (examAccess.expiresAt - now) / (24 * 60 * 60 * 1000),
            ),
            isActive: examAccess.expiresAt > now,
          }
        : null,
      trainingAccess: trainingAccess
        ? {
            expiresAt: trainingAccess.expiresAt,
            daysRemaining: Math.ceil(
              (trainingAccess.expiresAt - now) / (24 * 60 * 60 * 1000),
            ),
            isActive: trainingAccess.expiresAt > now,
          }
        : null,
      recentTransactions: enrichedTransactions,
      totalTransactionCount: allUserTransactions.length,
    }
  },
})

/**
 * [Admin] Récupère les utilisateurs avec un accès exam actif
 * Utilisé pour afficher les candidats éligibles aux examens
 */
export const getUsersWithActiveExamAccess = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      user: v.object({
        _id: v.id("users"),
        name: v.string(),
        email: v.string(),
        image: v.string(),
        username: v.optional(v.string()),
      }),
      expiresAt: v.number(),
      daysRemaining: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    const now = Date.now()
    const limit = args.limit ?? 100

    // Get all active access records (filter by expiry)
    const activeAccess = await ctx.db
      .query("userAccess")
      .withIndex("by_expiresAt", (q) => q.gt("expiresAt", now))
      .take(limit * 2) // Fetch extra to filter by type

    // Filter for exam access type
    const examAccess = activeAccess.filter((a) => a.accessType === "exam")

    // Get unique user IDs
    const userIds = [...new Set(examAccess.map((a) => a.userId))]
    const limitedUserIds = userIds.slice(0, limit)

    // Batch fetch users
    const usersMap = await batchGetByIds(ctx, "users", limitedUserIds)

    // Build result with user info and access details
    return examAccess
      .filter((access) => usersMap.has(access.userId))
      .slice(0, limit)
      .map((access) => {
        const user = usersMap.get(access.userId)!
        return {
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            image: user.image,
            username: user.username,
          },
          expiresAt: access.expiresAt,
          daysRemaining: Math.ceil(
            (access.expiresAt - now) / (1000 * 60 * 60 * 24),
          ),
        }
      })
  },
})

/**
 * [Admin] Compte le nombre d'utilisateurs avec un accès exam actif
 */
export const getActiveExamAccessCount = query({
  returns: v.number(),
  handler: async (ctx) => {
    await getAdminUserOrThrow(ctx)

    const now = Date.now()

    // Get all active access records
    const activeAccess = await ctx.db
      .query("userAccess")
      .withIndex("by_expiresAt", (q) => q.gt("expiresAt", now))
      .take(1000)

    // Count exam access only
    return activeAccess.filter((a) => a.accessType === "exam").length
  },
})

/**
 * Récupère l'accès de l'utilisateur courant pour un type donné
 */
export const getMyAccess = query({
  args: {
    accessType: v.union(v.literal("exam"), v.literal("training")),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("userAccess"),
      _creationTime: v.number(),
      userId: v.id("users"),
      accessType: v.union(v.literal("exam"), v.literal("training")),
      expiresAt: v.number(),
      lastTransactionId: v.id("transactions"),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return null
    }

    const access = await ctx.db
      .query("userAccess")
      .withIndex("by_userId_accessType", (q) =>
        q.eq("userId", user._id).eq("accessType", args.accessType),
      )
      .unique()

    return access
  },
})
