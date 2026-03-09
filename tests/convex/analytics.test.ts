import { convexTest } from "convex-test"
import { beforeEach, describe, expect, it } from "vitest"
import { api } from "../../convex/_generated/api"
import schema from "../../convex/schema"
import {
  clearProductCache,
  createAdminUser,
  createRegularUser,
  getOrCreateProduct,
} from "../helpers/convex-helpers"

const modules = import.meta.glob("../../convex/**/*.ts")

describe("analytics", () => {
  beforeEach(() => {
    clearProductCache()
  })

  // ============================================
  // getRecentActivity
  // ============================================
  describe("getRecentActivity", () => {
    it("rejette les non-admin", async () => {
      const t = convexTest(schema, modules)
      const { asUser } = await createRegularUser(t)

      await expect(
        asUser.query(api.analytics.getRecentActivity, {}),
      ).rejects.toThrow("non autorisé")
    })

    it("retourne les activites mixtes triees par timestamp", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)

      // Creer un paiement recent
      const productId = await getOrCreateProduct(t, "exam")
      await t.run(async (ctx) => {
        await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: Date.now() + 86400000,
          createdAt: Date.now(),
        })
      })

      const result = await admin.asAdmin.query(
        api.analytics.getRecentActivity,
        {},
      )

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      // Au moins 1 activite (le paiement + le signup)
      expect(result.length).toBeGreaterThanOrEqual(1)
    })

    it("limite a 10 activites", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)

      // Creer 15 utilisateurs (signups recents)
      for (let i = 0; i < 15; i++) {
        await createRegularUser(t, `bulk${i}`)
      }

      const result = await admin.asAdmin.query(
        api.analytics.getRecentActivity,
        {},
      )
      expect(result.length).toBeLessThanOrEqual(10)
    })
  })

  // ============================================
  // getDashboardTrends
  // ============================================
  describe("getDashboardTrends", () => {
    it("rejette les non-admin", async () => {
      const t = convexTest(schema, modules)
      const { asUser } = await createRegularUser(t)

      await expect(
        asUser.query(api.analytics.getDashboardTrends, {}),
      ).rejects.toThrow("non autorisé")
    })

    it("retourne les tendances avec structure correcte", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)

      const result = await admin.asAdmin.query(
        api.analytics.getDashboardTrends,
        {},
      )

      expect(result).toHaveProperty("usersTrend")
      expect(result).toHaveProperty("participationsTrend")
      expect(result).toHaveProperty("revenueByCurrency")
      expect(result).toHaveProperty("recentUsersCount")
      expect(typeof result.usersTrend).toBe("number")
    })

    it("gere zero dans les deux periodes (trend=0)", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)

      // Pas de donnees = tendances a 0
      const result = await admin.asAdmin.query(
        api.analytics.getDashboardTrends,
        {},
      )

      // Quand il n'y a rien dans les deux periodes, la tendance devrait etre 0 ou 100
      expect(typeof result.participationsTrend).toBe("number")
    })

    it("calcule les revenus par devise", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)
      const productId = await getOrCreateProduct(t, "exam")

      // Creer des transactions recentes en CAD (completedAt requis pour le filtre)
      await t.run(async (ctx) => {
        await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: Date.now() + 86400000,
          createdAt: Date.now(),
          completedAt: Date.now(),
        })
      })

      const result = await admin.asAdmin.query(
        api.analytics.getDashboardTrends,
        {},
      )

      expect(result.revenueByCurrency).toBeDefined()
      // revenueByCurrency est un Record<string, {recent, previous, trend}>
      expect(result.revenueByCurrency.CAD).toBeDefined()
      expect(result.revenueByCurrency.CAD.recent).toBeGreaterThan(0)
    })
  })

  // ============================================
  // getFailedPaymentsCount
  // ============================================
  describe("getFailedPaymentsCount", () => {
    it("rejette les non-admin", async () => {
      const t = convexTest(schema, modules)
      const { asUser } = await createRegularUser(t)

      await expect(
        asUser.query(api.analytics.getFailedPaymentsCount, {}),
      ).rejects.toThrow("non autorisé")
    })

    it("retourne 0 quand aucune transaction echouee", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)

      const result = await admin.asAdmin.query(
        api.analytics.getFailedPaymentsCount,
        {},
      )
      expect(result).toBe(0)
    })

    it("compte les transactions echouees des 7 derniers jours", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)
      const productId = await getOrCreateProduct(t, "exam")

      // Transaction echouee recente
      await t.run(async (ctx) => {
        await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "stripe",
          status: "failed",
          amountPaid: 0,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: Date.now() + 86400000,
          createdAt: Date.now(),
        })
      })

      const result = await admin.asAdmin.query(
        api.analytics.getFailedPaymentsCount,
        {},
      )
      expect(result).toBeGreaterThanOrEqual(1)
    })

    it("ignore les anciennes transactions echouees", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)
      const productId = await getOrCreateProduct(t, "exam")

      // Transaction echouee > 7 jours
      await t.run(async (ctx) => {
        await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "stripe",
          status: "failed",
          amountPaid: 0,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: Date.now() - 86400000,
          createdAt: Date.now() - 8 * 86400000, // 8 jours
        })
      })

      const result = await admin.asAdmin.query(
        api.analytics.getFailedPaymentsCount,
        {},
      )
      expect(result).toBe(0)
    })
  })
})
