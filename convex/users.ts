import { UserJSON } from "@clerk/backend"
import { paginationOptsValidator } from "convex/server"
import { Validator, v } from "convex/values"
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

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> }, // Vient de Clerk
  async handler(ctx, { data }) {
    const firstName = data.first_name?.trim() || ""
    const lastName = data.last_name?.trim() || ""
    const fullName = `${firstName} ${lastName}`.trim() || "Utilisateur"

    const baseAttributes = {
      externalId: data.id,
      tokenIdentifier: `${process.env.NEXT_PUBLIC_CLERK_FRONTEND_API_URL}|${data.id}`,
      name: fullName,
      email: data.email_addresses[0]?.email_address,
      image: data.image_url,
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
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      image: args.avatarUrl,
      avatarStoragePath: args.avatarStoragePath,
    })
  },
})

export const getUsersWithPagination = query({
  args: {
    paginationOpts: paginationOptsValidator,
    sortBy: v.optional(
      v.union(v.literal("name"), v.literal("role"), v.literal("_creationTime")),
    ),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const {
      paginationOpts,
      sortBy = "name",
      sortOrder = "asc",
      searchQuery,
    } = args

    // Limit to 500 users for in-memory filtering
    // For production with 1000+ users, consider implementing full-text search
    let users = await ctx.db.query("users").take(500)

    // Filter by search query if provided
    if (searchQuery && searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim()
      users = users.filter(
        (user) =>
          user.name?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query) ||
          user.username?.toLowerCase().includes(query),
      )
    }

    // Sort users based on criteria
    users.sort((a, b) => {
      let valueA: string | number
      let valueB: string | number

      if (sortBy === "_creationTime") {
        valueA = a._creationTime
        valueB = b._creationTime
      } else if (sortBy === "role") {
        valueA = a.role || "user"
        valueB = b.role || "user"
      } else {
        valueA = a[sortBy as keyof typeof a] || ""
        valueB = b[sortBy as keyof typeof b] || ""
      }

      if (typeof valueA === "string" && typeof valueB === "string") {
        valueA = valueA.toLowerCase()
        valueB = valueB.toLowerCase()
      }

      if (sortOrder === "desc") {
        return valueA < valueB ? 1 : valueA > valueB ? -1 : 0
      } else {
        return valueA > valueB ? 1 : valueA < valueB ? -1 : 0
      }
    })

    // Manual cursor-based pagination for sorted/filtered results
    const startIndex = paginationOpts.cursor
      ? parseInt(paginationOpts.cursor, 10)
      : 0
    const endIndex = startIndex + paginationOpts.numItems
    const pageResults = users.slice(startIndex, endIndex)
    const hasMore = endIndex < users.length

    return {
      page: pageResults,
      continueCursor: hasMore ? endIndex.toString() : "",
      isDone: !hasMore,
    }
  },
})

// Récupérer les statistiques pour le dashboard admin
// Note: For scale, consider creating adminStats aggregation table like questionStats
export const getAdminStats = query({
  args: {},
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

    if (accessStatus || true) {
      // Always fetch access for enrichment
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
    users.sort((a, b) => {
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
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    const user = await ctx.db.get(args.userId)
    if (!user) return null

    // Fetch access records (limited - max 2 access types)
    const accessRecords = await ctx.db
      .query("userAccess")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(10)

    // Fetch recent transactions
    const recentTransactions = await ctx.db
      .query("transactions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(5)

    // Fetch total transaction count (limited for performance)
    const allUserTransactions = await ctx.db
      .query("transactions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(100)

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
