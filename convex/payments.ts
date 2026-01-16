import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { Id } from "./_generated/dataModel"
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import {
  getAdminUserOrThrow,
  getCurrentUserOrNull,
  getCurrentUserOrThrow,
} from "./lib/auth"

// ============================================
// TYPE DEFINITIONS
// ============================================

export type ProductCode =
  | "exam_access"
  | "training_access"
  | "exam_access_promo"
  | "training_access_promo"

export type AccessType = "exam" | "training"

const productCodeValidator = v.union(
  v.literal("exam_access"),
  v.literal("training_access"),
  v.literal("exam_access_promo"),
  v.literal("training_access_promo"),
)

const accessTypeValidator = v.union(v.literal("exam"), v.literal("training"))

// ============================================
// QUERIES - User Access
// ============================================

/**
 * Vérifie si l'utilisateur a un accès actif aux examens
 */
export const hasExamAccess = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) return false

    // Les admins ont toujours accès
    if (user.role === "admin") return true

    const access = await ctx.db
      .query("userAccess")
      .withIndex("by_userId_accessType", (q) =>
        q.eq("userId", user._id).eq("accessType", "exam"),
      )
      .unique()

    return access !== null && access.expiresAt > Date.now()
  },
})

/**
 * Vérifie si l'utilisateur a un accès actif à l'entraînement
 */
export const hasTrainingAccess = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) return false

    if (user.role === "admin") return true

    const access = await ctx.db
      .query("userAccess")
      .withIndex("by_userId_accessType", (q) =>
        q.eq("userId", user._id).eq("accessType", "training"),
      )
      .unique()

    return access !== null && access.expiresAt > Date.now()
  },
})

/**
 * Récupère le statut d'accès complet de l'utilisateur
 */
export const getMyAccessStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return null
    }

    const accessRecords = await ctx.db
      .query("userAccess")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    const now = Date.now()

    const examAccess = accessRecords.find(
      (a) => a.accessType === "exam" && a.expiresAt > now,
    )
    const trainingAccess = accessRecords.find(
      (a) => a.accessType === "training" && a.expiresAt > now,
    )

    return {
      examAccess: examAccess
        ? {
            expiresAt: examAccess.expiresAt,
            daysRemaining: Math.ceil(
              (examAccess.expiresAt - now) / (24 * 60 * 60 * 1000),
            ),
          }
        : null,
      trainingAccess: trainingAccess
        ? {
            expiresAt: trainingAccess.expiresAt,
            daysRemaining: Math.ceil(
              (trainingAccess.expiresAt - now) / (24 * 60 * 60 * 1000),
            ),
          }
        : null,
    }
  },
})

// ============================================
// QUERIES - Products
// ============================================

/**
 * Récupère les produits actifs disponibles à l'achat
 */
export const getAvailableProducts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("products")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect()
  },
})

/**
 * [Internal] Récupère un produit par son code
 */
export const getProductByCode = internalQuery({
  args: { code: productCodeValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("products")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique()
  },
})

// ============================================
// QUERIES - Transactions
// ============================================

/**
 * Récupère l'historique des transactions de l'utilisateur
 * Note: Les transactions "pending" (checkouts abandonnés) sont masquées
 */
export const getMyTransactions = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(args.paginationOpts)

    // Filtrer les transactions "pending" (checkouts non complétés)
    // et enrichir avec les détails du produit
    const enrichedPage = await Promise.all(
      transactions.page
        .filter((tx) => tx.status !== "pending")
        .map(async (tx) => {
          const product = await ctx.db.get(tx.productId)
          return { ...tx, product }
        }),
    )

    return {
      ...transactions,
      page: enrichedPage,
    }
  },
})

/**
 * [Admin] Récupère toutes les transactions avec filtres
 */
