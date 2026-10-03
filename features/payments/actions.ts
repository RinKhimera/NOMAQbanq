"use server"

import { asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/db"
import { products, transactions } from "@/db/schema"
import { requireRole, requireSession } from "@/lib/auth-guards"
import { getBaseUrl } from "@/lib/base-url"
import { createId } from "@/lib/ids"
import { captureServerError } from "@/lib/observability"
import {
  type StripePrice,
  createCheckoutSession,
  createPortalSession,
  findCustomerByEmail,
  retrieveCheckoutSession,
} from "@/lib/stripe"
import { isStripeConfigurationError } from "@/lib/stripe-errors"
import {
  type AccessType,
  type Tx,
  lockUser,
  rebuildFromTransactions,
} from "./access-ledger"
import { describePriceDrift, resolveStripePrice } from "./catalog"
import {
  type AccessImpact,
  type AdminTransactionsPage,
  type CheckoutPurchase,
  getAllTransactions,
  getCheckoutPurchase,
  getTransactionAccessImpact,
} from "./dal"
import { grantManualAccess } from "./lib"
import { TIMELINE_MORE } from "./page-sizes"
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

// Erreur Stripe liée à la collecte de consentement : l'URL des CGU manque dans
// les informations publiques du compte. Stripe n'a pas été observé sur ce cas
// précis : une erreur de configuration de compte peut arriver avec `param`
// nul, d'où la double reconnaissance par `param` ET par message.
const isStripeConsentConfigError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false
  const { param, message } = error as { param?: unknown; message?: unknown }
  const text = typeof message === "string" ? message.toLowerCase() : ""
  return (
    (typeof param === "string" && param.startsWith("consent_collection")) ||
    text.includes("terms of service") ||
    text.includes("consent_collection")
  )
}

/**
 * [Admin] Transactions plus anciennes de la chronologie d'un client
 * (« Afficher … plus anciennes » du dossier), à partir du curseur keyset.
 */
export const loadClientTimeline = async (
  userId: string,
  cursor: string,
): Promise<AdminTransactionsPage> => {
  await requireRole(["admin"])
  return getAllTransactions({ userId, cursor, limit: TIMELINE_MORE })
}

/**
 * [Admin] Impact d'accès d'une transaction (le modal édition/suppression l'appelle
 * à l'ouverture pour afficher l'avertissement de révocation). `null` si introuvable.
 */
export const loadTransactionAccessImpact = async (
  transactionId: string,
): Promise<AccessImpact[] | null> => {
  await requireRole(["admin"])
  return getTransactionAccessImpact(transactionId)
}

const revalidatePaymentsAdmin = () => {
  revalidatePath("/admin/transactions")
  revalidatePath("/admin/utilisateurs")
}

export type ManualGrant = {
  accessType: AccessType
  /** Epoch ms : expiration écrite par le registre. */
  expiresAt: number
  /** Epoch ms : échéance remplacée, passée comprise ; null = jamais eu. */
  previousExpiresAt: number | null
}

export type ManualPaymentResult = {
  success: boolean
  transactionId?: string
  /** Un élément par accès touché (deux pour le Pack Premium). */
  grants?: ManualGrant[]
  /** Epoch ms : instant de l'octroi, pris sous le verrou. */
  recordedAt?: number
  error?: string
}

/**
 * [Admin] Enregistre un paiement manuel et accorde l'accès correspondant.
 * Tout est atomique (`db.transaction`) avec verrou utilisateur (cf. `applyGrant`).
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
    const { transactionId, granted, recordedAt } = await db.transaction(
      async (tx) => {
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
      },
    )

    revalidatePaymentsAdmin()
    return {
      success: true,
      transactionId,
      recordedAt: recordedAt.getTime(),
      grants: granted.map((g) => ({
        accessType: g.accessType,
        expiresAt: g.expiresAt.getTime(),
        previousExpiresAt: g.previousExpiresAt?.getTime() ?? null,
      })),
    }
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
 * Relit une transaction manuelle sous verrou, en prenant d'abord le verrou
 * `user` : même ordre d'acquisition (user → ligne transaction) qu'`applyGrant`
 * et `rebuildFromTransactions`, sinon deadlock croisé. La relecture sous verrou
 * écarte une ligne supprimée par une action concurrente pendant l'attente.
 */
const lockManualTransaction = async (tx: Tx, transactionId: string) => {
  const [found] = await tx
    .select({ userId: transactions.userId, type: transactions.type })
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1)
  if (!found) throw new Error("TX_NOT_FOUND")
  if (found.type !== "manual") throw new Error("TX_NOT_MANUAL")
  await lockUser(tx, found.userId)

  const [locked] = await tx
    .select({
      id: transactions.id,
      userId: transactions.userId,
      status: transactions.status,
    })
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .for("update")
  if (!locked) throw new Error("TX_NOT_FOUND")
  return locked
}

