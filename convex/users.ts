import { UserJSON } from "@clerk/backend"
import { Validator, v } from "convex/values"
import {
  QueryCtx,
  internalMutation,
  mutation,
  query,
} from "./_generated/server"

async function userByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("byExternalId", (q) => q.eq("externalId", externalId))
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
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Non authentifié")

    const tokenIdentifier = identity.tokenIdentifier
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier),
      )
      .unique()
    if (!user) throw new Error("Utilisateur introuvable")

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
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Utilisateur non authentifié")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique()

    if (!user || user.role !== "admin") {
      throw new Error("Accès non autorisé")
    }

    return await ctx.db.query("users").collect()
  },
})

export const getUsersWithPagination = query({
  args: {
    page: v.number(),
    limit: v.number(),
    sortBy: v.optional(
      v.union(v.literal("name"), v.literal("role"), v.literal("_creationTime")),
    ),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    const { page, limit, sortBy = "name", sortOrder = "asc" } = args
    const offset = (page - 1) * limit

    // Récupérer tous les utilisateurs
    const users = await ctx.db.query("users").collect()

    // Trier les utilisateurs
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

    const totalUsers = users.length
    const paginatedUsers = users.slice(offset, offset + limit)

    return {
      users: paginatedUsers,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page,
    }
  },
})

// Récupérer les statistiques pour le dashboard admin
export const getAdminStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Utilisateur non authentifié")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique()

    if (!user || user.role !== "admin") {
      throw new Error("Accès non autorisé")
    }

    // Récupérer tous les utilisateurs
    const allUsers = await ctx.db.query("users").collect()
    const totalUsers = allUsers.length

    // Compter les utilisateurs par rôle
    const adminCount = allUsers.filter((u) => u.role === "admin").length
    const regularUserCount = allUsers.filter((u) => u.role === "user").length

    // Récupérer tous les examens
    const allExams = await ctx.db.query("exams").collect()

    // Calculer le nombre total de participations aux examens
    const totalParticipations = allExams.reduce(
      (total, exam) => total + exam.participants.length,
      0,
    )

    // Récupérer les examens actifs
    const now = Date.now()
    const activeExams = allExams.filter(
      (exam) => exam.isActive && exam.startDate <= now && exam.endDate >= now,
    )

    return {
      totalUsers,
      adminCount,
      regularUserCount,
      totalExams: allExams.length,
      activeExams: activeExams.length,
      totalParticipations,
    }
  },
})
