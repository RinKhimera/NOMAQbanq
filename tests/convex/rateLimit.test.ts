import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import { internal } from "../../convex/_generated/api"
import schema from "../../convex/schema"

const modules = import.meta.glob("../../convex/**/*.ts")

describe("rateLimit", () => {
  // ============================================
  // checkUploadRateLimit
  // ============================================
  describe("checkUploadRateLimit", () => {
    it("autorise le premier upload (aucun enregistrement)", async () => {
      const t = convexTest(schema, modules)

      const result = await t.query(internal.rateLimit.checkUploadRateLimit, {
        clerkId: "clerk_user1",
        uploadType: "avatar",
      })

      expect(result.allowed).toBe(true)
    })

    it("autorise quand sous la limite", async () => {
      const t = convexTest(schema, modules)

      // Creer un enregistrement avec 2 uploads
      await t.run(async (ctx) => {
        await ctx.db.insert("uploadRateLimits", {
          clerkId: "clerk_user1",
          uploadType: "avatar",
          count: 2,
          windowStart: Date.now(),
        })
      })

      const result = await t.query(internal.rateLimit.checkUploadRateLimit, {
        clerkId: "clerk_user1",
        uploadType: "avatar",
      })

      expect(result.allowed).toBe(true)
    })

    it("bloque quand la limite avatar est atteinte (5/heure)", async () => {
      const t = convexTest(schema, modules)

      await t.run(async (ctx) => {
        await ctx.db.insert("uploadRateLimits", {
          clerkId: "clerk_user1",
          uploadType: "avatar",
          count: 5, // Limite atteinte
          windowStart: Date.now(),
        })
      })

      const result = await t.query(internal.rateLimit.checkUploadRateLimit, {
        clerkId: "clerk_user1",
        uploadType: "avatar",
      })

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.retryAfterMs).toBeGreaterThan(0)
        expect(result.retryAfterMinutes).toBeGreaterThan(0)
      }
    })

    it("bloque quand la limite question-image est atteinte (50/heure)", async () => {
      const t = convexTest(schema, modules)

      await t.run(async (ctx) => {
        await ctx.db.insert("uploadRateLimits", {
          clerkId: "clerk_admin1",
          uploadType: "question-image",
          count: 50,
          windowStart: Date.now(),
        })
      })

      const result = await t.query(internal.rateLimit.checkUploadRateLimit, {
        clerkId: "clerk_admin1",
        uploadType: "question-image",
      })

      expect(result.allowed).toBe(false)
    })

    it("autorise apres expiration de la fenetre", async () => {
      const t = convexTest(schema, modules)

      await t.run(async (ctx) => {
        await ctx.db.insert("uploadRateLimits", {
          clerkId: "clerk_user1",
          uploadType: "avatar",
          count: 5,
          windowStart: Date.now() - 61 * 60 * 1000, // 61 min (fenetre expiree)
        })
      })

      const result = await t.query(internal.rateLimit.checkUploadRateLimit, {
        clerkId: "clerk_user1",
        uploadType: "avatar",
      })

      expect(result.allowed).toBe(true)
    })

    it("limites differentes pour avatar vs question-image", async () => {
      const t = convexTest(schema, modules)

      // Avatar a 5 uploads = bloque
      await t.run(async (ctx) => {
        await ctx.db.insert("uploadRateLimits", {
          clerkId: "clerk_user1",
          uploadType: "avatar",
          count: 5,
          windowStart: Date.now(),
        })
      })

      // Question-image a 5 uploads = autorise (limite 50)
      await t.run(async (ctx) => {
        await ctx.db.insert("uploadRateLimits", {
          clerkId: "clerk_user1",
          uploadType: "question-image",
          count: 5,
          windowStart: Date.now(),
        })
      })

      const avatarResult = await t.query(
        internal.rateLimit.checkUploadRateLimit,
        { clerkId: "clerk_user1", uploadType: "avatar" },
      )
      const imageResult = await t.query(
        internal.rateLimit.checkUploadRateLimit,
        { clerkId: "clerk_user1", uploadType: "question-image" },
      )

      expect(avatarResult.allowed).toBe(false)
      expect(imageResult.allowed).toBe(true)
    })

    it("retourne retryAfterMs et retryAfterMinutes corrects", async () => {
      const t = convexTest(schema, modules)

      // Fenetre commencee il y a 30 min
      await t.run(async (ctx) => {
        await ctx.db.insert("uploadRateLimits", {
          clerkId: "clerk_user1",
          uploadType: "avatar",
          count: 5,
          windowStart: Date.now() - 30 * 60 * 1000, // 30 min ago
        })
      })

      const result = await t.query(internal.rateLimit.checkUploadRateLimit, {
        clerkId: "clerk_user1",
        uploadType: "avatar",
      })

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        // ~30 min restantes
        expect(result.retryAfterMs).toBeGreaterThan(25 * 60 * 1000)
        expect(result.retryAfterMs).toBeLessThanOrEqual(30 * 60 * 1000)
        expect(result.retryAfterMinutes).toBe(30)
      }
    })
  })

  // ============================================
  // incrementUploadCount
  // ============================================
  describe("incrementUploadCount", () => {
    it("cree un nouvel enregistrement au premier upload", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.rateLimit.incrementUploadCount, {
        clerkId: "clerk_user1",
        uploadType: "avatar",
      })

      const record = await t.run(async (ctx) => {
        return ctx.db
          .query("uploadRateLimits")
          .withIndex("by_clerk_type", (q) =>
            q.eq("clerkId", "clerk_user1").eq("uploadType", "avatar"),
          )
          .unique()
      })

      expect(record).not.toBeNull()
      expect(record!.count).toBe(1)
      expect(record!.windowStart).toBeGreaterThan(0)
    })

    it("incremente le compteur existant", async () => {
      const t = convexTest(schema, modules)

      await t.run(async (ctx) => {
        await ctx.db.insert("uploadRateLimits", {
          clerkId: "clerk_user1",
          uploadType: "avatar",
          count: 3,
          windowStart: Date.now(),
        })
      })

      await t.mutation(internal.rateLimit.incrementUploadCount, {
        clerkId: "clerk_user1",
        uploadType: "avatar",
      })

      const record = await t.run(async (ctx) => {
        return ctx.db
          .query("uploadRateLimits")
          .withIndex("by_clerk_type", (q) =>
            q.eq("clerkId", "clerk_user1").eq("uploadType", "avatar"),
          )
          .unique()
      })

      expect(record!.count).toBe(4)
    })

    it("reinitialise le compteur quand la fenetre expire", async () => {
      const t = convexTest(schema, modules)

      await t.run(async (ctx) => {
        await ctx.db.insert("uploadRateLimits", {
          clerkId: "clerk_user1",
          uploadType: "avatar",
          count: 5,
          windowStart: Date.now() - 61 * 60 * 1000, // Fenetre expiree
        })
      })

      await t.mutation(internal.rateLimit.incrementUploadCount, {
        clerkId: "clerk_user1",
        uploadType: "avatar",
      })

      const record = await t.run(async (ctx) => {
        return ctx.db
          .query("uploadRateLimits")
          .withIndex("by_clerk_type", (q) =>
            q.eq("clerkId", "clerk_user1").eq("uploadType", "avatar"),
          )
          .unique()
      })

      expect(record!.count).toBe(1) // Reset a 1
    })
  })

  // ============================================
  // Integration: check + increment cycle
  // ============================================
  describe("integration: check puis increment", () => {
    it("cycle complet: autorise -> incremente -> ... -> bloque", async () => {
      const t = convexTest(schema, modules)

      // 5 uploads successifs
      for (let i = 0; i < 5; i++) {
        const check = await t.query(internal.rateLimit.checkUploadRateLimit, {
          clerkId: "clerk_cycle",
          uploadType: "avatar",
        })
        expect(check.allowed).toBe(true)

        await t.mutation(internal.rateLimit.incrementUploadCount, {
          clerkId: "clerk_cycle",
          uploadType: "avatar",
        })
      }

      // 6e upload = bloque
      const blocked = await t.query(internal.rateLimit.checkUploadRateLimit, {
        clerkId: "clerk_cycle",
        uploadType: "avatar",
      })
      expect(blocked.allowed).toBe(false)
    })

    it("tracking separe pour differents types d'upload", async () => {
      const t = convexTest(schema, modules)

      // Remplir la limite avatar
      await t.run(async (ctx) => {
        await ctx.db.insert("uploadRateLimits", {
          clerkId: "clerk_multi",
          uploadType: "avatar",
          count: 5,
          windowStart: Date.now(),
        })
      })

      // Avatar bloque
      const avatarCheck = await t.query(
        internal.rateLimit.checkUploadRateLimit,
        { clerkId: "clerk_multi", uploadType: "avatar" },
      )
      expect(avatarCheck.allowed).toBe(false)

      // Question-image autorise (pas de record)
      const imageCheck = await t.query(
        internal.rateLimit.checkUploadRateLimit,
        { clerkId: "clerk_multi", uploadType: "question-image" },
      )
      expect(imageCheck.allowed).toBe(true)
    })
  })
})
