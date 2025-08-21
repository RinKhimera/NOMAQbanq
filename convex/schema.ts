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
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
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
    domain: v.union(
      v.literal("Cardiologie"),
      v.literal("Pneumologie"),
      v.literal("Gastroentérologie"),
      v.literal("Endocrinologie"),
      v.literal("Neurologie"),
      v.literal("Psychiatrie"),
      v.literal("Pédiatrie"),
      v.literal("Gynécologie obstétrique"),
      v.literal("Urologie"),
      v.literal("Orthopédie"),
      v.literal("Dermatologie"),
      v.literal("Ophtalmologie"),
      v.literal("Chirurgie"),
      v.literal("Santé publique et médecine préventive"),
      v.literal("Médecine interne"),
      v.literal("Anesthésie-Réanimation"),
      v.literal("Gastro-entérologie"),
      v.literal("Hémato-oncologie"),
      v.literal("Néphrologie"),
      v.literal("Infectiologie"),
      v.literal("Autres"),
    ),
  }).index("by_domain", ["domain"]),

  exams: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    questionIds: v.array(v.id("questions")),
    completionTime: v.number(),
    participants: v.array(
      v.object({
        userId: v.id("users"),
        score: v.number(),
        completedAt: v.number(),
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
})
