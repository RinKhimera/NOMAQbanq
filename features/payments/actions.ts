"use server"

import { asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/db"
import { products, transactions } from "@/db/schema"
import { requireRole, requireSession } from "@/lib/auth-guards"
import { getBaseUrl } from "@/lib/base-url"
import { createId } from "@/lib/ids"
import { captureServerError } from "@/lib/observability"
import { getStripe } from "@/lib/stripe"
import {
  type AccessImpact,
  type AccessStatus,
  type AdminTransactionsPage,
  type MyTransactionsPage,
  type TransactionStatsView,
  getAccessStatus,
  getAllTransactions,
  getMyTransactions,
  getTransactionAccessImpact,
  getTransactionStats,
} from "./dal"
import { grantManualAccess, revokeAccessIfLast } from "./lib"
import {
  type RecordManualPaymentInput,
  type UpdateManualTransactionInput,
  recordManualPaymentSchema,
  updateManualTransactionSchema,
} from "./schemas"

// Duck-check (évite d'importer les classes d'erreur Stripe pour un seul code).
const isStripeResourceMissing = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === "resource_missing"

/**
 * Charge la page suivante de l'historique des transactions de l'utilisateur
 * courant (pagination keyset). Appelée dans un `startTransition` côté client.
 */
export const loadMoreMyTransactions = async (
  cursor: string,
): Promise<MyTransactionsPage> => {
  await requireSession()
  return getMyTransactions({ cursor })
}

/**
 * [Admin] Charge une page de l'historique global (filtres + pagination keyset).
 * Appelée côté client au changement de filtre et au « charger plus ». La garde
 * admin est dans `getAllTransactions`, redoublée ici par cohérence avec les
 * mutations.
 */
export const loadAdminTransactions = async (params: {
  cursor?: string | null
  type?: "stripe" | "manual"
  status?: "pending" | "completed" | "failed" | "refunded"
  userId?: string
}): Promise<AdminTransactionsPage> => {
  await requireRole(["admin"])
  return getAllTransactions(params)
}

/** [Admin] Statistiques transactions — rafraîchies après une mutation. */
export const loadTransactionStats = async (): Promise<TransactionStatsView> => {
  await requireRole(["admin"])
  return getTransactionStats()
}

/**
 * [Admin] Impact d'accès d'une transaction (le modal édition/suppression l'appelle
 * à l'ouverture pour afficher l'avertissement de révocation). `null` si introuvable.
 */
export const loadTransactionAccessImpact = async (
  transactionId: string,
): Promise<AccessImpact | null> => {
  await requireRole(["admin"])
  return getTransactionAccessImpact(transactionId)
}

/**
 * [Admin] Statut d'accès (exam/training) d'un utilisateur donné — rechargé après
 * un octroi manuel sur la page détail. Garde admin (IDOR : userId arbitraire).
 */
export const loadUserAccessStatus = async (
  userId: string,
): Promise<AccessStatus> => {
  await requireRole(["admin"])
  const status = await getAccessStatus(userId)
  return status ?? { examAccess: null, trainingAccess: null }
}

const revalidatePaymentsAdmin = () => {
  revalidatePath("/admin/transactions")
  revalidatePath("/admin/utilisateurs")
}

export type ManualPaymentResult = {
  success: boolean
  transactionId?: string
  error?: string
}

/**
 * [Admin] Enregistre un paiement manuel et accorde l'accès correspondant.
 * Tout est atomique (`db.transaction`) avec verrou utilisateur (cf. `grantManualAccess`).
 */
export const recordManualPayment = async (
  input: RecordManualPaymentInput,
): Promise<ManualPaymentResult> => {
  const session = await requireRole(["admin"])

  const parsed = recordManualPaymentSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides",
    }
  }
  const data = parsed.data

  try {
    const transactionId = await db.transaction(async (tx) => {
      // `products.code` n'a pas (encore) de contrainte UNIQUE → `ORDER BY id`
      // rend le choix déterministe en cas de doublon (contrainte ajoutée à la
      // bascule, une fois les tests d'intégration rendus upsert-safe).
      const [product] = await tx
        .select({
          id: products.id,
          accessType: products.accessType,
          durationDays: products.durationDays,
          isCombo: products.isCombo,
        })
        .from(products)
        .where(eq(products.code, data.productCode))
        .orderBy(asc(products.id))
        .limit(1)
      if (!product) throw new Error("PRODUCT_NOT_FOUND")

      return grantManualAccess(tx, {
        userId: data.userId,
        product,
        amountPaid: data.amountPaid,
        currency: data.currency,
        paymentMethod: data.paymentMethod,
        notes: data.notes ?? null,
        recordedBy: session.user.id,
      })
    })

    revalidatePaymentsAdmin()
    return { success: true, transactionId }
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return { success: false, error: "Produit introuvable" }
    }
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return { success: false, error: "Utilisateur introuvable" }
    }
    captureServerError("[recordManualPayment]", error, {
      userId: session.user.id,
    })
    return { success: false, error: "Erreur serveur. Réessayez." }
  }
}

