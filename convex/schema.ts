import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  users: defineTable({
    name: v.string(),
    username: v.optional(v.string()),
    email: v.string(),
    image: v.string(), // URL de l'avatar (Clerk ou Bunny CDN)
    avatarStoragePath: v.optional(v.string()), // Chemin Bunny Storage (pour suppression)
    bio: v.optional(v.string()),
    tokenIdentifier: v.string(),
    externalId: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("user")),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_username", ["username"])
    .index("by_externalId", ["externalId"])
    .index("by_role", ["role"]),

  questions: defineTable({
    question: v.string(),
    imageSrc: v.optional(v.string()), // Legacy: URL externe (rétrocompatibilité)
    images: v.optional(
      v.array(
        v.object({
          url: v.string(), // URL CDN complète
          storagePath: v.string(), // Chemin dans Bunny Storage (pour suppression)
          order: v.number(), // Ordre d'affichage
        }),
      ),
    ),
    options: v.array(v.string()),
    correctAnswer: v.string(),
    explanation: v.string(),
    references: v.optional(v.array(v.string())),
    objectifCMC: v.string(),
    domain: v.string(),
  })
    .index("by_domain", ["domain"])
    .index("by_objectifCMC", ["objectifCMC"]),

  // Table d'agrégation pour les statistiques de questions (optimisation)
  questionStats: defineTable({
    domain: v.string(), // Nom du domaine ou "__total__" pour le total
    count: v.number(),
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
    isActive: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_isActive", ["isActive"])
    .index("by_startDate", ["startDate"])
    .index("by_endDate", ["endDate"])
    .index("by_isActive_startDate", ["isActive", "startDate"])
    .index("by_createdBy", ["createdBy"]),

  // ============================================
  // TRAINING (ENTRAÎNEMENT) TABLES
  // ============================================

  trainingParticipations: defineTable({
    userId: v.id("users"),
    questionCount: v.number(), // 5-20
    questionIds: v.array(v.id("questions")), // Questions sélectionnées (pour historique)
    score: v.number(), // 0-100 (calculé à la fin)
    status: v.union(
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("abandoned"),
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    expiresAt: v.number(), // startedAt + 24h
    domain: v.optional(v.string()), // Pour filtrage futur
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_status", ["status"])
    .index("by_expiresAt", ["expiresAt"]),

  trainingAnswers: defineTable({
    participationId: v.id("trainingParticipations"),
    questionId: v.id("questions"),
    selectedAnswer: v.string(),
    isCorrect: v.boolean(),
  })
    .index("by_participation", ["participationId"])
    .index("by_question", ["questionId"]),

  // ============================================
  // EXAM TABLES
  // ============================================

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
  })
    .index("by_exam", ["examId"])
    .index("by_user", ["userId"])
    .index("by_exam_user", ["examId", "userId"])
    .index("by_status", ["status"]),

  examAnswers: defineTable({
    participationId: v.id("examParticipations"),
    questionId: v.id("questions"),
    selectedAnswer: v.string(),
    isCorrect: v.boolean(),
    isFlagged: v.optional(v.boolean()),
  })
    .index("by_participation", ["participationId"])
    .index("by_question", ["questionId"]),

  // ============================================
  // STRIPE PAYMENT TABLES
  // ============================================

  products: defineTable({
    code: v.union(
      v.literal("exam_access"),
      v.literal("training_access"),
      v.literal("exam_access_promo"),
      v.literal("training_access_promo"),
    ),
    name: v.string(),
    description: v.string(),
    priceCAD: v.number(), // Prix en cents (5000 = 50$)
    durationDays: v.number(), // 30 ou 180
    accessType: v.union(v.literal("exam"), v.literal("training")),
    stripeProductId: v.string(),
    stripePriceId: v.string(),
    isActive: v.boolean(),
  })
    .index("by_code", ["code"])
    .index("by_stripeProductId", ["stripeProductId"])
    .index("by_isActive", ["isActive"]),

  transactions: defineTable({
    userId: v.id("users"),
    productId: v.id("products"),

    type: v.union(v.literal("stripe"), v.literal("manual")),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("refunded"),
    ),

    amountPaid: v.number(), // Montant en cents
    currency: v.string(), // "CAD" ou "XAF"

    // Stripe (optionnel pour manual)
    stripeSessionId: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    stripeEventId: v.optional(v.string()), // Pour idempotence

    // Manual (optionnel pour Stripe)
    paymentMethod: v.optional(v.string()), // "cash", "interac", etc.
    recordedBy: v.optional(v.id("users")), // Admin qui a enregistré
    notes: v.optional(v.string()),

    accessType: v.union(v.literal("exam"), v.literal("training")),
    durationDays: v.number(),
    accessExpiresAt: v.number(), // Timestamp d'expiration calculé

    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_stripeSessionId", ["stripeSessionId"])
    .index("by_stripeEventId", ["stripeEventId"])
    .index("by_status", ["status"])
    .index("by_type", ["type"])
    .index("by_userId_accessType", ["userId", "accessType"])
    .index("by_createdAt", ["createdAt"]),

  userAccess: defineTable({
    userId: v.id("users"),
    accessType: v.union(v.literal("exam"), v.literal("training")),
    expiresAt: v.number(),
    lastTransactionId: v.id("transactions"),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_accessType", ["userId", "accessType"])
    .index("by_expiresAt", ["expiresAt"]),
})