export const getAllTransactions = query({
  args: {
    paginationOpts: paginationOptsValidator,
    type: v.optional(v.union(v.literal("stripe"), v.literal("manual"))),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("refunded"),
      ),
    ),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    // Construire la requête avec le bon index selon les filtres
    const buildQuery = () => {
      if (args.userId) {
        return ctx.db
          .query("transactions")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId!))
      }
      if (args.type) {
        return ctx.db
          .query("transactions")
          .withIndex("by_type", (q) => q.eq("type", args.type!))
      }
      if (args.status) {
        return ctx.db
          .query("transactions")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
      }
      return ctx.db.query("transactions").withIndex("by_createdAt")
    }

    const result = await buildQuery()
      .order("desc")
      .paginate(args.paginationOpts)

    // Enrichir avec les détails utilisateur et produit
    const enrichedPage = await Promise.all(
      result.page.map(async (tx) => {
        const [user, product, recordedByUser] = await Promise.all([
          ctx.db.get(tx.userId),
          ctx.db.get(tx.productId),
          tx.recordedBy ? ctx.db.get(tx.recordedBy) : null,
        ])
        return { ...tx, user, product, recordedByUser }
      }),
    )

    // Filtrer côté client si plusieurs filtres sont combinés
    let filteredPage = enrichedPage
    if (args.type && args.userId) {
      filteredPage = filteredPage.filter((tx) => tx.type === args.type)
    }
    if (args.status && (args.userId || args.type)) {
      filteredPage = filteredPage.filter((tx) => tx.status === args.status)
    }

    return {
      ...result,
      page: filteredPage,
    }
  },
})

/**
 * [Admin] Statistiques des transactions pour le dashboard
 */
export const getTransactionStats = query({
  args: {},
  handler: async (ctx) => {
    await getAdminUserOrThrow(ctx)

    const completedTransactions = await ctx.db
      .query("transactions")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect()

    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

    const recentTransactions = completedTransactions.filter(
      (tx) => tx.completedAt && tx.completedAt > thirtyDaysAgo,
    )

    const totalRevenue = completedTransactions.reduce(
      (sum, tx) => sum + tx.amountPaid,
      0,
    )
    const recentRevenue = recentTransactions.reduce(
      (sum, tx) => sum + tx.amountPaid,
      0,
    )

    return {
      totalRevenue,
      totalTransactions: completedTransactions.length,
      recentRevenue,
      recentTransactions: recentTransactions.length,
      stripeTransactions: completedTransactions.filter(
        (tx) => tx.type === "stripe",
      ).length,
      manualTransactions: completedTransactions.filter(
        (tx) => tx.type === "manual",
      ).length,
    }
  },
})

/**
 * [Admin] Récupère le statut d'accès d'un utilisateur spécifique
 */
export const getUserAccessStatus = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    const accessRecords = await ctx.db
      .query("userAccess")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect()

    const now = Date.now()

    const examAccess = accessRecords.find(
      (a) => a.accessType === "exam" && a.expiresAt > now,
    )
    const trainingAccess = accessRecords.find(
      (a) => a.accessType === "training" && a.expiresAt > now,
    )

    return {
      examAccess: examAccess
        ? {
            expiresAt: examAccess.expiresAt,
            daysRemaining: Math.ceil(
              (examAccess.expiresAt - now) / (24 * 60 * 60 * 1000),
            ),
          }
        : null,
      trainingAccess: trainingAccess
        ? {
            expiresAt: trainingAccess.expiresAt,
            daysRemaining: Math.ceil(
              (trainingAccess.expiresAt - now) / (24 * 60 * 60 * 1000),
            ),
          }
        : null,
    }
  },
})

// ============================================
// INTERNAL MUTATIONS - Stripe Webhooks
// ============================================

/**
 * [Internal] Crée une transaction en attente pour Stripe checkout
 */