/**
 * [Admin] Modifie une transaction MANUELLE. Si le statut passe `completed → refunded`,
 * révoque l'accès si cette transaction l'avait accordé en dernier. Atomique.
 */
export const updateManualTransaction = async (
  input: UpdateManualTransactionInput,
): Promise<{ success: boolean; error?: string }> => {
  await requireRole(["admin"])

  const parsed = updateManualTransactionSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides",
    }
  }
  const data = parsed.data

  try {
    await db.transaction(async (tx) => {
      const [transaction] = await tx
        .select({
          id: transactions.id,
          userId: transactions.userId,
          type: transactions.type,
          status: transactions.status,
        })
        .from(transactions)
        .where(eq(transactions.id, data.transactionId))
        .limit(1)
      if (!transaction) throw new Error("TX_NOT_FOUND")
      if (transaction.type !== "manual") throw new Error("TX_NOT_MANUAL")

      if (data.status === "refunded" && transaction.status === "completed") {
        await revokeAccessIfLast(tx, {
          id: transaction.id,
          userId: transaction.userId,
        })
      }

      await tx
        .update(transactions)
        .set({
          amountPaid: data.amountPaid,
          currency: data.currency,
          paymentMethod: data.paymentMethod,
          notes: data.notes ?? null,
          ...(data.status ? { status: data.status } : {}),
        })
        .where(eq(transactions.id, data.transactionId))
    })

    revalidatePaymentsAdmin()
    return { success: true }
  } catch (error) {
    if (error instanceof Error && error.message === "TX_NOT_FOUND") {
      return { success: false, error: "Transaction introuvable" }
    }
    if (error instanceof Error && error.message === "TX_NOT_MANUAL") {
      return {
        success: false,
        error: "Seules les transactions manuelles peuvent être modifiées",
      }
    }
    captureServerError("[updateManualTransaction]", error)
    return { success: false, error: "Erreur serveur. Réessayez." }
  }
}

/**
 * [Admin] Supprime une transaction MANUELLE et révoque l'accès si elle l'avait
 * accordé en dernier. Atomique.
 */
export const deleteManualTransaction = async (
  transactionId: string,
): Promise<{ success: boolean; accessRevoked?: boolean; error?: string }> => {
  await requireRole(["admin"])

  if (!transactionId) {
    return { success: false, error: "Transaction requise" }
  }

  try {
    const accessRevoked = await db.transaction(async (tx) => {
      const [transaction] = await tx
        .select({
          id: transactions.id,
          userId: transactions.userId,
          type: transactions.type,
        })
        .from(transactions)
        .where(eq(transactions.id, transactionId))
        .limit(1)
      if (!transaction) throw new Error("TX_NOT_FOUND")
      if (transaction.type !== "manual") throw new Error("TX_NOT_MANUAL")

      const revoked = await revokeAccessIfLast(tx, {
        id: transaction.id,
        userId: transaction.userId,
      })
      await tx.delete(transactions).where(eq(transactions.id, transactionId))
      return revoked
    })

    revalidatePaymentsAdmin()
    return { success: true, accessRevoked }
  } catch (error) {
    if (error instanceof Error && error.message === "TX_NOT_FOUND") {
      return { success: false, error: "Transaction introuvable" }
    }
    if (error instanceof Error && error.message === "TX_NOT_MANUAL") {
      return {
        success: false,
        error: "Seules les transactions manuelles peuvent être supprimées",
      }
    }
    captureServerError("[deleteManualTransaction]", error)
    return { success: false, error: "Erreur serveur. Réessayez." }
  }
}

// ============================================
// Stripe (checkout / vérification / portail)
// ============================================

const DAY_MS = 24 * 60 * 60 * 1000

// N'accepte qu'un chemin interne (anti open-redirect via les URLs Stripe) :
// commence par "/" mais pas "//" (qui serait un //host externe).
const safePath = (p: unknown, fallback: string): string =>
  typeof p === "string" && p.startsWith("/") && !p.startsWith("//")
    ? p
    : fallback

const appBase = getBaseUrl

export type CheckoutResult = { checkoutUrl: string } | { error: string }

/**
 * Crée une session Stripe Checkout (paiement unique) pour le produit demandé et
 * insère la transaction `pending`.
 * `successPath`/`cancelPath` sont des chemins internes (validés) ; les URLs absolues
 * sont reconstruites côté serveur depuis `BETTER_AUTH_URL`. L'accès n'est accordé
 * qu'au webhook (`checkout.session.completed`).
 */
