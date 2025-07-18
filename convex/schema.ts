import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  users: defineTable({
    name: v.string(),
    username: v.optional(v.string()),
    email: v.string(),
    image: v.string(),
    imageBanner: v.optional(v.string()),
    bio: v.optional(v.string()),
    tokenIdentifier: v.string(),
    externalId: v.optional(v.string()),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_username", ["username"])
    .index("byExternalId", ["externalId"]),
})
