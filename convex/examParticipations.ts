import { v } from "convex/values"
import { Id } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import {
  getAdminUserOrThrow,
  getCurrentUserOrThrow,
  getCurrentUserOrNull,
} from "./lib/auth"

// ============================================
// TYPES
// ============================================

export type ParticipationStatus = "in_progress" | "completed" | "auto_submitted"
export type PausePhase = "before_pause" | "during_pause" | "after_pause"

// ============================================
// QUERIES
// ============================================

/**
 * Get participation by exam and user (most common lookup)
 */
export const getByExamAndUser = query({
  args: {
    examId: v.id("exams"),
    userId: v.id("users"),
  },
  handler: async (ctx, { examId, userId }) => {
    return await ctx.db
      .query("examParticipations")
      .withIndex("by_exam_user", (q) =>
        q.eq("examId", examId).eq("userId", userId),
      )
      .unique()
  },
})

/**
 * Get all participations for an exam (admin only)
 */
export const getByExam = query({
  args: {
    examId: v.id("exams"),
  },
  handler: async (ctx, { examId }) => {
    // Only admins can view all participations for an exam
    const user = await getCurrentUserOrNull(ctx)
    if (!user || user.role !== "admin") {
      return []
    }

    return await ctx.db
      .query("examParticipations")
      .withIndex("by_exam", (q) => q.eq("examId", examId))
      .collect()
  },
})

/**
 * Get all participations for a user (user history)
 * Users can only view their own history; admins can view anyone's
 */
export const getByUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const currentUser = await getCurrentUserOrNull(ctx)
    if (!currentUser) {
      return []
    }

    // Users can only view their own history; admins can view anyone's
    if (currentUser.role !== "admin" && currentUser._id !== userId) {
      return []
    }

    return await ctx.db
      .query("examParticipations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
  },
})

/**
 * Get participation with its answers
 * Users can only view their own participation; admins can view any
 */
export const getWithAnswers = query({
  args: {
    participationId: v.id("examParticipations"),
  },
  handler: async (ctx, { participationId }) => {
    const currentUser = await getCurrentUserOrNull(ctx)
    if (!currentUser) return null

    const participation = await ctx.db.get(participationId)
    if (!participation) return null

    // Users can only view their own participation; admins can view any
    if (
      currentUser.role !== "admin" &&
      currentUser._id !== participation.userId
    ) {
      return null
    }

    const answers = await ctx.db
      .query("examAnswers")
      .withIndex("by_participation", (q) =>
        q.eq("participationId", participationId),
      )
      .collect()

    return { ...participation, answers }
  },
})

/**
 * Get answers for a participation
 * Users can only view their own answers; admins can view any
 */
export const getAnswers = query({
  args: {
    participationId: v.id("examParticipations"),
  },
  handler: async (ctx, { participationId }) => {
    const currentUser = await getCurrentUserOrNull(ctx)
    if (!currentUser) return []

    const participation = await ctx.db.get(participationId)
    if (!participation) return []

    // Users can only view their own answers; admins can view any
    if (
      currentUser.role !== "admin" &&
      currentUser._id !== participation.userId
    ) {
      return []
    }

    return await ctx.db
      .query("examAnswers")
      .withIndex("by_participation", (q) =>
        q.eq("participationId", participationId),
      )
      .collect()
  },
})

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new participation (called when user starts exam)
 * Users can only create their own participation; admins can create for anyone
 */
export const create = mutation({
  args: {
    examId: v.id("exams"),
    userId: v.id("users"),
    startedAt: v.optional(v.number()),
    pausePhase: v.optional(
      v.union(
        v.literal("before_pause"),
        v.literal("during_pause"),
        v.literal("after_pause"),
      ),
    ),
  },
  handler: async (ctx, { examId, userId, startedAt, pausePhase }) => {
    // Verify user can create this participation
    const currentUser = await getCurrentUserOrThrow(ctx)
    if (currentUser._id !== userId && currentUser.role !== "admin") {
      throw new Error(
        "Vous ne pouvez pas créer une participation pour un autre utilisateur",
      )
    }

    // Check if participation already exists
    const existing = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam_user", (q) =>
        q.eq("examId", examId).eq("userId", userId),
      )
      .unique()

    if (existing) {
      return existing._id
    }

    const participationId = await ctx.db.insert("examParticipations", {
      examId,
      userId,
      score: 0,
      completedAt: 0,
      startedAt: startedAt ?? Date.now(),
      status: "in_progress",
      pausePhase,
    })

    return participationId
  },
})