export const createStripeCheckout = async (input: {
  productCode: string
  successPath: string
  cancelPath: string
}): Promise<CheckoutResult> => {
  const session = await requireSession()

  const codes = products.code.enumValues as readonly string[]
  if (!codes.includes(input.productCode)) return { error: "Produit invalide" }
  const productCode =
    input.productCode as (typeof products.code.enumValues)[number]

  const [product] = await db
    .select({
      id: products.id,
      stripePriceId: products.stripePriceId,
      priceCad: products.priceCad,
      accessType: products.accessType,
      durationDays: products.durationDays,
      isCombo: products.isCombo,
      isActive: products.isActive,
    })
    .from(products)
    .where(eq(products.code, productCode))
    .orderBy(asc(products.id))
    .limit(1)
  if (!product) return { error: "Produit introuvable" }
  if (!product.isActive) return { error: "Ce produit n'est plus disponible" }

  try {
    const stripe = getStripe()
    const base = appBase()
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: session.user.email,
      // Force la création d'un customer Stripe (nécessaire au portail de facturation).
      customer_creation: "always",
      line_items: [{ price: product.stripePriceId, quantity: 1 }],
      metadata: {
        userId: session.user.id,
        productId: product.id,
        productCode,
        accessType: product.accessType,
        durationDays: String(product.durationDays),
        isCombo: product.isCombo ? "true" : "false",
      },
      success_url: `${base}${safePath(input.successPath, "/tableau-de-bord")}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}${safePath(input.cancelPath, "/tarifs")}`,
      allow_promotion_codes: true,
    })
    if (!checkout.url) {
      return { error: "Échec de création de la session de paiement" }
    }

    const now = new Date()
    await db.insert(transactions).values({
      id: createId(),
      userId: session.user.id,
      productId: product.id,
      type: "stripe",
      status: "pending",
      amountPaid: product.priceCad,
      currency: "CAD",
      stripeSessionId: checkout.id,
      accessType: product.accessType,
      durationDays: product.durationDays,
      // Provisoire : l'expiration définitive est recalculée au fulfillment (webhook).
      accessExpiresAt: new Date(now.getTime() + product.durationDays * DAY_MS),
      createdAt: now,
    })

    return { checkoutUrl: checkout.url }
  } catch (error) {
    captureServerError("[createStripeCheckout]", error, {
      userId: session.user.id,
    })
    return { error: "Erreur lors de la création du paiement. Réessayez." }
  }
}

export type VerifyCheckoutResult =
  | {
      success: true
      status: string
      amountTotal: number | null
      currency: string | null
      customerEmail: string | null
    }
  | { success: false; error: string }

/**
 * Vérifie le statut d'une session Checkout (page de succès) : refuse la session si elle
 * n'appartient pas à l'utilisateur courant (anti-IDOR via `metadata.userId`).
 * Le crédit d'accès reste géré par le webhook, pas ici.
 */
export const verifyStripeCheckout = async (
  sessionId: string,
): Promise<VerifyCheckoutResult> => {
  const session = await requireSession()
  if (!sessionId) return { success: false, error: "Session invalide" }

  try {
    const stripe = getStripe()
    const checkout = await stripe.checkout.sessions.retrieve(sessionId)
    if (checkout.metadata?.userId !== session.user.id) {
      return { success: false, error: "Session non trouvée ou invalide" }
    }
    return {
      success: true,
      status: checkout.payment_status,
      amountTotal: checkout.amount_total,
      currency: checkout.currency,
      customerEmail: checkout.customer_email,
    }
  } catch (error) {
    // `resource_missing` = session_id d'URL invalide/périmé (contrôlable par
    // l'utilisateur) : flux métier, pas une erreur inattendue.
    if (!isStripeResourceMissing(error)) {
      captureServerError("[verifyStripeCheckout]", error, {
        userId: session.user.id,
      })
    }
    return { success: false, error: "Session non trouvée ou invalide" }
  }
}

export type PortalResult = { portalUrl: string } | { error: string }

/**
 * Ouvre le portail de facturation Stripe de l'utilisateur (gestion factures /
 * moyens de paiement).
 * `returnPath` = chemin interne validé.
 */
export const createCustomerPortal = async (
  returnPath: string,
): Promise<PortalResult> => {
  const session = await requireSession()

  try {
    const stripe = getStripe()
    const customers = await stripe.customers.list({
      email: session.user.email,
      limit: 1,
    })
    if (customers.data.length === 0) {
      return { error: "Aucun historique de paiement Stripe" }
    }
    const portal = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${appBase()}${safePath(returnPath, "/tableau-de-bord/abonnements")}`,
    })
    return { portalUrl: portal.url }
  } catch (error) {
    captureServerError("[createCustomerPortal]", error, {
      userId: session.user.id,
    })
    return {
      error: "Impossible d'ouvrir le portail de facturation. Réessayez.",
    }
  }
}
