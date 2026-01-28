import { convexTest } from "convex-test"
import { describe, expect, it, beforeEach } from "vitest"
import { api } from "../../convex/_generated/api"
import { Id } from "../../convex/_generated/dataModel"
import schema from "../../convex/schema"

// Import des modules Convex pour convexTest (Vite spécifique)
const modules = import.meta.glob("../../convex/**/*.ts")

// Cache pour les produits de test
const productCache = new Map<string, Id<"products">>()

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

describe("userAccess - Gestion des accès payants", () => {
  describe("Création d'accès via paiement manuel", () => {
    it("crée un enregistrement userAccess après paiement", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      await getOrCreateProduct(t, "exam")

      await admin.asAdmin.mutation(api.payments.recordManualPayment, {
        userId: user.userId,
        productCode: "exam_access",
        amountPaid: 5000,
        currency: "CAD",
        paymentMethod: "interac",
      })

      // Vérifier que l'accès a été créé
      const access = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", user.userId).eq("accessType", "exam"),
          )
          .unique()
      })

      expect(access).not.toBeNull()
      expect(access?.accessType).toBe("exam")
      expect(access?.expiresAt).toBeGreaterThan(Date.now())
    })

    it("étend l'accès existant si nouvelle transaction", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      await getOrCreateProduct(t, "exam")

      // Premier paiement
      await admin.asAdmin.mutation(api.payments.recordManualPayment, {
        userId: user.userId,
        productCode: "exam_access",
        amountPaid: 5000,
        currency: "CAD",
        paymentMethod: "interac",
      })

      const firstAccess = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", user.userId).eq("accessType", "exam"),
          )
          .unique()
      })

      // Deuxième paiement
      await admin.asAdmin.mutation(api.payments.recordManualPayment, {
        userId: user.userId,
        productCode: "exam_access",
        amountPaid: 5000,
        currency: "CAD",
        paymentMethod: "cash",
      })

      const extendedAccess = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", user.userId).eq("accessType", "exam"),
          )
          .unique()
      })

      // L'accès doit être étendu (pas dupliqué)
      expect(extendedAccess).not.toBeNull()
      expect(extendedAccess?.expiresAt).toBeGreaterThan(firstAccess?.expiresAt ?? 0)
    })

    it("gère les deux types d'accès indépendamment", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      await getOrCreateProduct(t, "exam")
      await getOrCreateProduct(t, "training")

      // Paiement exam
      await admin.asAdmin.mutation(api.payments.recordManualPayment, {
        userId: user.userId,
        productCode: "exam_access",
        amountPaid: 5000,
        currency: "CAD",
        paymentMethod: "interac",
      })

      // Paiement training
      await admin.asAdmin.mutation(api.payments.recordManualPayment, {
        userId: user.userId,
        productCode: "training_access",
        amountPaid: 3000,
        currency: "CAD",
        paymentMethod: "cash",
      })

      const allAccess = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAccess")
          .withIndex("by_userId", (q) => q.eq("userId", user.userId))
          .collect()
      })

      expect(allAccess).toHaveLength(2)
      expect(allAccess.map((a) => a.accessType).sort()).toEqual(["exam", "training"])
    })
  })

  describe("Vérification d'accès pour examens", () => {
    it("autorise le démarrage d'examen avec accès valide", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      await getOrCreateProduct(t, "exam")

      // Créer une question pour l'examen
      const questionId = await t.run(async (ctx) => {
        return await ctx.db.insert("questions", {
          question: "Test question",
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
          explanation: "Test",
          domain: "Test",
          objectifCMC: "OBJ1",
        })
      })

      // Créer l'examen
      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen test",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
      })

      // Ajouter l'accès exam
      await admin.asAdmin.mutation(api.payments.recordManualPayment, {
        userId: user.userId,
        productCode: "exam_access",
        amountPaid: 5000,
        currency: "CAD",
        paymentMethod: "interac",
      })

      // Démarrer l'examen (devrait fonctionner)
      const result = await user.asUser.mutation(api.exams.startExam, { examId })
      expect(result).toBeDefined()
    })

    it("refuse le démarrage d'examen sans accès", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)

      // Créer une question pour l'examen
      const questionId = await t.run(async (ctx) => {
        return await ctx.db.insert("questions", {
          question: "Test question",
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
          explanation: "Test",
          domain: "Test",
          objectifCMC: "OBJ1",
        })
      })

      // Créer l'examen
      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen test",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
      })

      // Pas d'accès - devrait échouer
      await expect(
        user.asUser.mutation(api.exams.startExam, { examId }),
      ).rejects.toThrow()
    })

    it("refuse le démarrage d'examen avec accès expiré", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      await getOrCreateProduct(t, "exam")

      // Créer une question pour l'examen
      const questionId = await t.run(async (ctx) => {
        return await ctx.db.insert("questions", {
          question: "Test question",
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
          explanation: "Test",
          domain: "Test",
          objectifCMC: "OBJ1",
        })
      })

      // Créer l'examen
      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen test",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
      })

      // Créer un accès expiré directement
      await t.run(async (ctx) => {
        const productId = await ctx.db
          .query("products")
          .filter((q) => q.eq(q.field("code"), "exam_access"))
          .first()

        const transactionId = await ctx.db.insert("transactions", {
          userId: user.userId,
          productId: productId!._id,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: now - 1000, // Expiré
          createdAt: now - 31 * 24 * 60 * 60 * 1000,
        })

        await ctx.db.insert("userAccess", {
          userId: user.userId,
          accessType: "exam",
          expiresAt: now - 1000, // Expiré
          lastTransactionId: transactionId,
        })
      })

      // Devrait échouer car l'accès est expiré
      await expect(
        user.asUser.mutation(api.exams.startExam, { examId }),
      ).rejects.toThrow()
    })

    it("autorise l'admin sans accès payant (bypass)", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)

      // Créer une question pour l'examen
      const questionId = await t.run(async (ctx) => {
        return await ctx.db.insert("questions", {
          question: "Test question",
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
          explanation: "Test",
          domain: "Test",
          objectifCMC: "OBJ1",
        })
      })

      // Créer l'examen
      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen test",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
      })

      // L'admin peut démarrer sans accès payant
      const result = await admin.asAdmin.mutation(api.exams.startExam, { examId })
      expect(result).toBeDefined()
    })
  })

  describe("Révocation d'accès", () => {
    it("supprime l'accès quand la dernière transaction est refundée", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      await getOrCreateProduct(t, "exam")

      // Créer un paiement
      await admin.asAdmin.mutation(api.payments.recordManualPayment, {
        userId: user.userId,
        productCode: "exam_access",
        amountPaid: 5000,
        currency: "CAD",
        paymentMethod: "interac",
      })

      // Récupérer la transaction
      const transaction = await t.run(async (ctx) => {
        return await ctx.db
          .query("transactions")
          .withIndex("by_userId", (q) => q.eq("userId", user.userId))
          .first()
      })

      // Refund la transaction via updateManualTransaction
      await admin.asAdmin.mutation(api.payments.updateManualTransaction, {
        transactionId: transaction!._id,
        amountPaid: 5000,
        currency: "CAD",
        paymentMethod: "interac",
        status: "refunded",
      })

      // L'accès doit être supprimé
      const access = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", user.userId).eq("accessType", "exam"),
          )
          .unique()
      })

      expect(access).toBeNull()
    })

    it("conserve l'accès si une transaction plus récente existe", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      await getOrCreateProduct(t, "exam")

      // Premier paiement
      await admin.asAdmin.mutation(api.payments.recordManualPayment, {
        userId: user.userId,
        productCode: "exam_access",
        amountPaid: 5000,
        currency: "CAD",
        paymentMethod: "interac",
      })

      const firstTransaction = await t.run(async (ctx) => {
        return await ctx.db
          .query("transactions")
          .withIndex("by_userId", (q) => q.eq("userId", user.userId))
          .first()
      })

      // Deuxième paiement
      await admin.asAdmin.mutation(api.payments.recordManualPayment, {
        userId: user.userId,
        productCode: "exam_access",
        amountPaid: 5000,
        currency: "CAD",
        paymentMethod: "cash",
      })

      // Refund la première transaction (pas la dernière) via updateManualTransaction
      await admin.asAdmin.mutation(api.payments.updateManualTransaction, {
        transactionId: firstTransaction!._id,
        amountPaid: 5000,
        currency: "CAD",
        paymentMethod: "interac",
        status: "refunded",
      })

      // L'accès doit être conservé (car la 2e transaction est la dernière)
      const access = await t.run(async (ctx) => {
        return await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", user.userId).eq("accessType", "exam"),
          )
          .unique()
      })

      expect(access).not.toBeNull()
    })
  })

  describe("Requêtes d'accès", () => {
    it("retourne les accès expirant bientôt", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2")
      await getOrCreateProduct(t, "exam")

      const now = Date.now()

      // User1: accès qui expire dans 3 jours
      await t.run(async (ctx) => {
        const productId = await ctx.db
          .query("products")
          .filter((q) => q.eq(q.field("code"), "exam_access"))
          .first()

        const transactionId = await ctx.db.insert("transactions", {
          userId: user1.userId,
          productId: productId!._id,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: now + 3 * 24 * 60 * 60 * 1000,
          createdAt: now,
        })

        await ctx.db.insert("userAccess", {
          userId: user1.userId,
          accessType: "exam",
          expiresAt: now + 3 * 24 * 60 * 60 * 1000,
          lastTransactionId: transactionId,
        })
      })

      // User2: accès qui expire dans 30 jours (pas bientôt)
      await admin.asAdmin.mutation(api.payments.recordManualPayment, {
        userId: user2.userId,
        productCode: "exam_access",
        amountPaid: 5000,
        currency: "CAD",
        paymentMethod: "interac",
      })

      const expiringSoon = await admin.asAdmin.query(api.payments.getExpiringAccess)

      // Seul user1 devrait apparaître (expire dans moins de 7 jours)
      const expiringUserIds = expiringSoon.map((a) => a.userId)
      expect(expiringUserIds).toContain(user1.userId)
      expect(expiringUserIds).not.toContain(user2.userId)
    })
  })
})
