import { UserJSON } from "@clerk/backend"
import { paginationOptsValidator } from "convex/server"
import { Validator, v } from "convex/values"
import {
  QueryCtx,
  internalMutation,
  mutation,
  query,
} from "./_generated/server"
import {
  getAdminUserOrThrow,
  getCurrentUserOrNull,
  getCurrentUserOrThrow,
} from "./lib/auth"

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

    return await ctx.db.query("users").collect()
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

    let users = await ctx.db.query("users").collect()

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
export const getAdminStats = query({
  args: {},
  handler: async (ctx) => {
    await getAdminUserOrThrow(ctx)

    const allUsers = await ctx.db.query("users").collect()
    const totalUsers = allUsers.length

    const adminCount = allUsers.filter((u) => u.role === "admin").length
    const regularUserCount = allUsers.filter((u) => u.role === "user").length

    const allExams = await ctx.db.query("exams").collect()

    const allParticipations = await ctx.db.query("examParticipations").collect()
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
