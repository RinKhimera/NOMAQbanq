import { convexTest } from "convex-test"
import { beforeEach, describe, expect, it } from "vitest"
import { api } from "../../convex/_generated/api"
import { Id } from "../../convex/_generated/dataModel"
import schema from "../../convex/schema"

// Import des modules Convex pour convexTest (Vite spécifique)
const modules = import.meta.glob("../../convex/**/*.ts")

// Cache pour les produits de test (réutilisés au sein d'un même test)
const productCache = new Map<string, Id<"products">>()

// Nettoyer le cache entre les tests
beforeEach(() => {
  productCache.clear()
})

// Helper pour créer un utilisateur admin
const createAdminUser = async (t: ReturnType<typeof convexTest>) => {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Admin",
      email: "admin@example.com",
      image: "https://example.com/avatar.png",
      role: "admin",
      externalId: "clerk_admin",
      tokenIdentifier: "https://clerk.dev|clerk_admin",
    })
  })
  return {
    userId,
    asAdmin: t.withIdentity({
      tokenIdentifier: "https://clerk.dev|clerk_admin",
    }),
  }
}

// Helper pour créer un utilisateur standard
const createRegularUser = async (
  t: ReturnType<typeof convexTest>,
  suffix: string = "",
) => {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: `User ${suffix}`,
      email: `user${suffix}@example.com`,
      image: "https://example.com/avatar.png",
      role: "user",
      externalId: `clerk_user${suffix}`,
      tokenIdentifier: `https://clerk.dev|clerk_user${suffix}`,
    })
  })
  return {
    userId,
    asUser: t.withIdentity({
      tokenIdentifier: `https://clerk.dev|clerk_user${suffix}`,
    }),
  }
}

// Helper pour créer un produit
const getOrCreateProduct = async (
  t: ReturnType<typeof convexTest>,
  accessType: "exam" | "training",
) => {
  const cacheKey = accessType
  let productId = productCache.get(cacheKey)

  if (!productId) {
    productId = await t.run(async (ctx) => {
      return await ctx.db.insert("products", {
        code: accessType === "exam" ? "exam_access" : "training_access",
        name: accessType === "exam" ? "Accès Examens" : "Accès Entraînement",
        description: "Test product",
        priceCAD: 5000,
        durationDays: 30,
        accessType,
        stripeProductId: `prod_test_${accessType}`,
        stripePriceId: `price_test_${accessType}`,
        isActive: true,
      })
    })
    productCache.set(cacheKey, productId)
  }

  return productId
}

// Helper pour créer une transaction manuelle avec accès
const createManualTransactionWithAccess = async (
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  accessType: "exam" | "training",
  options: {
    amountPaid?: number
    currency?: string
    paymentMethod?: string
    notes?: string
    status?: "completed" | "pending" | "failed" | "refunded"
  } = {},
) => {
  const productId = await getOrCreateProduct(t, accessType)

  const { transactionId, userAccessId } = await t.run(async (ctx) => {
    const txId = await ctx.db.insert("transactions", {
      userId,
      productId,
      type: "manual",
      status: options.status || "completed",
      amountPaid: options.amountPaid ?? 5000,
      currency: options.currency || "CAD",
      accessType,
      durationDays: 30,
      accessExpiresAt: Date.now() + 30 * 86400000,
      createdAt: Date.now(),
      paymentMethod: options.paymentMethod || "interac",
      notes: options.notes,
    })

    // Créer l'accès utilisateur uniquement si status === "completed"
    let accessId: Id<"userAccess"> | null = null
    if (options.status === "completed" || !options.status) {
      accessId = await ctx.db.insert("userAccess", {
        userId,
        accessType,
        expiresAt: Date.now() + 30 * 86400000,
        lastTransactionId: txId,
      })
    }

    return { transactionId: txId, userAccessId: accessId }
  })

  return { transactionId, userAccessId, productId }
}

