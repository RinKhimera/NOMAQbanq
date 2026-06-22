"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import { products, transactions } from "@/db/schema"
import { requireRole, requireSession } from "@/lib/auth-guards"

import {
  getAccessStatus,
  getAllTransactions,
  getMyTransactions,
  getTransactionAccessImpact,
  getTransactionStats,
  type AccessImpact,
  type AccessStatus,
  type AdminTransactionsPage,
  type MyTransactionsPage,
  type TransactionStatsView,
} from "./dal"
import { grantManualAccess, revokeAccessIfLast } from "./lib"
import {
  recordManualPaymentSchema,
  updateManualTransactionSchema,
  type RecordManualPaymentInput,
  type UpdateManualTransactionInput,
} from "./schemas"

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
export const loadTransactionStats =
  async (): Promise<TransactionStatsView> => {
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
  revalidatePath("/admin/users")
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
      const [product] = await tx
        .select({
          id: products.id,
          accessType: products.accessType,
          durationDays: products.durationDays,
          isCombo: products.isCombo,
        })
        .from(products)
        .where(eq(products.code, data.productCode))
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
    if (process.env.NODE_ENV !== "production") {
      console.error("[recordManualPayment]", error)
    }
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
          accessType: transactions.accessType,
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
          accessType: transaction.accessType,
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
    if (process.env.NODE_ENV !== "production") {
      console.error("[updateManualTransaction]", error)
    }
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
          accessType: transactions.accessType,
        })
        .from(transactions)
        .where(eq(transactions.id, transactionId))
        .limit(1)
      if (!transaction) throw new Error("TX_NOT_FOUND")
      if (transaction.type !== "manual") throw new Error("TX_NOT_MANUAL")

      const revoked = await revokeAccessIfLast(tx, {
        id: transaction.id,
        userId: transaction.userId,
        accessType: transaction.accessType,
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
    if (process.env.NODE_ENV !== "production") {
      console.error("[deleteManualTransaction]", error)
    }
    return { success: false, error: "Erreur serveur. Réessayez." }
  }
}
