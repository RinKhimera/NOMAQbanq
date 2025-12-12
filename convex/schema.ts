import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  users: defineTable({
    name: v.string(),
    username: v.optional(v.string()),
    email: v.string(),
    image: v.string(),
    bio: v.optional(v.string()),
    tokenIdentifier: v.string(),
    externalId: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("user")),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_username", ["username"])
    .index("byExternalId", ["externalId"])
    .index("by_role", ["role"]),

  questions: defineTable({
    question: v.string(),
    imageSrc: v.optional(v.string()),
    options: v.array(v.string()),
    correctAnswer: v.string(),
    explanation: v.string(),
    references: v.optional(v.array(v.string())),
    objectifCMC: v.string(),
    domain: v.string(),
  }).index("by_domain", ["domain"]),

  exams: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    questionIds: v.array(v.id("questions")),
    completionTime: v.number(),
    allowedParticipants: v.array(v.id("users")),
    enablePause: v.optional(v.boolean()),
    pauseDurationMinutes: v.optional(v.number()),
    participants: v.array(
      v.object({
        userId: v.id("users"),
        score: v.number(),
        completedAt: v.number(),
        startedAt: v.optional(v.number()),
        status: v.optional(
          v.union(
            v.literal("in_progress"),
            v.literal("completed"),
            v.literal("auto_submitted"),
          ),
        ),
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
        totalPauseDurationMs: v.optional(v.number()),
        answers: v.array(
          v.object({
            questionId: v.id("questions"),
            selectedAnswer: v.string(),
            isCorrect: v.boolean(),
          }),
        ),
      }),
    ),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_isActive", ["isActive"])
    .index("by_startDate", ["startDate"])
    .index("by_createdBy", ["createdBy"]),

  learningBankQuestions: defineTable({
    questionId: v.id("questions"),
    addedBy: v.id("users"),
    addedAt: v.number(),
    isActive: v.boolean(),
  })
    .index("by_questionId", ["questionId"])
    .index("by_isActive", ["isActive"])
    .index("by_addedBy", ["addedBy"]),

  // V2: Normalized exam participation tracking
  examParticipations: defineTable({
    examId: v.id("exams"),
    userId: v.id("users"),
    score: v.number(),
    completedAt: v.number(),
    startedAt: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("auto_submitted")
      )
    ),
    // Pause functionality
    pausePhase: v.optional(
      v.union(
        v.literal("before_pause"),
        v.literal("during_pause"),
        v.literal("after_pause")
      )
    ),
    pauseStartedAt: v.optional(v.number()),
    pauseEndedAt: v.optional(v.number()),
    isPauseCutShort: v.optional(v.boolean()),
    totalPauseDurationMs: v.optional(v.number()),
  })
    .index("by_exam", ["examId"])
    .index("by_user", ["userId"])
    .index("by_exam_user", ["examId", "userId"])
    .index("by_status", ["status"]),

  // V2: Individual exam answers (separate from participation)
  examAnswers: defineTable({
    participationId: v.id("examParticipations"),
    questionId: v.id("questions"),
    selectedAnswer: v.string(),
    isCorrect: v.boolean(),
  })
    .index("by_participation", ["participationId"])
    .index("by_question", ["questionId"]),
})
