import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getCurrentUserOrNull, getCurrentUserOrThrow } from "./lib/auth"
import { Errors } from "./lib/errors"

// ============================================
// PAUSE STATE MACHINE
// ============================================
// Valid pause phase transitions:
//   undefined -> "before_pause" (on exam start with pause enabled)
//   "before_pause" -> "during_pause" (user starts pause)
//   "during_pause" -> "after_pause" (user resumes from pause)
//
// Once in "after_pause", no further transitions are allowed.

type PausePhase = "before_pause" | "during_pause" | "after_pause" | undefined

const PAUSE_TRANSITIONS: Record<string, readonly string[]> = {
  before_pause: ["during_pause"],
  during_pause: ["after_pause"],
  after_pause: [], // terminal state
}

/**
 * Validates that a pause phase transition is allowed
 * @throws Error if the transition is invalid
 */
export const validatePauseTransition = (
  current: PausePhase,
  target: "during_pause" | "after_pause",
): void => {
  const currentKey = current ?? "undefined"
  const allowedTransitions = PAUSE_TRANSITIONS[current ?? ""] || []

  if (!allowedTransitions.includes(target)) {
    const errorMessages: Record<string, string> = {
      during_pause: "La pause ne peut être démarrée qu'une seule fois",
      after_pause: "Vous n'êtes pas actuellement en pause",
    }
    throw Errors.invalidState(
      errorMessages[target] ||
        `Transition invalide: ${currentKey} -> ${target}`,
    )
  }
}

/**
 * Start pause using normalized tables
 */
export const startPause = mutation({
  args: {
    examId: v.id("exams"),
    manualTrigger: v.optional(v.boolean()),
  },
  returns: v.object({
    pauseStartedAt: v.number(),
    pauseDurationMinutes: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      throw Errors.notFound("Examen")
    }

    if (!exam.enablePause) {
      throw Errors.invalidState("La pause n'est pas activée pour cet examen")
    }

    const participation = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam_user", (q) =>
        q.eq("examId", args.examId).eq("userId", user._id),
      )
      .unique()

    if (!participation) {
      throw Errors.notFound("Participation")
    }

    if (participation.status !== "in_progress") {
      throw Errors.invalidState("L'examen n'est pas en cours")
    }

    // Validate state machine transition (before_pause -> during_pause)
    validatePauseTransition(participation.pausePhase, "during_pause")

    const now = Date.now()

    if (!args.manualTrigger) {
      if (!participation.startedAt) {
        throw Errors.invalidState("L'examen n'a pas encore été démarré")
      }
      const elapsedTime = now - participation.startedAt
      const totalTime = exam.completionTime * 1000
      const halfTime = totalTime / 2

      if (elapsedTime < halfTime - 10000) {
        throw Errors.invalidState(
          "La pause automatique ne peut être déclenchée qu'à la mi-parcours du chronomètre",
        )
      }
    }

    await ctx.db.patch(participation._id, {
      pausePhase: "during_pause",
      pauseStartedAt: now,
    })

    return {
      pauseStartedAt: now,
      pauseDurationMinutes: exam.pauseDurationMinutes || 15,
    }
  },
})

/**
 * Resume from pause using normalized tables
 */
export const resumeFromPause = mutation({
  args: {
    examId: v.id("exams"),
  },
  returns: v.object({
    pauseEndedAt: v.number(),
    isPauseCutShort: v.boolean(),
    totalPauseDurationMs: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      throw Errors.notFound("Examen")
    }

    const participation = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam_user", (q) =>
        q.eq("examId", args.examId).eq("userId", user._id),
      )
      .unique()

    if (!participation) {
      throw Errors.notFound("Participation")
    }

    if (participation.status !== "in_progress") {
      throw Errors.invalidState("L'examen n'est pas en cours")
    }

    // Validate state machine transition (during_pause -> after_pause)
    validatePauseTransition(participation.pausePhase, "after_pause")

    const now = Date.now()
    const pauseStartedAt = participation.pauseStartedAt || now
    const pauseDurationMs = (exam.pauseDurationMinutes || 15) * 60 * 1000
    const pauseEndTime = pauseStartedAt + pauseDurationMs

    const isPauseCutShort = now < pauseEndTime
    const actualPauseDurationMs = now - pauseStartedAt

    await ctx.db.patch(participation._id, {
      pausePhase: "after_pause",
      pauseEndedAt: now,
      isPauseCutShort,
      totalPauseDurationMs: actualPauseDurationMs,
    })

    return {
      pauseEndedAt: now,
      isPauseCutShort,
      totalPauseDurationMs: actualPauseDurationMs,
    }
  },
})

/**
 * Get pause status using normalized tables
 */
export const getPauseStatus = query({
  args: {
    examId: v.id("exams"),
  },
  returns: v.union(
    v.null(),
    v.object({
      enablePause: v.boolean(),
      pauseDurationMinutes: v.number(),
      pausePhase: v.optional(
        v.union(
          v.literal("before_pause"),
          v.literal("during_pause"),
          v.literal("after_pause"),
        ),
      ),
      pauseStartedAt: v.optional(v.number()),
      pauseEndedAt: v.optional(v.number()),
      isPauseCutShort: v.optional(v.boolean()),
      totalQuestions: v.number(),
      midpoint: v.number(),
      questionsBeforePause: v.number(),
      questionsAfterPause: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return null
    }

    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      return null
    }

    const participation = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam_user", (q) =>
        q.eq("examId", args.examId).eq("userId", user._id),
      )
      .unique()

    if (!participation) {
      return null
    }

    const totalQuestions = exam.questionIds.length
    const midpoint = Math.floor(totalQuestions / 2)

    return {
      enablePause: exam.enablePause ?? false,
      pauseDurationMinutes: exam.pauseDurationMinutes ?? 15,
      pausePhase: participation.pausePhase,
      pauseStartedAt: participation.pauseStartedAt,
      pauseEndedAt: participation.pauseEndedAt,
      isPauseCutShort: participation.isPauseCutShort,
      totalQuestions,
      midpoint,
      questionsBeforePause: midpoint,
      questionsAfterPause: totalQuestions - midpoint,
    }
  },
})

/**
 * Validate question access using normalized tables
 */
export const validateQuestionAccess = query({
  args: {
    examId: v.id("exams"),
    questionIndex: v.number(),
  },
  returns: v.object({
    allowed: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return { allowed: false, reason: "Non authentifié" }
    }

    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      return { allowed: false, reason: "Examen non trouvé" }
    }

    if (!exam.enablePause) {
      return { allowed: true }
    }

    const participation = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam_user", (q) =>
        q.eq("examId", args.examId).eq("userId", user._id),
      )
      .unique()

    if (!participation) {
      return { allowed: false, reason: "Session non trouvée" }
    }

    const totalQuestions = exam.questionIds.length
    const midpoint = Math.floor(totalQuestions / 2)
    const questionIndex = args.questionIndex

    switch (participation.pausePhase) {
      case "before_pause":
        if (questionIndex >= midpoint) {
          return {
            allowed: false,
            reason:
              "Cette question sera déverrouillée après la pause obligatoire",
          }
        }
        return { allowed: true }

      case "during_pause":
        return {
          allowed: false,
          reason: "Questions verrouillées pendant la pause",
        }

      case "after_pause":
        return { allowed: true }

      default:
        return { allowed: true }
    }
  },
})
