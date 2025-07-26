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
    domain: v.string(),
  }).index("by_domain", ["domain"]),
})