export const createPendingTransaction = internalMutation({
  args: {
    userId: v.id("users"),
    productId: v.id("products"),
    stripeSessionId: v.string(),
    amountPaid: v.number(),
    currency: v.string(),
    accessType: accessTypeValidator,
    durationDays: v.number(),
  },
  handler: async (ctx, args) => {
    // Calculer l'expiration avec cumul du temps
    const existingAccess = await ctx.db
      .query("userAccess")
      .withIndex("by_userId_accessType", (q) =>
        q.eq("userId", args.userId).eq("accessType", args.accessType),
      )
      .unique()

    const now = Date.now()
    const baseTime =
      existingAccess && existingAccess.expiresAt > now
        ? existingAccess.expiresAt
        : now
    const accessExpiresAt = baseTime + args.durationDays * 24 * 60 * 60 * 1000

    return await ctx.db.insert("transactions", {
      userId: args.userId,
      productId: args.productId,
      type: "stripe",
      status: "pending",
      amountPaid: args.amountPaid,
      currency: args.currency,
      stripeSessionId: args.stripeSessionId,
      accessType: args.accessType,
      durationDays: args.durationDays,
      accessExpiresAt,
      createdAt: now,
    })
  },
})

/**
 * [Internal] Complète une transaction Stripe et active l'accès
 */
export const completeStripeTransaction = internalMutation({
  args: {
    stripeSessionId: v.string(),
    stripePaymentIntentId: v.string(),
    stripeEventId: v.string(),
  },
  handler: async (ctx, args) => {
    // Vérification idempotence - si event déjà traité, skip
    const existingByEvent = await ctx.db
      .query("transactions")
      .withIndex("by_stripeEventId", (q) =>
        q.eq("stripeEventId", args.stripeEventId),
      )
      .first()

    if (existingByEvent) {
      return { success: true, alreadyProcessed: true }
    }

    // Trouver la transaction en attente
    const transaction = await ctx.db
      .query("transactions")
      .withIndex("by_stripeSessionId", (q) =>
        q.eq("stripeSessionId", args.stripeSessionId),
      )
      .unique()

    if (!transaction) {
      throw new Error(
        "Transaction non trouvée pour la session: " + args.stripeSessionId,
      )
    }

    if (transaction.status === "completed") {
      return { success: true, alreadyProcessed: true }
    }

    const now = Date.now()

    // Mettre à jour la transaction
    await ctx.db.patch(transaction._id, {
      status: "completed",
      stripePaymentIntentId: args.stripePaymentIntentId,
      stripeEventId: args.stripeEventId,
      completedAt: now,
    })

    // Mettre à jour ou créer l'accès utilisateur
    await updateUserAccess(
      ctx,
      transaction.userId,
      transaction.accessType,
      transaction.accessExpiresAt,
      transaction._id,
    )

    return { success: true, transactionId: transaction._id }
  },
})

/**
 * [Internal] Marque une transaction Stripe comme échouée
 */
export const failStripeTransaction = internalMutation({
  args: {
    stripeSessionId: v.string(),
    stripeEventId: v.string(),
  },
  handler: async (ctx, args) => {
    // Vérification idempotence
    const existingByEvent = await ctx.db
      .query("transactions")
      .withIndex("by_stripeEventId", (q) =>
        q.eq("stripeEventId", args.stripeEventId),
      )
      .first()

    if (existingByEvent) {
      return { success: true, alreadyProcessed: true }
    }

    const transaction = await ctx.db
      .query("transactions")
      .withIndex("by_stripeSessionId", (q) =>
        q.eq("stripeSessionId", args.stripeSessionId),
      )
      .unique()

    if (!transaction) {
      return { success: false, error: "Transaction non trouvée" }
    }

    await ctx.db.patch(transaction._id, {
      status: "failed",
      stripeEventId: args.stripeEventId,
    })

    return { success: true }
  },
})

// ============================================
// MUTATIONS - Manual Transactions (Admin)
// ============================================

/**
 * [Admin] Enregistre un paiement manuel
 */
