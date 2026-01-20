import { v } from "convex/values"
import { internalMutation, internalQuery } from "./_generated/server"

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const MAX_AVATAR_UPLOADS_PER_WINDOW = 5
const MAX_QUESTION_IMAGE_UPLOADS_PER_WINDOW = 50 // Higher for admins uploading question images

type UploadType = "avatar" | "question-image"

const getMaxUploadsForType = (uploadType: UploadType): number => {
  switch (uploadType) {
    case "avatar":
      return MAX_AVATAR_UPLOADS_PER_WINDOW
    case "question-image":
      return MAX_QUESTION_IMAGE_UPLOADS_PER_WINDOW
    default:
      return MAX_AVATAR_UPLOADS_PER_WINDOW
  }
}

/**
 * Check if user is rate limited for a specific upload type
 * Returns { allowed: true } or { allowed: false, retryAfterMs: number }
 */
export const checkUploadRateLimit = internalQuery({
  args: {
    clerkId: v.string(),
    uploadType: v.union(v.literal("avatar"), v.literal("question-image")),
  },
  handler: async (ctx, { clerkId, uploadType }) => {
    const now = Date.now()

    const rateLimit = await ctx.db
      .query("uploadRateLimits")
      .withIndex("by_clerk_type", (q) =>
        q.eq("clerkId", clerkId).eq("uploadType", uploadType),
      )
      .unique()

    if (!rateLimit) {
      // No record = allowed
      return { allowed: true as const }
    }

    const windowAge = now - rateLimit.windowStart

    // If window has expired, user is allowed (will be reset on increment)
    if (windowAge >= RATE_LIMIT_WINDOW_MS) {
      return { allowed: true as const }
    }

    // Check if under limit
    const maxUploads = getMaxUploadsForType(uploadType)
    if (rateLimit.count < maxUploads) {
      return { allowed: true as const }
    }

    // Rate limited - calculate retry time
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - windowAge
    return {
      allowed: false as const,
      retryAfterMs,
      retryAfterMinutes: Math.ceil(retryAfterMs / (60 * 1000)),
    }
  },
})

/**
 * Increment the upload count for a user
 * Called after successful upload
 */
export const incrementUploadCount = internalMutation({
  args: {
    clerkId: v.string(),
    uploadType: v.union(v.literal("avatar"), v.literal("question-image")),
  },
  handler: async (ctx, { clerkId, uploadType }) => {
    const now = Date.now()

    const existing = await ctx.db
      .query("uploadRateLimits")
      .withIndex("by_clerk_type", (q) =>
        q.eq("clerkId", clerkId).eq("uploadType", uploadType),
      )
      .unique()

    if (!existing) {
      // Create new record
      await ctx.db.insert("uploadRateLimits", {
        clerkId,
        uploadType,
        count: 1,
        windowStart: now,
      })
      return
    }

    const windowAge = now - existing.windowStart

    if (windowAge >= RATE_LIMIT_WINDOW_MS) {
      // Window expired - reset
      await ctx.db.patch(existing._id, {
        count: 1,
        windowStart: now,
      })
    } else {
      // Increment count
      await ctx.db.patch(existing._id, {
        count: existing.count + 1,
      })
    }
  },
})
