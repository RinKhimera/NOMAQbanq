import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import { Id } from "../../../convex/_generated/dataModel"
import schema from "../../../convex/schema"
import { batchGetByIds, batchGetOrderedByIds } from "@/convex/lib/batchFetch"

const modules = import.meta.glob("../../../convex/**/*.ts")

describe("batchFetch", () => {
  describe("batchGetByIds", () => {
    it("retourne une Map avec les documents existants", async () => {
      const t = convexTest(schema, modules)

      // Create test users
      const userId1 = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "User 1",
          email: "user1@example.com",
          image: "https://example.com/avatar.png",
          role: "user",
          externalId: "clerk_user1",
          tokenIdentifier: "https://clerk.dev|clerk_user1",
        })
      })

      const userId2 = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "User 2",
          email: "user2@example.com",
          image: "https://example.com/avatar.png",
          role: "user",
          externalId: "clerk_user2",
          tokenIdentifier: "https://clerk.dev|clerk_user2",
        })
      })

      // Batch fetch - convert Map to serializable format for assertions
      const result = await t.run(async (ctx) => {
        const map = await batchGetByIds(ctx, "users", [userId1, userId2])
        return {
          size: map.size,
          user1Name: map.get(userId1)?.name,
          user2Name: map.get(userId2)?.name,
        }
      })

      expect(result.size).toBe(2)
      expect(result.user1Name).toBe("User 1")
      expect(result.user2Name).toBe("User 2")
    })

    it("déduplique les IDs", async () => {
      const t = convexTest(schema, modules)

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "User",
          email: "user@example.com",
          image: "https://example.com/avatar.png",
          role: "user",
          externalId: "clerk_user",
          tokenIdentifier: "https://clerk.dev|clerk_user",
        })
      })

      // Pass same ID multiple times - convert Map to serializable format
      const result = await t.run(async (ctx) => {
        const map = await batchGetByIds(ctx, "users", [userId, userId, userId])
        return {
          size: map.size,
          userName: map.get(userId)?.name,
        }
      })

      // Should only have 1 entry in the map
      expect(result.size).toBe(1)
      expect(result.userName).toBe("User")
    })

    it("filtre les documents inexistants (branche null)", async () => {
      const t = convexTest(schema, modules)

      // Create and delete a user to get a valid but non-existent ID
      const deletedUserId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("users", {
          name: "To Delete",
          email: "delete@example.com",
          image: "https://example.com/avatar.png",
          role: "user",
          externalId: "clerk_delete",
          tokenIdentifier: "https://clerk.dev|clerk_delete",
        })
        await ctx.db.delete(id)
        return id
      })

      const existingUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Existing",
          email: "existing@example.com",
          image: "https://example.com/avatar.png",
          role: "user",
          externalId: "clerk_existing",
          tokenIdentifier: "https://clerk.dev|clerk_existing",
        })
      })

      // Batch fetch with one existing and one non-existing ID
      const result = await t.run(async (ctx) => {
        const map = await batchGetByIds(ctx, "users", [deletedUserId, existingUserId])
        return {
          size: map.size,
          hasDeleted: map.has(deletedUserId),
          hasExisting: map.has(existingUserId),
          existingName: map.get(existingUserId)?.name,
        }
      })

      // Only the existing document should be in the map
      expect(result.size).toBe(1)
      expect(result.hasDeleted).toBe(false)
      expect(result.hasExisting).toBe(true)
      expect(result.existingName).toBe("Existing")
    })

    it("retourne une Map vide si tous les IDs sont inexistants", async () => {
      const t = convexTest(schema, modules)

      // Create and delete a user
      const deletedUserId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("users", {
          name: "To Delete",
          email: "delete@example.com",
          image: "https://example.com/avatar.png",
          role: "user",
          externalId: "clerk_delete",
          tokenIdentifier: "https://clerk.dev|clerk_delete",
        })
        await ctx.db.delete(id)
        return id
      })

      const result = await t.run(async (ctx) => {
        const map = await batchGetByIds(ctx, "users", [deletedUserId])
        return { size: map.size }
      })

      expect(result.size).toBe(0)
    })

    it("retourne une Map vide pour un tableau d'IDs vide", async () => {
      const t = convexTest(schema, modules)

      const result = await t.run(async (ctx) => {
        const map = await batchGetByIds(ctx, "users", [] as Id<"users">[])
        return { size: map.size }
      })

      expect(result.size).toBe(0)
    })
  })

  describe("batchGetOrderedByIds", () => {
    it("retourne les documents dans le même ordre que les IDs", async () => {
      const t = convexTest(schema, modules)

      const userId1 = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "User 1",
          email: "user1@example.com",
          image: "https://example.com/avatar.png",
          role: "user",
          externalId: "clerk_user1",
          tokenIdentifier: "https://clerk.dev|clerk_user1",
        })
      })

      const userId2 = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "User 2",
          email: "user2@example.com",
          image: "https://example.com/avatar.png",
          role: "user",
          externalId: "clerk_user2",
          tokenIdentifier: "https://clerk.dev|clerk_user2",
        })
      })

      // Fetch in reverse order
      const result = await t.run(async (ctx) => {
        return await batchGetOrderedByIds(ctx, "users", [userId2, userId1])
      })

      expect(result).toHaveLength(2)
      expect(result[0]?.name).toBe("User 2")
      expect(result[1]?.name).toBe("User 1")
    })

    it("retourne null pour les IDs inexistants", async () => {
      const t = convexTest(schema, modules)

      const existingUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Existing",
          email: "existing@example.com",
          image: "https://example.com/avatar.png",
          role: "user",
          externalId: "clerk_existing",
          tokenIdentifier: "https://clerk.dev|clerk_existing",
        })
      })

      const deletedUserId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("users", {
          name: "To Delete",
          email: "delete@example.com",
          image: "https://example.com/avatar.png",
          role: "user",
          externalId: "clerk_delete",
          tokenIdentifier: "https://clerk.dev|clerk_delete",
        })
        await ctx.db.delete(id)
        return id
      })

      const result = await t.run(async (ctx) => {
        return await batchGetOrderedByIds(ctx, "users", [
          existingUserId,
          deletedUserId,
        ])
      })

      expect(result).toHaveLength(2)
      expect(result[0]?.name).toBe("Existing")
      expect(result[1]).toBeNull()
    })

    it("préserve les doublons dans l'ordre", async () => {
      const t = convexTest(schema, modules)

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "User",
          email: "user@example.com",
          image: "https://example.com/avatar.png",
          role: "user",
          externalId: "clerk_user",
          tokenIdentifier: "https://clerk.dev|clerk_user",
        })
      })

      const result = await t.run(async (ctx) => {
        return await batchGetOrderedByIds(ctx, "users", [userId, userId, userId])
      })

      // Should have 3 entries (preserves duplicates)
      expect(result).toHaveLength(3)
      expect(result[0]?.name).toBe("User")
      expect(result[1]?.name).toBe("User")
      expect(result[2]?.name).toBe("User")
    })
  })
})
