import { and, asc, eq } from "drizzle-orm"
import { db } from "@/db"
import { products, transactions, userAccess } from "@/db/schema"
import { createId } from "@/lib/ids"

type ProductRow = typeof products.$inferInsert
type ProductCode = ProductRow["code"]
type AccessType = "exam" | "training"

const ACCESS_TYPE_OF: Record<ProductCode, AccessType> = {
  exam_access: "exam",
  exam_access_promo: "exam",
  training_access: "training",
  training_access_promo: "training",
  premium_access: "exam",
}

/**
 * Produit du catalogue : seuls le code et ce que le test lit sont à préciser,
 * les identifiants Stripe sont dérivés de l'id (aucun n'est unique en base,
 * mais deux produits identiques brouilleraient un test qui les liste).
 */
export const seedProduct = async (
  code: ProductCode,
  over: Partial<ProductRow> = {},
): Promise<string> => {
  const id = over.id ?? createId()
  await db.insert(products).values({
    code,
    name: code,
    description: "desc",
    priceCad: 5000,
    durationDays: 30,
    accessType: ACCESS_TYPE_OF[code],
    isCombo: code === "premium_access",
    stripeProductId: `prod_${id}`,
    stripePriceId: `price_${id}`,
    stripePriceLookupKey: `price_${id}`,
    ...over,
    id,
  })
  return id
}

/**
 * Accès actif ou expiré posé sans passer par `applyGrant` : une transaction
 * manuelle complétée (dont l'accès dépend par clé étrangère) puis la ligne
 * `user_access`. Le produit est celui du type demandé s'il existe déjà, créé
 * sinon. Pour les tests dont l'accès n'est qu'une précondition ; l'octroi se
 * teste par `access-ledger.test.ts`.
 */
export const seedAccess = async (
  userId: string,
  accessType: AccessType,
  expiresAt: Date,
  opts: { productId?: string; completedAt?: Date } = {},
): Promise<{ transactionId: string }> => {
  const productId =
    opts.productId ??
    (await existingProductId(accessType)) ??
    (await seedProduct(
      accessType === "exam" ? "exam_access" : "training_access",
    ))
  const transactionId = createId()
  await db.insert(transactions).values({
    id: transactionId,
    userId,
    productId,
    type: "manual",
    status: "completed",
    amountPaid: 5000,
    currency: "CAD",
    accessType,
    durationDays: 30,
    accessExpiresAt: expiresAt,
    // Comme un octroi manuel réel : complété à l'instant. Un test que la
    // fenêtre d'achat récent gênerait (rappel de panier) passe une date ancienne.
    completedAt: opts.completedAt ?? new Date(),
  })
  await db
    .insert(userAccess)
    .values({ userId, accessType, expiresAt, lastTransactionId: transactionId })
  return { transactionId }
}

const existingProductId = (accessType: AccessType) =>
  db
    .select({ id: products.id })
    .from(products)
    .where(
      and(eq(products.accessType, accessType), eq(products.isCombo, false)),
    )
    .orderBy(asc(products.createdAt))
    .limit(1)
    .then((rows) => rows[0]?.id)
