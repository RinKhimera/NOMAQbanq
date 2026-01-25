import { v } from "convex/values"
import { Id } from "./_generated/dataModel"
import { mutation } from "./_generated/server"
import { getAdminUserOrThrow, getCurrentUserOrThrow } from "./lib/auth"

// ============================================
// TYPES
// ============================================

export type ParticipationStatus =
  | "in_progress"
  | "completed"
  | "auto_submitted"
export type PausePhase = "before_pause" | "during_pause" | "after_pause"

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new participation (called when user starts exam)
 * Users always create their own participation; admins can optionally create for another user
 */
export const create = mutation({
  args: {
    examId: v.id("exams"),
    // Admin-only: create participation for another user
    forUserId: v.optional(v.id("users")),
    startedAt: v.optional(v.number()),
    pausePhase: v.optional(
      v.union(
        v.literal("before_pause"),
        v.literal("during_pause"),
        v.literal("after_pause"),
      ),
    ),
  },
  handler: async (ctx, { examId, forUserId, startedAt, pausePhase }) => {
    const currentUser = await getCurrentUserOrThrow(ctx)

    // Determine target user: admins can specify forUserId, others use their own ID
    let userId: Id<"users">
    if (forUserId) {
      if (currentUser.role !== "admin") {
        throw new Error(
          "Vous ne pouvez pas créer une participation pour un autre utilisateur",
        )
      }
      userId = forUserId
    } else {
      userId = currentUser._id
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
      .take(500)

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
      .take(500)

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
      .take(500)

    for (const answer of answers) {
      await ctx.db.delete(answer._id)
    }

    // Delete participation
    await ctx.db.delete(participationId)
  },
})
