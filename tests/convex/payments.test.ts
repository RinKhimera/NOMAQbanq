import { convexTest } from "convex-test"
import { beforeEach, describe, expect, it } from "vitest"
import { api, internal } from "../../convex/_generated/api"
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
      await t.run(async (ctx) => {
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

  describe("hasExamAccess", () => {
    it("retourne false si utilisateur non connecté", async () => {
      const t = convexTest(schema, modules)

      const result = await t.query(api.payments.hasExamAccess, {})

      expect(result).toBe(false)
    })

    it("retourne false si utilisateur sans accès", async () => {
      const t = convexTest(schema, modules)
      const { asUser } = await createRegularUser(t)

      const result = await asUser.query(api.payments.hasExamAccess, {})

      expect(result).toBe(false)
    })

    it("retourne false si accès expiré", async () => {
      const t = convexTest(schema, modules)
      const { asUser, userId } = await createRegularUser(t)
      const productId = await getOrCreateProduct(t, "exam")

      // Créer un accès expiré avec une vraie transaction
      await t.run(async (ctx) => {
        const txId = await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: Date.now() - 86400000,
          createdAt: Date.now() - 31 * 86400000,
          paymentMethod: "interac",
        })
        await ctx.db.insert("userAccess", {
          userId,
          accessType: "exam",
          expiresAt: Date.now() - 86400000, // Expiré hier
          lastTransactionId: txId,
        })
      })

      const result = await asUser.query(api.payments.hasExamAccess, {})

      expect(result).toBe(false)
    })

    it("retourne true si accès valide", async () => {
      const t = convexTest(schema, modules)
      const { asUser, userId } = await createRegularUser(t)

      await createManualTransactionWithAccess(t, userId, "exam")

      const result = await asUser.query(api.payments.hasExamAccess, {})

      expect(result).toBe(true)
    })

    it("retourne true si admin (bypass)", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      // Admin sans accès explicite
      const result = await asAdmin.query(api.payments.hasExamAccess, {})

      expect(result).toBe(true)
    })
  })

  describe("hasTrainingAccess", () => {
    it("retourne false si utilisateur non connecté", async () => {
      const t = convexTest(schema, modules)

      const result = await t.query(api.payments.hasTrainingAccess, {})

      expect(result).toBe(false)
    })

    it("retourne false si utilisateur sans accès", async () => {
      const t = convexTest(schema, modules)
      const { asUser } = await createRegularUser(t)

      const result = await asUser.query(api.payments.hasTrainingAccess, {})

      expect(result).toBe(false)
    })

    it("retourne false si accès expiré", async () => {
      const t = convexTest(schema, modules)
      const { asUser, userId } = await createRegularUser(t)
      const productId = await getOrCreateProduct(t, "training")

      // Créer un accès expiré avec une vraie transaction
      await t.run(async (ctx) => {
        const txId = await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "training",
          durationDays: 30,
          accessExpiresAt: Date.now() - 86400000,
          createdAt: Date.now() - 31 * 86400000,
          paymentMethod: "interac",
        })
        await ctx.db.insert("userAccess", {
          userId,
          accessType: "training",
          expiresAt: Date.now() - 86400000,
          lastTransactionId: txId,
        })
      })

      const result = await asUser.query(api.payments.hasTrainingAccess, {})

      expect(result).toBe(false)
    })

    it("retourne true si accès valide", async () => {
      const t = convexTest(schema, modules)
      const { asUser, userId } = await createRegularUser(t)

      await createManualTransactionWithAccess(t, userId, "training")

      const result = await asUser.query(api.payments.hasTrainingAccess, {})

      expect(result).toBe(true)
    })

    it("retourne true si admin (bypass)", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      const result = await asAdmin.query(api.payments.hasTrainingAccess, {})

      expect(result).toBe(true)
    })
  })

  describe("getMyAccessStatus", () => {
    it("retourne null si utilisateur non connecté", async () => {
      const t = convexTest(schema, modules)

      const result = await t.query(api.payments.getMyAccessStatus, {})

      expect(result).toBeNull()
    })

    it("retourne null pour les deux accès si aucun accès", async () => {
      const t = convexTest(schema, modules)
      const { asUser } = await createRegularUser(t)

      const result = await asUser.query(api.payments.getMyAccessStatus, {})

      expect(result).not.toBeNull()
      expect(result?.examAccess).toBeNull()
      expect(result?.trainingAccess).toBeNull()
    })

    it("retourne uniquement examAccess si seul accès exam", async () => {
      const t = convexTest(schema, modules)
      const { asUser, userId } = await createRegularUser(t)

      await createManualTransactionWithAccess(t, userId, "exam")

      const result = await asUser.query(api.payments.getMyAccessStatus, {})

      expect(result?.examAccess).not.toBeNull()
      expect(result?.examAccess?.daysRemaining).toBeGreaterThan(0)
      expect(result?.trainingAccess).toBeNull()
    })

    it("retourne uniquement trainingAccess si seul accès training", async () => {
      const t = convexTest(schema, modules)
      const { asUser, userId } = await createRegularUser(t)

      await createManualTransactionWithAccess(t, userId, "training")

      const result = await asUser.query(api.payments.getMyAccessStatus, {})

      expect(result?.examAccess).toBeNull()
      expect(result?.trainingAccess).not.toBeNull()
      expect(result?.trainingAccess?.daysRemaining).toBeGreaterThan(0)
    })

    it("retourne les deux accès si utilisateur a les deux", async () => {
      const t = convexTest(schema, modules)
      const { asUser, userId } = await createRegularUser(t)

      await createManualTransactionWithAccess(t, userId, "exam")
      await createManualTransactionWithAccess(t, userId, "training")

      const result = await asUser.query(api.payments.getMyAccessStatus, {})

      expect(result?.examAccess).not.toBeNull()
      expect(result?.trainingAccess).not.toBeNull()
    })

    it("ignore les accès expirés", async () => {
      const t = convexTest(schema, modules)
      const { asUser, userId } = await createRegularUser(t)
      const productId = await getOrCreateProduct(t, "exam")

      // Créer un accès expiré avec une vraie transaction
      await t.run(async (ctx) => {
        const txId = await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: Date.now() - 86400000,
          createdAt: Date.now() - 31 * 86400000,
          paymentMethod: "interac",
        })
        await ctx.db.insert("userAccess", {
          userId,
          accessType: "exam",
          expiresAt: Date.now() - 86400000,
          lastTransactionId: txId,
        })
      })

      const result = await asUser.query(api.payments.getMyAccessStatus, {})

      expect(result?.examAccess).toBeNull()
    })

    it("calcule correctement les jours restants", async () => {
      const t = convexTest(schema, modules)
      const { asUser, userId } = await createRegularUser(t)

      // Créer un accès qui expire dans 15 jours
      await t.run(async (ctx) => {
        const productId = await ctx.db.insert("products", {
          code: "exam_access",
          name: "Test",
          description: "Test",
          priceCAD: 5000,
          durationDays: 15,
          accessType: "exam",
          stripeProductId: "prod_test",
          stripePriceId: "price_test",
          isActive: true,
        })
        const txId = await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 15,
          accessExpiresAt: Date.now() + 15 * 86400000,
          createdAt: Date.now(),
          paymentMethod: "interac",
        })
        await ctx.db.insert("userAccess", {
          userId,
          accessType: "exam",
          expiresAt: Date.now() + 15 * 86400000,
          lastTransactionId: txId,
        })
      })

      const result = await asUser.query(api.payments.getMyAccessStatus, {})

      expect(result?.examAccess?.daysRemaining).toBe(15)
    })
  })

  describe("getAvailableProducts", () => {
    it("retourne les produits actifs", async () => {
      const t = convexTest(schema, modules)

      // Créer des produits
      await t.run(async (ctx) => {
        await ctx.db.insert("products", {
          code: "exam_access",
          name: "Accès Examens",
          description: "Test",
          priceCAD: 5000,
          durationDays: 30,
          accessType: "exam",
          stripeProductId: "prod_1",
          stripePriceId: "price_1",
          isActive: true,
        })
        await ctx.db.insert("products", {
          code: "training_access",
          name: "Accès Training",
          description: "Test",
          priceCAD: 3000,
          durationDays: 30,
          accessType: "training",
          stripeProductId: "prod_2",
          stripePriceId: "price_2",
          isActive: false, // Inactif
        })
      })

      const result = await t.query(api.payments.getAvailableProducts, {})

      expect(result.length).toBe(1)
      expect(result[0].code).toBe("exam_access")
    })
  })

  describe("recordManualPayment", () => {
    it("rejette si non admin", async () => {
      const t = convexTest(schema, modules)
      const { asUser, userId } = await createRegularUser(t)
      await getOrCreateProduct(t, "exam")

      await expect(
        asUser.mutation(api.payments.recordManualPayment, {
          userId,
          productCode: "exam_access",
          amountPaid: 5000,
          currency: "CAD",
          paymentMethod: "interac",
        }),
      ).rejects.toThrow("Accès non autorisé")
    })

    it("rejette si produit inexistant", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)

      await expect(
        admin.asAdmin.mutation(api.payments.recordManualPayment, {
          userId,
          productCode: "exam_access",
          amountPaid: 5000,
          currency: "CAD",
          paymentMethod: "interac",
        }),
      ).rejects.toThrow("Produit non trouvé")
    })

    it("rejette si utilisateur inexistant", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      await getOrCreateProduct(t, "exam")

      const fakeUserId = "fake_user_id" as Id<"users">

      await expect(
        admin.asAdmin.mutation(api.payments.recordManualPayment, {
          userId: fakeUserId,
          productCode: "exam_access",
          amountPaid: 5000,
          currency: "CAD",
          paymentMethod: "interac",
        }),
      ).rejects.toThrow()
    })

    it("crée transaction et accès avec succès", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)
      await getOrCreateProduct(t, "exam")

      const result = await admin.asAdmin.mutation(
        api.payments.recordManualPayment,
        {
          userId,
          productCode: "exam_access",
          amountPaid: 5000,
          currency: "CAD",
          paymentMethod: "interac",
          notes: "Paiement test",
        },
      )

      expect(result.success).toBe(true)
      expect(result.transactionId).toBeDefined()

      // Vérifier la transaction créée
      const tx = await t.run(async (ctx) => {
        return await ctx.db.get(result.transactionId)
      })
      expect(tx?.type).toBe("manual")
      expect(tx?.status).toBe("completed")
      expect(tx?.amountPaid).toBe(5000)
      expect(tx?.notes).toBe("Paiement test")
      expect(tx?.recordedBy).toBe(admin.userId)

      // Vérifier l'accès créé
      const access = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", userId).eq("accessType", "exam"),
          )
          .unique()
      })
      expect(access).not.toBeNull()
      expect(access?.expiresAt).toBeGreaterThan(Date.now())
    })

    it("cumule le temps si accès existant", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)
      await getOrCreateProduct(t, "exam")

      // Créer un premier accès
      await admin.asAdmin.mutation(api.payments.recordManualPayment, {
        userId,
        productCode: "exam_access",
        amountPaid: 5000,
        currency: "CAD",
        paymentMethod: "interac",
      })

      const accessBefore = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", userId).eq("accessType", "exam"),
          )
          .unique()
      })
      const expiresAtBefore = accessBefore?.expiresAt ?? 0

      // Ajouter un deuxième paiement
      await admin.asAdmin.mutation(api.payments.recordManualPayment, {
        userId,
        productCode: "exam_access",
        amountPaid: 5000,
        currency: "CAD",
        paymentMethod: "cash",
      })

      const accessAfter = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", userId).eq("accessType", "exam"),
          )
          .unique()
      })

      // Le temps devrait être cumulé (30 jours de plus)
      expect(accessAfter?.expiresAt).toBeGreaterThan(expiresAtBefore)
      const diffDays =
        ((accessAfter?.expiresAt ?? 0) - expiresAtBefore) / 86400000
      expect(diffDays).toBeCloseTo(30, 0)
    })
  })

  describe("getUserAccessStatus", () => {
    it("rejette si non admin", async () => {
      const t = convexTest(schema, modules)
      const { asUser, userId } = await createRegularUser(t)

      await expect(
        asUser.query(api.payments.getUserAccessStatus, { userId }),
      ).rejects.toThrow("Accès non autorisé")
    })

    it("retourne le statut d'accès d'un utilisateur", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)

      await createManualTransactionWithAccess(t, userId, "exam")

      const result = await admin.asAdmin.query(
        api.payments.getUserAccessStatus,
        { userId },
      )

      expect(result.examAccess).not.toBeNull()
      expect(result.examAccess?.daysRemaining).toBeGreaterThan(0)
      expect(result.trainingAccess).toBeNull()
    })
  })

  describe("getTransactionStats", () => {
    it("rejette si non admin", async () => {
      const t = convexTest(schema, modules)
      const { asUser } = await createRegularUser(t)

      await expect(
        asUser.query(api.payments.getTransactionStats, {}),
      ).rejects.toThrow("Accès non autorisé")
    })

    it("calcule les statistiques correctement", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)

      // Créer des transactions
      await createManualTransactionWithAccess(t, userId, "exam", {
        amountPaid: 5000,
      })
      await createManualTransactionWithAccess(t, userId, "training", {
        amountPaid: 3000,
      })

      const result = await admin.asAdmin.query(
        api.payments.getTransactionStats,
        {},
      )

      expect(result.totalTransactions).toBe(2)
      expect(result.revenueByCurrency.CAD.total).toBe(8000)
      expect(result.manualTransactions).toBe(2)
      expect(result.stripeTransactions).toBe(0)
    })
  })

  describe("upsertProduct", () => {
    it("rejette si non admin", async () => {
      const t = convexTest(schema, modules)
      const { asUser } = await createRegularUser(t)

      await expect(
        asUser.mutation(api.payments.upsertProduct, {
          code: "exam_access",
          name: "Test",
          description: "Test",
          priceCAD: 5000,
          durationDays: 30,
          accessType: "exam",
          stripeProductId: "prod_test",
          stripePriceId: "price_test",
          isActive: true,
        }),
      ).rejects.toThrow("Accès non autorisé")
    })

    it("crée un nouveau produit", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)

      const result = await admin.asAdmin.mutation(api.payments.upsertProduct, {
        code: "exam_access",
        name: "Accès Examens",
        description: "Accès aux examens blancs",
        priceCAD: 4999,
        durationDays: 30,
        accessType: "exam",
        stripeProductId: "prod_123",
        stripePriceId: "price_123",
        isActive: true,
      })

      expect(result.success).toBe(true)
      expect(result.updated).toBe(false)
      expect(result.productId).toBeDefined()

      // Vérifier le produit créé
      const product = await t.run(async (ctx) => {
        return await ctx.db.get(result.productId)
      })
      expect(product?.name).toBe("Accès Examens")
      expect(product?.priceCAD).toBe(4999)
    })

    it("met à jour un produit existant", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)

      // Créer le produit
      await admin.asAdmin.mutation(api.payments.upsertProduct, {
        code: "exam_access",
        name: "Accès Examens",
        description: "Description originale",
        priceCAD: 4999,
        durationDays: 30,
        accessType: "exam",
        stripeProductId: "prod_123",
        stripePriceId: "price_123",
        isActive: true,
      })

      // Mettre à jour
      const result = await admin.asAdmin.mutation(api.payments.upsertProduct, {
        code: "exam_access",
        name: "Accès Examens Premium",
        description: "Description mise à jour",
        priceCAD: 5999,
        durationDays: 60,
        accessType: "exam",
        stripeProductId: "prod_123",
        stripePriceId: "price_456",
        isActive: false,
      })

      expect(result.success).toBe(true)
      expect(result.updated).toBe(true)

      // Vérifier les modifications
      const product = await t.run(async (ctx) => {
        return await ctx.db.get(result.productId)
      })
      expect(product?.name).toBe("Accès Examens Premium")
      expect(product?.priceCAD).toBe(5999)
      expect(product?.durationDays).toBe(60)
      expect(product?.isActive).toBe(false)
    })
  })

  describe("getMyTransactions", () => {
    it("rejette si non connecté", async () => {
      const t = convexTest(schema, modules)

      await expect(
        t.query(api.payments.getMyTransactions, {
          paginationOpts: { numItems: 10, cursor: null },
        }),
      ).rejects.toThrow()
    })

    it("retourne les transactions de l'utilisateur", async () => {
      const t = convexTest(schema, modules)
      const { asUser, userId } = await createRegularUser(t)

      await createManualTransactionWithAccess(t, userId, "exam")
      await createManualTransactionWithAccess(t, userId, "training")

      const result = await asUser.query(api.payments.getMyTransactions, {
        paginationOpts: { numItems: 10, cursor: null },
      })

      expect(result.page.length).toBe(2)
      expect(result.page[0].product).toBeDefined()
    })

    it("filtre les transactions pending", async () => {
      const t = convexTest(schema, modules)
      const { asUser, userId } = await createRegularUser(t)

      await createManualTransactionWithAccess(t, userId, "exam")
      await createManualTransactionWithAccess(t, userId, "training", {
        status: "pending",
      })

      const result = await asUser.query(api.payments.getMyTransactions, {
        paginationOpts: { numItems: 10, cursor: null },
      })

      // Seule la transaction completed doit être retournée
      expect(result.page.length).toBe(1)
      expect(result.page[0].status).toBe("completed")
    })
  })

  describe("getAllTransactions", () => {
    it("rejette si non admin", async () => {
      const t = convexTest(schema, modules)
      const { asUser } = await createRegularUser(t)

      await expect(
        asUser.query(api.payments.getAllTransactions, {
          paginationOpts: { numItems: 10, cursor: null },
        }),
      ).rejects.toThrow("Accès non autorisé")
    })

    it("retourne toutes les transactions", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId: user1 } = await createRegularUser(t, "1")
      const { userId: user2 } = await createRegularUser(t, "2")

      await createManualTransactionWithAccess(t, user1, "exam")
      await createManualTransactionWithAccess(t, user2, "training")

      const result = await admin.asAdmin.query(api.payments.getAllTransactions, {
        paginationOpts: { numItems: 10, cursor: null },
      })

      expect(result.page.length).toBe(2)
      expect(result.page[0].user).toBeDefined()
      expect(result.page[0].product).toBeDefined()
    })

    it("filtre par type", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)

      await createManualTransactionWithAccess(t, userId, "exam")
      await createStripeTransaction(t, userId, "training")

      const result = await admin.asAdmin.query(api.payments.getAllTransactions, {
        paginationOpts: { numItems: 10, cursor: null },
        type: "manual",
      })

      expect(result.page.every((tx) => tx.type === "manual")).toBe(true)
    })

    it("filtre par status", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)

      await createManualTransactionWithAccess(t, userId, "exam")
      await createManualTransactionWithAccess(t, userId, "training", {
        status: "refunded",
      })

      const result = await admin.asAdmin.query(api.payments.getAllTransactions, {
        paginationOpts: { numItems: 10, cursor: null },
        status: "completed",
      })

      expect(result.page.every((tx) => tx.status === "completed")).toBe(true)
    })

    it("filtre par userId", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId: user1 } = await createRegularUser(t, "1")
      const { userId: user2 } = await createRegularUser(t, "2")

      await createManualTransactionWithAccess(t, user1, "exam")
      await createManualTransactionWithAccess(t, user2, "training")

      const result = await admin.asAdmin.query(api.payments.getAllTransactions, {
        paginationOpts: { numItems: 10, cursor: null },
        userId: user1,
      })

      expect(result.page.length).toBe(1)
      expect(result.page[0].userId).toBe(user1)
    })
  })

  describe("createPendingTransaction (internal)", () => {
    it("crée une transaction pending", async () => {
      const t = convexTest(schema, modules)
      const { userId } = await createRegularUser(t)
      const productId = await getOrCreateProduct(t, "exam")

      const transactionId = await t.mutation(
        internal.payments.createPendingTransaction,
        {
          userId,
          productId,
          stripeSessionId: "cs_test_123",
          amountPaid: 4999,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
        },
      )

      expect(transactionId).toBeDefined()

      // Vérifier la transaction créée
      const tx = await t.run(async (ctx) => {
        return await ctx.db.get(transactionId)
      })
      expect(tx?.status).toBe("pending")
      expect(tx?.type).toBe("stripe")
      expect(tx?.stripeSessionId).toBe("cs_test_123")
    })

    it("cumule le temps si accès existant", async () => {
      const t = convexTest(schema, modules)
      const { userId } = await createRegularUser(t)
      const productId = await getOrCreateProduct(t, "exam")

      // Créer un accès existant avec une vraie transaction
      const existingExpiresAt = Date.now() + 15 * 86400000 // 15 jours
      await t.run(async (ctx) => {
        const existingTxId = await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 15,
          accessExpiresAt: existingExpiresAt,
          createdAt: Date.now(),
          paymentMethod: "interac",
        })
        await ctx.db.insert("userAccess", {
          userId,
          accessType: "exam",
          expiresAt: existingExpiresAt,
          lastTransactionId: existingTxId,
        })
      })

      const transactionId = await t.mutation(
        internal.payments.createPendingTransaction,
        {
          userId,
          productId,
          stripeSessionId: "cs_test_456",
          amountPaid: 4999,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
        },
      )

      // Vérifier que accessExpiresAt cumule le temps
      const tx = await t.run(async (ctx) => {
        return await ctx.db.get(transactionId)
      })
      // L'expiration devrait être basée sur l'accès existant + 30 jours
      expect(tx?.accessExpiresAt).toBeGreaterThan(existingExpiresAt)
    })
  })

  describe("completeStripeTransaction (internal)", () => {
    it("complète une transaction pending", async () => {
      const t = convexTest(schema, modules)
      const { userId } = await createRegularUser(t)
      const productId = await getOrCreateProduct(t, "exam")

      // Créer une transaction pending
      const transactionId = await t.mutation(
        internal.payments.createPendingTransaction,
        {
          userId,
          productId,
          stripeSessionId: "cs_test_complete",
          amountPaid: 4999,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
        },
      )

      // Compléter la transaction
      const result = await t.mutation(
        internal.payments.completeStripeTransaction,
        {
          stripeSessionId: "cs_test_complete",
          stripePaymentIntentId: "pi_test_123",
          stripeEventId: "evt_test_123",
        },
      )

      expect(result.success).toBe(true)
      expect(result.transactionId).toBe(transactionId)

      // Vérifier le statut de la transaction
      const tx = await t.run(async (ctx) => {
        return await ctx.db.get(transactionId)
      })
      expect(tx?.status).toBe("completed")
      expect(tx?.stripePaymentIntentId).toBe("pi_test_123")
      expect(tx?.completedAt).toBeDefined()

      // Vérifier que l'accès a été créé
      const access = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", userId).eq("accessType", "exam"),
          )
          .unique()
      })
      expect(access).not.toBeNull()
    })

    it("retourne alreadyProcessed si event déjà traité", async () => {
      const t = convexTest(schema, modules)
      const { userId } = await createRegularUser(t)
      const productId = await getOrCreateProduct(t, "exam")

      // Créer et compléter une transaction
      await t.mutation(internal.payments.createPendingTransaction, {
        userId,
        productId,
        stripeSessionId: "cs_test_idempotent",
        amountPaid: 4999,
        currency: "CAD",
        accessType: "exam",
        durationDays: 30,
      })

      await t.mutation(internal.payments.completeStripeTransaction, {
        stripeSessionId: "cs_test_idempotent",
        stripePaymentIntentId: "pi_test_456",
        stripeEventId: "evt_test_idempotent",
      })

      // Tenter de compléter à nouveau avec le même eventId
      const result = await t.mutation(
        internal.payments.completeStripeTransaction,
        {
          stripeSessionId: "cs_test_idempotent",
          stripePaymentIntentId: "pi_test_456",
          stripeEventId: "evt_test_idempotent",
        },
      )

      expect(result.success).toBe(true)
      expect(result.alreadyProcessed).toBe(true)
    })

    it("throw si session non trouvée", async () => {
      const t = convexTest(schema, modules)

      await expect(
        t.mutation(internal.payments.completeStripeTransaction, {
          stripeSessionId: "cs_nonexistent",
          stripePaymentIntentId: "pi_test_789",
          stripeEventId: "evt_test_789",
        }),
      ).rejects.toThrow("Transaction non trouvée")
    })

    it("retourne alreadyProcessed si transaction déjà completed", async () => {
      const t = convexTest(schema, modules)
      const { userId } = await createRegularUser(t)
      const productId = await getOrCreateProduct(t, "exam")

      // Créer et compléter une transaction
      await t.mutation(internal.payments.createPendingTransaction, {
        userId,
        productId,
        stripeSessionId: "cs_test_already_done",
        amountPaid: 4999,
        currency: "CAD",
        accessType: "exam",
        durationDays: 30,
      })

      await t.mutation(internal.payments.completeStripeTransaction, {
        stripeSessionId: "cs_test_already_done",
        stripePaymentIntentId: "pi_test_already",
        stripeEventId: "evt_test_first",
      })

      // Tenter de compléter à nouveau avec un eventId différent
      const result = await t.mutation(
        internal.payments.completeStripeTransaction,
        {
          stripeSessionId: "cs_test_already_done",
          stripePaymentIntentId: "pi_test_already",
          stripeEventId: "evt_test_second",
        },
      )

      expect(result.success).toBe(true)
      expect(result.alreadyProcessed).toBe(true)
    })
  })

  describe("failStripeTransaction (internal)", () => {
    it("marque une transaction comme failed", async () => {
      const t = convexTest(schema, modules)
      const { userId } = await createRegularUser(t)
      const productId = await getOrCreateProduct(t, "exam")

      // Créer une transaction pending
      const transactionId = await t.mutation(
        internal.payments.createPendingTransaction,
        {
          userId,
          productId,
          stripeSessionId: "cs_test_fail",
          amountPaid: 4999,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
        },
      )

      // Marquer comme failed
      const result = await t.mutation(internal.payments.failStripeTransaction, {
        stripeSessionId: "cs_test_fail",
        stripeEventId: "evt_test_fail",
      })

      expect(result.success).toBe(true)

      // Vérifier le statut
      const tx = await t.run(async (ctx) => {
        return await ctx.db.get(transactionId)
      })
      expect(tx?.status).toBe("failed")
    })

    it("retourne alreadyProcessed si event déjà traité", async () => {
      const t = convexTest(schema, modules)
      const { userId } = await createRegularUser(t)
      const productId = await getOrCreateProduct(t, "exam")

      // Créer et marquer comme failed
      await t.mutation(internal.payments.createPendingTransaction, {
        userId,
        productId,
        stripeSessionId: "cs_test_fail_idempotent",
        amountPaid: 4999,
        currency: "CAD",
        accessType: "exam",
        durationDays: 30,
      })

      await t.mutation(internal.payments.failStripeTransaction, {
        stripeSessionId: "cs_test_fail_idempotent",
        stripeEventId: "evt_test_fail_idem",
      })

      // Tenter à nouveau
      const result = await t.mutation(internal.payments.failStripeTransaction, {
        stripeSessionId: "cs_test_fail_idempotent",
        stripeEventId: "evt_test_fail_idem",
      })

      expect(result.success).toBe(true)
      expect(result.alreadyProcessed).toBe(true)
    })

    it("retourne error si session non trouvée", async () => {
      const t = convexTest(schema, modules)

      const result = await t.mutation(internal.payments.failStripeTransaction, {
        stripeSessionId: "cs_nonexistent_fail",
        stripeEventId: "evt_test_notfound",
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Transaction non trouvée")
    })
  })

  describe("seedProducts (internal)", () => {
    it("crée les produits initiaux", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.payments.seedProducts, {
        products: [
          {
            code: "exam_access",
            name: "Accès Examens",
            description: "Accès aux examens blancs",
            priceCAD: 4999,
            durationDays: 30,
            accessType: "exam",
            stripeProductId: "prod_seed_1",
            stripePriceId: "price_seed_1",
            isActive: true,
          },
          {
            code: "training_access",
            name: "Accès Entraînement",
            description: "Accès à la banque d'entraînement",
            priceCAD: 2999,
            durationDays: 30,
            accessType: "training",
            stripeProductId: "prod_seed_2",
            stripePriceId: "price_seed_2",
            isActive: true,
          },
        ],
      })

      // Vérifier les produits créés
      const products = await t.run(async (ctx) => {
        return await ctx.db.query("products").collect()
      })
      expect(products.length).toBe(2)
    })

    it("ne duplique pas les produits existants", async () => {
      const t = convexTest(schema, modules)

      // Premier seed
      await t.mutation(internal.payments.seedProducts, {
        products: [
          {
            code: "exam_access",
            name: "Accès Examens",
            description: "Test",
            priceCAD: 4999,
            durationDays: 30,
            accessType: "exam",
            stripeProductId: "prod_1",
            stripePriceId: "price_1",
            isActive: true,
          },
        ],
      })

      // Deuxième seed avec le même code
      await t.mutation(internal.payments.seedProducts, {
        products: [
          {
            code: "exam_access",
            name: "Nom différent",
            description: "Description différente",
            priceCAD: 9999,
            durationDays: 60,
            accessType: "exam",
            stripeProductId: "prod_2",
            stripePriceId: "price_2",
            isActive: false,
          },
        ],
      })

      // Vérifier qu'il n'y a qu'un seul produit
      const products = await t.run(async (ctx) => {
        return await ctx.db.query("products").collect()
      })
      expect(products.length).toBe(1)
      expect(products[0].name).toBe("Accès Examens") // Le premier nom est conservé
    })
  })
})