export const recordManualPayment = mutation({
  args: {
    userId: v.id("users"),
    productCode: productCodeValidator,
    amountPaid: v.number(),
    currency: v.string(),
    paymentMethod: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUserOrThrow(ctx)

    // Récupérer le produit
    const product = await ctx.db
      .query("products")
      .withIndex("by_code", (q) => q.eq("code", args.productCode))
      .unique()

    if (!product) {
      throw new Error("Produit non trouvé: " + args.productCode)
    }

    // Vérifier que l'utilisateur cible existe
    const targetUser = await ctx.db.get(args.userId)
    if (!targetUser) {
      throw new Error("Utilisateur non trouvé")
    }

    // Calculer l'expiration avec cumul
    const existingAccess = await ctx.db
      .query("userAccess")
      .withIndex("by_userId_accessType", (q) =>
        q.eq("userId", args.userId).eq("accessType", product.accessType),
      )
      .unique()

    const now = Date.now()
    const baseTime =
      existingAccess && existingAccess.expiresAt > now
        ? existingAccess.expiresAt
        : now
    const accessExpiresAt =
      baseTime + product.durationDays * 24 * 60 * 60 * 1000

    // Créer la transaction complétée
    const transactionId = await ctx.db.insert("transactions", {
      userId: args.userId,
      productId: product._id,
      type: "manual",
      status: "completed",
      amountPaid: args.amountPaid,
      currency: args.currency,
      paymentMethod: args.paymentMethod,
      recordedBy: admin._id,
      notes: args.notes,
      accessType: product.accessType,
      durationDays: product.durationDays,
      accessExpiresAt,
      createdAt: now,
      completedAt: now,
    })

    // Mettre à jour l'accès utilisateur
    await updateUserAccess(
      ctx,
      args.userId,
      product.accessType,
      accessExpiresAt,
      transactionId,
    )

    return { success: true, transactionId }
  },
})

// ============================================
// MUTATIONS - Product Management (Admin)
// ============================================

/**
 * [Admin] Crée ou met à jour un produit
 */
export const upsertProduct = mutation({
  args: {
    code: productCodeValidator,
    name: v.string(),
    description: v.string(),
    priceCAD: v.number(),
    durationDays: v.number(),
    accessType: accessTypeValidator,
    stripeProductId: v.string(),
    stripePriceId: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    const existing = await ctx.db
      .query("products")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        description: args.description,
        priceCAD: args.priceCAD,
        durationDays: args.durationDays,
        accessType: args.accessType,
        stripeProductId: args.stripeProductId,
        stripePriceId: args.stripePriceId,
        isActive: args.isActive,
      })
      return { success: true, productId: existing._id, updated: true }
    } else {
      const productId = await ctx.db.insert("products", args)
      return { success: true, productId, updated: false }
    }
  },
})

/**
 * [Internal] Seed les produits initiaux
 */
export const seedProducts = internalMutation({
  args: {
    products: v.array(
      v.object({
        code: productCodeValidator,
        name: v.string(),
        description: v.string(),
        priceCAD: v.number(),
        durationDays: v.number(),
        accessType: accessTypeValidator,
        stripeProductId: v.string(),
        stripePriceId: v.string(),
        isActive: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const product of args.products) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_code", (q) => q.eq("code", product.code))
        .unique()

      if (!existing) {
        await ctx.db.insert("products", product)
      }
    }
  },
})

// ============================================
// QUERIES - Transaction Access Impact (Admin)
// ============================================

/**
 * [Admin] Vérifie si la suppression d'une transaction révoquera l'accès utilisateur
 */
export const getTransactionAccessImpact = query({
  args: {
    transactionId: v.id("transactions"),
  },
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    const transaction = await ctx.db.get(args.transactionId)
    if (!transaction) {
      throw new Error("Transaction non trouvée")
    }

    // Trouver l'enregistrement d'accès pour cet utilisateur/type
    const userAccess = await ctx.db
      .query("userAccess")
      .withIndex("by_userId_accessType", (q) =>
        q
          .eq("userId", transaction.userId)
          .eq("accessType", transaction.accessType),
      )
      .unique()

    // Vérifier si cette transaction est la dernière (lastTransactionId)
    const isLastTransaction = userAccess?.lastTransactionId === args.transactionId

    return {
      willRevokeAccess: isLastTransaction,
      currentAccessExpiresAt: userAccess?.expiresAt ?? null,
      accessType: transaction.accessType,
    }
  },
})

