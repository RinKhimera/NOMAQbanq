import { v } from "convex/values"

import { Id } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"

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
      .withIndex("by_exam_user", (q) => q.eq("examId", examId).eq("userId", userId))
      .unique()
  },
})

/**
 * Get all participations for an exam (admin view)
 */
export const getByExam = query({
  args: {
    examId: v.id("exams"),
  },
  handler: async (ctx, { examId }) => {
    return await ctx.db
      .query("examParticipations")
      .withIndex("by_exam", (q) => q.eq("examId", examId))
      .collect()
  },
})

/**
 * Get all participations for a user (user history)
 */
export const getByUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("examParticipations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
  },
})

/**
 * Get participation with its answers
 */
export const getWithAnswers = query({
  args: {
    participationId: v.id("examParticipations"),
  },
  handler: async (ctx, { participationId }) => {
    const participation = await ctx.db.get(participationId)
    if (!participation) return null

    const answers = await ctx.db
      .query("examAnswers")
      .withIndex("by_participation", (q) => q.eq("participationId", participationId))
      .collect()

    return { ...participation, answers }
  },
})

/**
 * Get answers for a participation
 */
export const getAnswers = query({
  args: {
    participationId: v.id("examParticipations"),
  },
  handler: async (ctx, { participationId }) => {
    return await ctx.db
      .query("examAnswers")
      .withIndex("by_participation", (q) => q.eq("participationId", participationId))
      .collect()
  },
})

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new participation (called when user starts exam)
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
        v.literal("after_pause")
      )
    ),
  },
  handler: async (ctx, { examId, userId, startedAt, pausePhase }) => {
    // Check if participation already exists
    const existing = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam_user", (q) => q.eq("examId", examId).eq("userId", userId))
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
 */
export const complete = mutation({
  args: {
    participationId: v.id("examParticipations"),
    score: v.number(),
    status: v.optional(
      v.union(v.literal("completed"), v.literal("auto_submitted"))
    ),
  },
  handler: async (ctx, { participationId, score, status }) => {
    await ctx.db.patch(participationId, {
      score,
      completedAt: Date.now(),
      status: status ?? "completed",
    })
  },
})

/**
 * Update pause phase (for exams with pause functionality)
 */
export const updatePausePhase = mutation({
  args: {
    participationId: v.id("examParticipations"),
    pausePhase: v.union(
      v.literal("before_pause"),
      v.literal("during_pause"),
      v.literal("after_pause")
    ),
    pauseStartedAt: v.optional(v.number()),
    pauseEndedAt: v.optional(v.number()),
    isPauseCutShort: v.optional(v.boolean()),
    totalPauseDurationMs: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { participationId, pausePhase, pauseStartedAt, pauseEndedAt, isPauseCutShort, totalPauseDurationMs }
  ) => {
    const updateData: Record<string, unknown> = { pausePhase }

    if (pauseStartedAt !== undefined) updateData.pauseStartedAt = pauseStartedAt
    if (pauseEndedAt !== undefined) updateData.pauseEndedAt = pauseEndedAt
    if (isPauseCutShort !== undefined) updateData.isPauseCutShort = isPauseCutShort
    if (totalPauseDurationMs !== undefined) updateData.totalPauseDurationMs = totalPauseDurationMs

    await ctx.db.patch(participationId, updateData)
  },
})

/**
 * Save a single answer (can be called multiple times during exam)
 */
export const saveAnswer = mutation({
  args: {
    participationId: v.id("examParticipations"),
    questionId: v.id("questions"),
    selectedAnswer: v.string(),
    isCorrect: v.boolean(),
  },
  handler: async (ctx, { participationId, questionId, selectedAnswer, isCorrect }) => {
    // Check if answer already exists for this question
    const existingAnswers = await ctx.db
      .query("examAnswers")
      .withIndex("by_participation", (q) => q.eq("participationId", participationId))
      .collect()

    const existing = existingAnswers.find((a) => a.questionId === questionId)

    if (existing) {
      // Update existing answer
      await ctx.db.patch(existing._id, {
        selectedAnswer,
        isCorrect,
      })
      return existing._id
    }

    // Create new answer
    return await ctx.db.insert("examAnswers", {
      participationId,
      questionId,
      selectedAnswer,
      isCorrect,
    })
  },
})

/**
 * Save multiple answers at once (called on exam submit)
 */
export const saveAnswersBatch = mutation({
  args: {
    participationId: v.id("examParticipations"),
    answers: v.array(
      v.object({
        questionId: v.id("questions"),
        selectedAnswer: v.string(),
        isCorrect: v.boolean(),
      })
    ),
  },
  handler: async (ctx, { participationId, answers }) => {
    // Get existing answers to avoid duplicates
    const existingAnswers = await ctx.db
      .query("examAnswers")
      .withIndex("by_participation", (q) => q.eq("participationId", participationId))
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
        })
        answerIds.push(existing._id)
      } else {
        // Create new
        const id = await ctx.db.insert("examAnswers", {
          participationId,
          questionId: answer.questionId,
          selectedAnswer: answer.selectedAnswer,
          isCorrect: answer.isCorrect,
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
    // Delete all answers first
    const answers = await ctx.db
      .query("examAnswers")
      .withIndex("by_participation", (q) => q.eq("participationId", participationId))
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
      .withIndex("by_exam_user", (q) => q.eq("examId", examId).eq("userId", userId))
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
      .withIndex("by_exam_user", (q) => q.eq("examId", examId).eq("userId", userId))
      .unique()

    return participation?.status === "completed" || participation?.status === "auto_submitted"
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
      (p) => p.status === "completed" || p.status === "auto_submitted"
    ).length
  },
})
