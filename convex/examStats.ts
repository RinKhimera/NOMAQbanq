import { v } from "convex/values"
import { query } from "./_generated/server"
import { getAdminUserOrThrow, getCurrentUserOrNull } from "./lib/auth"
import { batchGetByIds } from "./lib/batchFetch"
import { Errors } from "./lib/errors"

// ============================================
// ADMIN STATS
// ============================================

/**
 * [Admin] Statistiques pour la page listing des examens
 */
export const getExamsStats = query({
  args: {},
  returns: v.object({
    total: v.number(),
    active: v.number(),
    upcoming: v.number(),
    past: v.number(),
    inactive: v.number(),
    eligibleCandidates: v.number(),
  }),
  handler: async (ctx) => {
    await getAdminUserOrThrow(ctx)

    const now = Date.now()

    // Fetch exams (limited for performance)
    const exams = await ctx.db.query("exams").take(500)

    // Calculate exam stats
    const total = exams.length
    const active = exams.filter(
      (e) => e.isActive && e.startDate <= now && e.endDate >= now,
    ).length
    const upcoming = exams.filter((e) => e.isActive && e.startDate > now).length
    const past = exams.filter((e) => e.endDate < now).length
    const inactive = exams.filter((e) => !e.isActive).length

    // Get eligible candidates count (users with active exam access)
    const activeAccess = await ctx.db
      .query("userAccess")
      .withIndex("by_expiresAt", (q) => q.gt("expiresAt", now))
      .take(1000)

    const eligibleCandidates = activeAccess.filter(
      (a) => a.accessType === "exam",
    ).length

    return {
      total,
      active,
      upcoming,
      past,
      inactive,
      eligibleCandidates,
    }
  },
})

// ============================================
// LEADERBOARD
// ============================================

/**
 * Get exam leaderboard using normalized tables
 * Admin can always view; others can only view after exam ends and if they participated
 */
export const getExamLeaderboard = query({
  args: { examId: v.id("exams") },
  returns: v.array(
    v.object({
      participationId: v.id("examParticipations"),
      user: v.union(
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
      score: v.number(),
      completedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrNull(ctx)

    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      throw Errors.notFound("Examen")
    }

    // Authorization check
    if (currentUser?.role !== "admin") {
      const now = Date.now()
      // During exam, no leaderboard access for non-admins
      if (now < exam.endDate) {
        return []
      }

      // After exam ends: only users with exam access or those who participated can view
      if (currentUser) {
        // Fetch participation and access in parallel
        const [hasParticipated, userAccess] = await Promise.all([
          ctx.db
            .query("examParticipations")
            .withIndex("by_exam_user", (q) =>
              q.eq("examId", args.examId).eq("userId", currentUser._id),
            )
            .unique(),
          ctx.db
            .query("userAccess")
            .withIndex("by_userId_accessType", (q) =>
              q.eq("userId", currentUser._id).eq("accessType", "exam"),
            )
            .unique(),
        ])
        if (!hasParticipated) {
          // Check if user has active exam access
          const hasAccess = userAccess && userAccess.expiresAt > now
          if (!hasAccess) {
            return []
          }
        }
      } else {
        return []
      }
    }

    // Get participations for this exam (limited for performance)
    const participations = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam", (q) => q.eq("examId", args.examId))
      .take(500)

    // Filter to completed participations only
    const completedParticipations = participations.filter(
      (p) => p.status === "completed" || p.status === "auto_submitted",
    )

    // Batch fetch all users (deduplicated)
    const userIds = completedParticipations.map((p) => p.userId)
    const userMap = await batchGetByIds(ctx, "users", userIds)

    // Build leaderboard with cached user data
    const leaderboard = completedParticipations
      .map((participation) => ({
        participationId: participation._id,
        user: userMap.get(participation.userId) ?? null,
        score: participation.score,
        completedAt: participation.completedAt,
      }))
      .filter((entry) => entry.user !== null)

    // Sort by score descending
    return leaderboard.toSorted((a, b) => b.score - a.score)
  },
})

// ============================================
// USER DASHBOARD STATS
// ============================================

/**
 * Get user's dashboard stats using normalized tables
 */
export const getMyDashboardStats = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      availableExamsCount: v.number(),
      completedExamsCount: v.number(),
      averageScore: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return null
    }

    // Parallelize independent queries for better performance
    const [userAccess, myParticipations] = await Promise.all([
      ctx.db
        .query("userAccess")
        .withIndex("by_userId_accessType", (q) =>
          q.eq("userId", user._id).eq("accessType", "exam"),
        )
        .unique(),
      ctx.db
        .query("examParticipations")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(100),
    ])

    const now = Date.now()
    const hasExamAccess = userAccess && userAccess.expiresAt > now

    // Get all active exams if user has access (limited for performance)
    const allExams = hasExamAccess
      ? await ctx.db.query("exams").withIndex("by_isActive", (q) => q.eq("isActive", true)).take(200)
      : []

    const completedParticipations = myParticipations.filter(
      (p) => p.status === "completed" || p.status === "auto_submitted",
    )

    // Calculate average score
    let totalScore = 0
    const examCount = completedParticipations.length

    completedParticipations.forEach((p) => {
      totalScore += p.score
    })

    const averageScore = examCount > 0 ? Math.round(totalScore / examCount) : 0

    return {
      availableExamsCount: allExams.length,
      completedExamsCount: examCount,
      averageScore,
    }
  },
})