// ============================================
// MUTATIONS - Edit/Delete Manual Transactions (Admin)
// ============================================

/**
 * [Admin] Modifie une transaction manuelle
 */
export const updateManualTransaction = mutation({
  args: {
    transactionId: v.id("transactions"),
    amountPaid: v.number(),
    currency: v.string(),
    paymentMethod: v.string(),
    notes: v.optional(v.string()),
    status: v.optional(v.union(v.literal("completed"), v.literal("refunded"))),
  },
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    // Récupérer la transaction
    const transaction = await ctx.db.get(args.transactionId)
    if (!transaction) {
      throw new Error("Transaction non trouvée")
    }

    // Vérifier que c'est une transaction manuelle
    if (transaction.type !== "manual") {
      throw new Error("Seules les transactions manuelles peuvent être modifiées")
    }

    // Si le statut passe à "refunded", révoquer l'accès
    if (args.status === "refunded" && transaction.status === "completed") {
      await handleAccessRevocation(ctx, transaction)
    }

    // Mettre à jour la transaction
    await ctx.db.patch(args.transactionId, {
      amountPaid: args.amountPaid,
      currency: args.currency,
      paymentMethod: args.paymentMethod,
      notes: args.notes,
      ...(args.status && { status: args.status }),
    })

    return { success: true }
  },
})

/**
 * [Admin] Supprime une transaction manuelle
 */
export const deleteManualTransaction = mutation({
  args: {
    transactionId: v.id("transactions"),
  },
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    // Récupérer la transaction
    const transaction = await ctx.db.get(args.transactionId)
    if (!transaction) {
      throw new Error("Transaction non trouvée")
    }

    // Vérifier que c'est une transaction manuelle
    if (transaction.type !== "manual") {
      throw new Error("Seules les transactions manuelles peuvent être supprimées")
    }

    // Vérifier l'impact sur l'accès et révoquer si nécessaire
    const accessRevoked = await handleAccessRevocation(ctx, transaction)

    // Supprimer la transaction
    await ctx.db.delete(args.transactionId)

    return { success: true, accessRevoked }
  },
})

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Révoque l'accès utilisateur si cette transaction est la dernière
 * Retourne true si l'accès a été révoqué
 */
const handleAccessRevocation = async (
  ctx: MutationCtx,
  transaction: { _id: Id<"transactions">; userId: Id<"users">; accessType: "exam" | "training" },
): Promise<boolean> => {
  const userAccess = await ctx.db
    .query("userAccess")
    .withIndex("by_userId_accessType", (q) =>
      q.eq("userId", transaction.userId).eq("accessType", transaction.accessType),
    )
    .unique()

  // Supprimer l'accès uniquement si cette transaction est la dernière
  if (userAccess && userAccess.lastTransactionId === transaction._id) {
    await ctx.db.delete(userAccess._id)
    return true
  }

  return false
}

/**
 * Met à jour ou crée un enregistrement d'accès utilisateur
 */
const updateUserAccess = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  accessType: "exam" | "training",
  expiresAt: number,
  transactionId: Id<"transactions">,
) => {
  const existingAccess = await ctx.db
    .query("userAccess")
    .withIndex("by_userId_accessType", (q) =>
      q.eq("userId", userId).eq("accessType", accessType),
    )
    .unique()

  if (existingAccess) {
    // Toujours utiliser la date d'expiration la plus tardive
    const newExpiresAt = Math.max(existingAccess.expiresAt, expiresAt)
    await ctx.db.patch(existingAccess._id, {
      expiresAt: newExpiresAt,
      lastTransactionId: transactionId,
    })
  } else {
    await ctx.db.insert("userAccess", {
      userId,
      accessType,
      expiresAt,
      lastTransactionId: transactionId,
    })
  }
}