/**
 * Update participation status and score (called on exam submit)
 * Only the owner or admin can complete a participation
 */
export const complete = mutation({
  args: {
    participationId: v.id("examParticipations"),
    score: v.number(),
    status: v.optional(
      v.union(v.literal("completed"), v.literal("auto_submitted")),
    ),
  },
  handler: async (ctx, { participationId, score, status }) => {
    // Verify ownership
    const currentUser = await getCurrentUserOrThrow(ctx)
    const participation = await ctx.db.get(participationId)

    if (!participation) {
      throw new Error("Participation non trouvée")
    }

    if (
      participation.userId !== currentUser._id &&
      currentUser.role !== "admin"
    ) {
      throw new Error("Vous ne pouvez pas modifier cette participation")
    }

    // Validate score range
    if (score < 0 || score > 100) {
      throw new Error("Le score doit être entre 0 et 100")
    }

    await ctx.db.patch(participationId, {
      score,
      completedAt: Date.now(),
      status: status ?? "completed",
    })
  },
})

/**
 * Update pause phase (for exams with pause functionality)
 * Only the owner can update their pause phase
 */
export const updatePausePhase = mutation({
  args: {
    participationId: v.id("examParticipations"),
    pausePhase: v.union(
      v.literal("before_pause"),
      v.literal("during_pause"),
      v.literal("after_pause"),
    ),
    pauseStartedAt: v.optional(v.number()),
    pauseEndedAt: v.optional(v.number()),
    isPauseCutShort: v.optional(v.boolean()),
    totalPauseDurationMs: v.optional(v.number()),
  },
  handler: async (
    ctx,
    {
      participationId,
      pausePhase,
      pauseStartedAt,
      pauseEndedAt,
      isPauseCutShort,
      totalPauseDurationMs,
    },
  ) => {
    // Verify ownership
    const currentUser = await getCurrentUserOrThrow(ctx)
    const participation = await ctx.db.get(participationId)

    if (!participation) {
      throw new Error("Participation non trouvée")
    }

    if (participation.userId !== currentUser._id) {
      throw new Error("Vous ne pouvez pas modifier cette participation")
    }

    const updateData: Record<string, unknown> = { pausePhase }

    if (pauseStartedAt !== undefined) updateData.pauseStartedAt = pauseStartedAt
    if (pauseEndedAt !== undefined) updateData.pauseEndedAt = pauseEndedAt
    if (isPauseCutShort !== undefined)
      updateData.isPauseCutShort = isPauseCutShort
    if (totalPauseDurationMs !== undefined)
      updateData.totalPauseDurationMs = totalPauseDurationMs

    await ctx.db.patch(participationId, updateData)
  },
})

/**
 * Save a single answer (can be called multiple times during exam)
 * Only the owner can save answers to their participation
 */
export const saveAnswer = mutation({
  args: {
    participationId: v.id("examParticipations"),
    questionId: v.id("questions"),
    selectedAnswer: v.string(),
    isCorrect: v.boolean(),
    isFlagged: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { participationId, questionId, selectedAnswer, isCorrect, isFlagged },
  ) => {
    // Verify ownership
    const currentUser = await getCurrentUserOrThrow(ctx)
    const participation = await ctx.db.get(participationId)

    if (!participation) {
      throw new Error("Participation non trouvée")
    }

    if (participation.userId !== currentUser._id) {
      throw new Error("Vous ne pouvez pas modifier cette participation")
    }

    if (participation.status !== "in_progress") {
      throw new Error("Cette participation n'est plus modifiable")
    }

    // Check if answer already exists for this question
    const existingAnswers = await ctx.db
      .query("examAnswers")
      .withIndex("by_participation", (q) =>
        q.eq("participationId", participationId),
      )
      .collect()

    const existing = existingAnswers.find((a) => a.questionId === questionId)

    if (existing) {
      // Update existing answer
      await ctx.db.patch(existing._id, {
        selectedAnswer,
        isCorrect,
        isFlagged: isFlagged ?? existing.isFlagged,
      })
      return existing._id
    }

    // Create new answer
    return await ctx.db.insert("examAnswers", {
      participationId,
      questionId,
      selectedAnswer,
      isCorrect,
      isFlagged: isFlagged ?? false,
    })
  },
})