// Helper pour créer une transaction Stripe
const createStripeTransaction = async (
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  accessType: "exam" | "training",
) => {
  const productId = await getOrCreateProduct(t, accessType)

  const transactionId = await t.run(async (ctx) => {
    return await ctx.db.insert("transactions", {
      userId,
      productId,
      type: "stripe",
      status: "completed",
      amountPaid: 5000,
      currency: "CAD",
      accessType,
      durationDays: 30,
      accessExpiresAt: Date.now() + 30 * 86400000,
      createdAt: Date.now(),
      stripePaymentIntentId: "pi_test_123",
    })
  })

  return { transactionId, productId }
}

describe("payments", () => {
  describe("getTransactionAccessImpact", () => {
    it("rejette si non admin", async () => {
      const t = convexTest(schema, modules)
      const { asUser, userId } = await createRegularUser(t)
      const { transactionId } = await createManualTransactionWithAccess(
        t,
        userId,
        "exam",
      )

      await expect(
        asUser.query(api.payments.getTransactionAccessImpact, {
          transactionId,
        }),
      ).rejects.toThrow("Accès non autorisé")
    })

    it("rejette si ID de transaction invalide", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)

      const fakeId = "invalid_id_format" as Id<"transactions">

      await expect(
        admin.asAdmin.query(api.payments.getTransactionAccessImpact, {
          transactionId: fakeId,
        }),
      ).rejects.toThrow("Validator error")
    })

    it("retourne willRevokeAccess=true si dernière transaction", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)

      const { transactionId } = await createManualTransactionWithAccess(
        t,
        userId,
        "exam",
      )

      const result = await admin.asAdmin.query(
        api.payments.getTransactionAccessImpact,
        { transactionId },
      )

      expect(result.willRevokeAccess).toBe(true)
      expect(result.accessType).toBe("exam")
      expect(result.currentAccessExpiresAt).toBeDefined()
    })

    it("retourne willRevokeAccess=false si pas la dernière transaction", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)

      // Créer 2 transactions
      const { transactionId: oldTransactionId } =
        await createManualTransactionWithAccess(t, userId, "exam")

      // Créer une 2e transaction plus récente et mettre à jour userAccess
      const productId = await getOrCreateProduct(t, "exam")
      const newTransactionId = await t.run(async (ctx) => {
        const txId = await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: Date.now() + 60 * 86400000,
          createdAt: Date.now() + 1000,
          paymentMethod: "cash",
        })

        // Mettre à jour userAccess avec la nouvelle transaction
        const userAccess = await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", userId).eq("accessType", "exam"),
          )
          .unique()

        if (userAccess) {
          await ctx.db.patch(userAccess._id, {
            lastTransactionId: txId,
            expiresAt: Date.now() + 60 * 86400000,
          })
        }

        return txId
      })

      // Vérifier l'impact de supprimer l'ancienne transaction
      const result = await admin.asAdmin.query(
        api.payments.getTransactionAccessImpact,
        { transactionId: oldTransactionId },
      )

      expect(result.willRevokeAccess).toBe(false)
      expect(result.accessType).toBe("exam")
    })
  })

  describe("updateManualTransaction", () => {
    it("rejette si non admin", async () => {
      const t = convexTest(schema, modules)
      const { asUser, userId } = await createRegularUser(t)
      const { transactionId } = await createManualTransactionWithAccess(
        t,
        userId,
        "exam",
      )

      await expect(
        asUser.mutation(api.payments.updateManualTransaction, {
          transactionId,
          amountPaid: 6000,
          currency: "CAD",
          paymentMethod: "cash",
        }),
      ).rejects.toThrow("Accès non autorisé")
    })

    it("rejette si ID de transaction invalide", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)

      const fakeId = "invalid_id_format" as Id<"transactions">

      await expect(
        admin.asAdmin.mutation(api.payments.updateManualTransaction, {
          transactionId: fakeId,
          amountPaid: 6000,
          currency: "CAD",
          paymentMethod: "cash",
        }),
      ).rejects.toThrow("Validator error")
    })

    it("rejette si transaction Stripe", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)

      const { transactionId } = await createStripeTransaction(t, userId, "exam")

      await expect(
        admin.asAdmin.mutation(api.payments.updateManualTransaction, {
          transactionId,
          amountPaid: 6000,
          currency: "CAD",
          paymentMethod: "cash",
        }),
      ).rejects.toThrow("Seules les transactions manuelles peuvent être modifiées")
    })

    it("modifie une transaction manuelle avec succès", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)

      const { transactionId } = await createManualTransactionWithAccess(
        t,
        userId,
        "exam",
        {
          amountPaid: 5000,
          currency: "CAD",
          paymentMethod: "interac",
          notes: "Notes originales",
        },
      )

      const result = await admin.asAdmin.mutation(
        api.payments.updateManualTransaction,
        {
          transactionId,
          amountPaid: 7500,
          currency: "XAF",
          paymentMethod: "cash",
          notes: "Notes modifiées",
        },
      )

      expect(result.success).toBe(true)

      // Vérifier les modifications
      const updatedTx = await t.run(async (ctx) => {
        return await ctx.db.get(transactionId)
      })

      expect(updatedTx?.amountPaid).toBe(7500)
      expect(updatedTx?.currency).toBe("XAF")
      expect(updatedTx?.paymentMethod).toBe("cash")
      expect(updatedTx?.notes).toBe("Notes modifiées")
      expect(updatedTx?.status).toBe("completed")
    })

    it("révoque l'accès lors d'un remboursement (dernière transaction)", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)

      const { transactionId } = await createManualTransactionWithAccess(
        t,
        userId,
        "exam",
      )

      // Vérifier que l'accès existe
      const accessBefore = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", userId).eq("accessType", "exam"),
          )
          .unique()
      })
      expect(accessBefore).not.toBeNull()

      // Rembourser la transaction
      await admin.asAdmin.mutation(api.payments.updateManualTransaction, {
        transactionId,
        amountPaid: 5000,
        currency: "CAD",
        paymentMethod: "interac",
        status: "refunded",
      })

      // Vérifier que l'accès a été révoqué
      const accessAfter = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", userId).eq("accessType", "exam"),
          )
          .unique()
      })
      expect(accessAfter).toBeNull()

      // Vérifier le statut de la transaction
      const updatedTx = await t.run(async (ctx) => {
        return await ctx.db.get(transactionId)
      })
      expect(updatedTx?.status).toBe("refunded")
    })

    it("ne révoque pas l'accès si pas la dernière transaction", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)

      // Créer une première transaction
      const { transactionId: oldTxId } =
        await createManualTransactionWithAccess(t, userId, "exam")

      // Créer une deuxième transaction et mettre à jour userAccess
      const productId = await getOrCreateProduct(t, "exam")
      await t.run(async (ctx) => {
        const newTxId = await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: Date.now() + 60 * 86400000,
          createdAt: Date.now() + 1000,
          paymentMethod: "cash",
        })

        const userAccess = await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", userId).eq("accessType", "exam"),
          )
          .unique()

        if (userAccess) {
          await ctx.db.patch(userAccess._id, {
            lastTransactionId: newTxId,
          })
        }
      })

      // Rembourser l'ancienne transaction
      await admin.asAdmin.mutation(api.payments.updateManualTransaction, {
        transactionId: oldTxId,
        amountPaid: 5000,
        currency: "CAD",
        paymentMethod: "interac",
        status: "refunded",
      })

      // Vérifier que l'accès existe toujours
      const accessAfter = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", userId).eq("accessType", "exam"),
          )
          .unique()
      })
      expect(accessAfter).not.toBeNull()
    })
  })

  describe("deleteManualTransaction", () => {
    it("rejette si non admin", async () => {
      const t = convexTest(schema, modules)
      const { asUser, userId } = await createRegularUser(t)
      const { transactionId } = await createManualTransactionWithAccess(
        t,
        userId,
        "exam",
      )

      await expect(
        asUser.mutation(api.payments.deleteManualTransaction, {
          transactionId,
        }),
      ).rejects.toThrow("Accès non autorisé")
    })

    it("rejette si ID de transaction invalide", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)

      const fakeId = "invalid_id_format" as Id<"transactions">

      await expect(
        admin.asAdmin.mutation(api.payments.deleteManualTransaction, {
          transactionId: fakeId,
        }),
      ).rejects.toThrow("Validator error")
    })

    it("rejette si transaction Stripe", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)

      const { transactionId } = await createStripeTransaction(t, userId, "exam")

      await expect(
        admin.asAdmin.mutation(api.payments.deleteManualTransaction, {
          transactionId,
        }),
      ).rejects.toThrow("Seules les transactions manuelles peuvent être supprimées")
    })

    it("supprime une transaction et révoque l'accès (dernière transaction)", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)

      const { transactionId } = await createManualTransactionWithAccess(
        t,
        userId,
        "exam",
      )

      // Vérifier que l'accès existe
      const accessBefore = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", userId).eq("accessType", "exam"),
          )
          .unique()
      })
      expect(accessBefore).not.toBeNull()

      // Supprimer la transaction
      const result = await admin.asAdmin.mutation(
        api.payments.deleteManualTransaction,
        { transactionId },
      )

      expect(result.success).toBe(true)
      expect(result.accessRevoked).toBe(true)

      // Vérifier que la transaction a été supprimée
      const deletedTx = await t.run(async (ctx) => {
        return await ctx.db.get(transactionId)
      })
      expect(deletedTx).toBeNull()

      // Vérifier que l'accès a été révoqué
      const accessAfter = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", userId).eq("accessType", "exam"),
          )
          .unique()
      })
      expect(accessAfter).toBeNull()
    })

    it("supprime une transaction sans révoquer l'accès (pas la dernière)", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)

      // Créer une première transaction
      const { transactionId: oldTxId } =
        await createManualTransactionWithAccess(t, userId, "exam")

      // Créer une deuxième transaction et mettre à jour userAccess
      const productId = await getOrCreateProduct(t, "exam")
      await t.run(async (ctx) => {
        const newTxId = await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: Date.now() + 60 * 86400000,
          createdAt: Date.now() + 1000,
          paymentMethod: "cash",
        })

        const userAccess = await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", userId).eq("accessType", "exam"),
          )
          .unique()

        if (userAccess) {
          await ctx.db.patch(userAccess._id, {
            lastTransactionId: newTxId,
          })
        }
      })

      // Supprimer l'ancienne transaction
      const result = await admin.asAdmin.mutation(
        api.payments.deleteManualTransaction,
        { transactionId: oldTxId },
      )

      expect(result.success).toBe(true)
      expect(result.accessRevoked).toBe(false)

      // Vérifier que l'accès existe toujours
      const accessAfter = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", userId).eq("accessType", "exam"),
          )
          .unique()
      })
      expect(accessAfter).not.toBeNull()
    })

    it("gère correctement le type training", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)

      const { transactionId } = await createManualTransactionWithAccess(
        t,
        userId,
        "training",
      )

      // Vérifier l'impact
      const impact = await admin.asAdmin.query(
        api.payments.getTransactionAccessImpact,
        { transactionId },
      )
      expect(impact.accessType).toBe("training")
      expect(impact.willRevokeAccess).toBe(true)

      // Supprimer
      const result = await admin.asAdmin.mutation(
        api.payments.deleteManualTransaction,
        { transactionId },
      )

      expect(result.success).toBe(true)
      expect(result.accessRevoked).toBe(true)
    })
  })
})