/**
 * [Admin] Modifie une transaction MANUELLE. Si le statut passe `completed → refunded`,
 * révoque l'accès si cette transaction l'avait accordé en dernier. Atomique.
 */
export const updateManualTransaction = async (
  input: UpdateManualTransactionInput,
): Promise<{ success: boolean; error?: string }> => {
  const session = await requireRole(["admin"])

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
      const transaction = await lockManualTransaction(tx, data.transactionId)

      const statusChange =
        data.status && data.status !== transaction.status ? data.status : null
      // Seul un paiement complété ou remboursé bascule de l'un à l'autre : un
      // paiement en attente ou échoué ne se complète pas par une modification.
      if (
        statusChange &&
        transaction.status !== "completed" &&
        transaction.status !== "refunded"
      )
        throw new Error("TX_STATUS_LOCKED")
      await tx
        .update(transactions)
        .set({
          amountPaid: data.amountPaid,
          currency: data.currency,
          paymentMethod: data.paymentMethod,
          notes: data.notes ?? null,
          ...(statusChange
            ? {
                status: statusChange,
                refundedAt: statusChange === "refunded" ? new Date() : null,
              }
            : {}),
        })
        .where(eq(transactions.id, data.transactionId))

      // Toute transition de statut (completed ↔ refunded) rejoue le calcul
      // d'accès : couvre la révocation ET le re-crédit (bug refunded → completed).
      if (statusChange) {
        await rebuildFromTransactions(tx, { userId: transaction.userId })
      }
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
    if (error instanceof Error && error.message === "TX_STATUS_LOCKED") {
      return {
        success: false,
        error: "Seul un paiement complété ou remboursé change de statut",
      }
    }
    captureServerError("[updateManualTransaction]", error, {
      userId: session.user.id,
    })
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
  const session = await requireRole(["admin"])

  if (!transactionId) {
    return { success: false, error: "Transaction requise" }
  }

  try {
    const accessRevoked = await db.transaction(async (tx) => {
      const transaction = await lockManualTransaction(tx, transactionId)

      // Recompute AVANT le DELETE, en excluant la transaction : re-pointe ou
      // supprime les lignes d'accès qui la référencent (FK restrict), puis la
      // suppression passe.
      const { accessReducedOrRemoved } = await rebuildFromTransactions(tx, {
        userId: transaction.userId,
        excludeTransactionId: transaction.id,
      })
      await tx.delete(transactions).where(eq(transactions.id, transactionId))
      return accessReducedOrRemoved
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
    captureServerError("[deleteManualTransaction]", error, {
      userId: session.user.id,
    })
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
      name: products.name,
      stripePriceId: products.stripePriceId,
      stripePriceLookupKey: products.stripePriceLookupKey,
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

  // Déclaré hors du `try` : le `catch` en a besoin pour nommer le prix réellement
  // envoyé à Stripe, qui peut venir de la résolution comme du repli.
  let resolvedPriceId: string | null = null
  try {
    const base = appBase()

    // Repli de phase 1 (expand/contract). `stripe_price_id` est le pointeur
    // historique, éprouvé en production ; la `lookup_key` ne l'est pas encore.
    // Tant que la colonne existe, la résolution ne doit JAMAIS couper la vente —
    // ni quand la clé ne résout rien, ni quand l'appel LUI-MÊME échoue (droit
    // `prices:read` absent de la clé restreinte, 429, réseau). Sans ce catch,
    // l'exception sauterait par-dessus le repli jusqu'au message générique
    // « Réessayez », qui invite à retenter une panne permanente. Deux messages
    // distincts : les deux causes appellent des remèdes opposés.
    let price: StripePrice | null = null
    try {
      price = await resolveStripePrice(
        product.stripePriceLookupKey,
        (lookupKey, count) =>
          captureServerError(
            "[createStripeCheckout]",
            new Error("plusieurs prix actifs pour une même lookup_key"),
            { userId: session.user.id, detail: `${lookupKey} · ${count} prix` },
          ),
      )
      if (!price) {
        captureServerError(
          "[createStripeCheckout]",
          new Error(
            "aucun prix actif pour cette lookup_key — repli sur stripe_price_id",
          ),
          {
            userId: session.user.id,
            detail: `lookup_key ${product.stripePriceLookupKey} absente du mode de la clé active (produit ${productCode})`,
          },
        )
      }
    } catch (error) {
      // Une clé absente n'est pas une panne de lecture : aucun repli ne
      // vendra, et l'alerte de repli mentirait sur la cause.
      if (isStripeConfigurationError(error)) throw error
      captureServerError("[createStripeCheckout]", error, {
        userId: session.user.id,
        detail: `résolution de la lookup_key ${product.stripePriceLookupKey} impossible — repli sur stripe_price_id (produit ${productCode})`,
      })
    }
    resolvedPriceId = price?.id ?? product.stripePriceId

    // Devise et montant ne se traitent PAS de la même façon. La devise d'un prix
    // Stripe est immuable : elle ne peut pas avoir changé légitimement, donc une
    // devise ≠ cad signifie que la clé pointe sur le mauvais prix → refus. Un
    // montant, lui, diverge normalement le temps qu'un changement de tarif soit
    // répercuté en base → alerte seule. Le client voit de toute façon le montant
    // sur Checkout avant de confirmer.
    const drift = price ? describePriceDrift(product.priceCad, price) : null
    if (drift) {
      captureServerError(
        "[createStripeCheckout]",
        new Error(
          drift.currencyMismatch
            ? "devise du prix Stripe inattendue"
            : "prix affiché divergent du prix Stripe",
        ),
        {
          userId: session.user.id,
          detail: `produit ${productCode} · ${drift.message}`,
        },
      )
      if (drift.currencyMismatch) {
        return { error: "Ce produit est mal configuré. Contactez le support." }
      }
    }

    const checkout = await createCheckoutSession({
      mode: "payment",
      customer_email: session.user.email,
      // Force la création d'un customer Stripe (nécessaire au portail de facturation).
      customer_creation: "always",
      // Reçu Stripe indépendant du toggle Dashboard « Paiements réussis » :
      // un `receipt_email` sur le PaymentIntent déclenche l'envoi en live.
      payment_intent_data: {
        receipt_email: session.user.email,
        description: product.name,
      },
      // Case CGU au checkout : preuve que Stripe recommande dans un dossier
      // de litige. Exige l'URL des CGU dans les informations publiques du
      // compte, sinon Stripe REFUSE la création de session.
      consent_collection: { terms_of_service: "required" },
      // 3DS demandé sur chaque paiement CARTE (préférence frictionless, la
      // banque décide) ; un paiement Link pur n'est pas couvert. Un litige
      // « fraudulent » sur un paiement authentifié retombe sur la banque.
      // Clause de sortie : retirer si la conversion du checkout chute.
      payment_method_options: {
        card: { request_three_d_secure: "any" },
      },
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
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
    // `resource_missing` à la CRÉATION de la session (≠ verifyStripeCheckout, où
    // il vient d'une URL périmée). Le prix étant désormais résolu en amont, ce
    // cas ne peut plus venir d'un identifiant du mauvais mode : il signale un
    // objet Stripe supprimé entre la résolution et la création. Aucune nouvelle
    // tentative n'y changera rien : le message générique enverrait chercher une
    // panne réseau.
    if (isStripeConsentConfigError(error)) {
      captureServerError("[createStripeCheckout]", error, {
        userId: session.user.id,
        detail:
          "URL des CGU absente des informations publiques du compte Stripe : consent_collection refusé, toutes les ventes bloquées",
      })
      return { error: "Ce produit est mal configuré. Contactez le support." }
    }
    if (isStripeResourceMissing(error)) {
      captureServerError("[createStripeCheckout]", error, {
        userId: session.user.id,
        detail: `prix ${resolvedPriceId ?? "non résolu"} (lookup_key ${product.stripePriceLookupKey}) introuvable (produit ${productCode})`,
      })
      return { error: "Ce produit est mal configuré. Contactez le support." }
    }
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
      purchase: CheckoutPurchase | null
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
    // `null` = session_id d'URL invalide/périmé (contrôlable par l'utilisateur) :
    // flux métier, même refus que la session d'un autre (anti-IDOR).
    const checkout = await retrieveCheckoutSession(sessionId)
    if (!checkout || checkout.metadata?.userId !== session.user.id) {
      return { success: false, error: "Session non trouvée ou invalide" }
    }
    return {
      success: true,
      status: checkout.payment_status,
      amountTotal: checkout.amount_total,
      currency: checkout.currency,
      customerEmail: checkout.customer_email,
      purchase: await readCheckoutPurchase(sessionId, session.user.id),
    }
  } catch (error) {
    captureServerError("[verifyStripeCheckout]", error, {
      userId: session.user.id,
    })
    return { success: false, error: "Session non trouvée ou invalide" }
  }
}

// Stripe a déjà confirmé le paiement : une panne de lecture en base (réveil
// Neon) ne doit pas le transformer en erreur. Sans achat, la page relit.
const readCheckoutPurchase = async (
  sessionId: string,
  userId: string,
): Promise<CheckoutPurchase | null> => {
  try {
    return await getCheckoutPurchase(sessionId)
  } catch (error) {
    captureServerError("[verifyStripeCheckout] lecture de l'achat", error, {
      userId,
    })
    return null
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
    const customer = await findCustomerByEmail(session.user.email)
    if (!customer) {
      return { error: "Aucun historique de paiement Stripe" }
    }
    const portal = await createPortalSession({
      customer: customer.id,
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