/**
 * Save multiple answers at once (called on exam submit)
 * Only the owner can save answers to their participation
 */
export const saveAnswersBatch = mutation({
  args: {
    participationId: v.id("examParticipations"),
    answers: v.array(
      v.object({
        questionId: v.id("questions"),
        selectedAnswer: v.string(),
        isCorrect: v.boolean(),
        isFlagged: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, { participationId, answers }) => {
    // Verify ownership
    const currentUser = await getCurrentUserOrThrow(ctx)
    const participation = await ctx.db.get(participationId)

    if (!participation) {
      throw new Error("Participation non trouvée")
    }

    if (participation.userId !== currentUser._id) {
      throw new Error("Vous ne pouvez pas modifier cette participation")
    }

    if (participation.status !== "in_progress") {
      throw new Error("Cette participation n'est plus modifiable")
    }

    // Get existing answers to avoid duplicates
    const existingAnswers = await ctx.db
      .query("examAnswers")
      .withIndex("by_participation", (q) =>
        q.eq("participationId", participationId),
      )
      .collect()

    const existingMap = new Map(existingAnswers.map((a) => [a.questionId, a]))

    const answerIds: Id<"examAnswers">[] = []

    for (const answer of answers) {
      const existing = existingMap.get(answer.questionId)

      if (existing) {
        // Update existing
        await ctx.db.patch(existing._id, {
          selectedAnswer: answer.selectedAnswer,
          isCorrect: answer.isCorrect,
          isFlagged: answer.isFlagged ?? false,
        })
        answerIds.push(existing._id)
      } else {
        // Create new
        const id = await ctx.db.insert("examAnswers", {
          participationId,
          questionId: answer.questionId,
          selectedAnswer: answer.selectedAnswer,
          isCorrect: answer.isCorrect,
          isFlagged: answer.isFlagged ?? false,
        })
        answerIds.push(id)
      }
    }

    return answerIds
  },
})

/**
 * Delete a participation and all its answers (admin only)
 */
export const deleteParticipation = mutation({
  args: {
    participationId: v.id("examParticipations"),
  },
  handler: async (ctx, { participationId }) => {
    // Only admins can delete participations
    await getAdminUserOrThrow(ctx)

    // Delete all answers first
    const answers = await ctx.db
      .query("examAnswers")
      .withIndex("by_participation", (q) =>
        q.eq("participationId", participationId),
      )
      .collect()

    for (const answer of answers) {
      await ctx.db.delete(answer._id)
    }

    // Delete participation
    await ctx.db.delete(participationId)
  },
})

// ============================================
// HELPERS (internal use)
// ============================================

/**
 * Check if user has started an exam
 */
export const hasUserStartedExam = query({
  args: {
    examId: v.id("exams"),
    userId: v.id("users"),
  },
  handler: async (ctx, { examId, userId }) => {
    const participation = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam_user", (q) =>
        q.eq("examId", examId).eq("userId", userId),
      )
      .unique()

    return participation !== null
  },
})

/**
 * Check if user has completed an exam
 */
export const hasUserCompletedExam = query({
  args: {
    examId: v.id("exams"),
    userId: v.id("users"),
  },
  handler: async (ctx, { examId, userId }) => {
    const participation = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam_user", (q) =>
        q.eq("examId", examId).eq("userId", userId),
      )
      .unique()

    return (
      participation?.status === "completed" ||
      participation?.status === "auto_submitted"
    )
  },
})

/**
 * Get participation count for an exam
 */
export const getParticipationCount = query({
  args: {
    examId: v.id("exams"),
  },
  handler: async (ctx, { examId }) => {
    const participations = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam", (q) => q.eq("examId", examId))
      .collect()

    return participations.length
  },
})

/**
 * Get completed participation count for an exam
 */
export const getCompletedCount = query({
  args: {
    examId: v.id("exams"),
  },
  handler: async (ctx, { examId }) => {
    const participations = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam", (q) => q.eq("examId", examId))
      .collect()

    return participations.filter(
      (p) => p.status === "completed" || p.status === "auto_submitted",
    ).length
  },
})