/**
 * Get user's recent exams using normalized tables
 */
export const getMyRecentExams = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("exams"),
      title: v.string(),
      startDate: v.number(),
      endDate: v.number(),
      isCompleted: v.boolean(),
      score: v.union(v.null(), v.number()),
      completedAt: v.union(v.null(), v.number()),
    }),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return []
    }

    // Parallelize independent queries for better performance
    const [myParticipations, userAccess] = await Promise.all([
      ctx.db
        .query("examParticipations")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(50),
      ctx.db
        .query("userAccess")
        .withIndex("by_userId_accessType", (q) =>
          q.eq("userId", user._id).eq("accessType", "exam"),
        )
        .unique(),
    ])

    const now = Date.now()
    const hasExamAccess = userAccess && userAccess.expiresAt > now

    // Get active exams if user has access (limited for performance)
    const allExams = hasExamAccess
      ? await ctx.db.query("exams").withIndex("by_isActive", (q) => q.eq("isActive", true)).take(200)
      : []

    // Create participation lookup map
    const participationMap = new Map(myParticipations.map((p) => [p.examId, p]))

    // Map exams to include participation data
    const userExams = allExams
      .map((exam) => {
        const participation = participationMap.get(exam._id)
        const isCompleted =
          participation?.status === "completed" ||
          participation?.status === "auto_submitted"
        return {
          _id: exam._id,
          title: exam.title,
          startDate: exam.startDate,
          endDate: exam.endDate,
          isCompleted,
          score: isCompleted ? (participation?.score ?? null) : null,
          completedAt: participation?.completedAt ?? null,
        }
      })
      // .sort() intentionnel : .map() crée déjà un nouveau tableau, .toSorted() ferait une copie inutile
      .sort((a, b) => {
        if (a.completedAt && b.completedAt) {
          return b.completedAt - a.completedAt
        }
        if (a.completedAt && !b.completedAt) return -1
        if (!a.completedAt && b.completedAt) return 1
        return b.startDate - a.startDate
      })
      .slice(0, 5)

    return userExams
  },
})

/**
 * Get all exams with current user's participation status
 * Used by examen-blanc page to show exam list with "already taken" status
 */
export const getAllExamsWithUserParticipation = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("exams"),
      _creationTime: v.number(),
      title: v.string(),
      description: v.optional(v.string()),
      startDate: v.number(),
      endDate: v.number(),
      questionIds: v.array(v.id("questions")),
      completionTime: v.number(),
      enablePause: v.optional(v.boolean()),
      pauseDurationMinutes: v.optional(v.number()),
      isActive: v.boolean(),
      createdBy: v.id("users"),
      userHasTaken: v.boolean(),
      userParticipation: v.union(
        v.null(),
        v.object({
          status: v.optional(
            v.union(
              v.literal("in_progress"),
              v.literal("completed"),
              v.literal("auto_submitted"),
            ),
          ),
          score: v.number(),
          completedAt: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    // Limit to 100 exams for performance
    const exams = await ctx.db.query("exams").order("desc").take(100)

    if (!user) {
      return exams.map((exam) => ({
        ...exam,
        userHasTaken: false,
        userParticipation: null,
      }))
    }

    // Get user's participations in a single query (limited for performance)
    const userParticipations = await ctx.db
      .query("examParticipations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(100)

    // Create a map for O(1) lookup
    const participationMap = new Map(
      userParticipations.map((p) => [p.examId, p]),
    )

    return exams.map((exam) => {
      const participation = participationMap.get(exam._id)

      return {
        ...exam,
        userHasTaken:
          participation?.status === "completed" ||
          participation?.status === "auto_submitted",
        userParticipation: participation
          ? {
              status: participation.status,
              score: participation.score,
              completedAt: participation.completedAt,
            }
          : null,
      }
    })
  },
})

/**
 * Get user's score history for dashboard chart
 * Returns the last 10 completed exams with their scores
 */
export const getMyScoreHistory = query({
  args: {},
  returns: v.array(
    v.object({
      examId: v.id("exams"),
      examTitle: v.string(),
      score: v.number(),
      completedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return []
    }

    // Get user's participations (limited for performance)
    const participations = await ctx.db
      .query("examParticipations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(50)

    // Filter completed participations and sort by completion date
    const completedParticipations = participations
      .filter((p) => p.status === "completed" || p.status === "auto_submitted")
      .filter((p) => p.completedAt !== undefined)
      .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))
      .slice(-10)

    // Batch fetch exam titles
    const examIds = completedParticipations.map((p) => p.examId)
    const examMap = await batchGetByIds(ctx, "exams", examIds)

    const results = completedParticipations.map((p) => {
      const exam = examMap.get(p.examId)
      return {
        examId: p.examId,
        examTitle: exam?.title ?? "Examen",
        score: p.score,
        completedAt: p.completedAt ?? 0,
      }
    })

    return results
  },
})
