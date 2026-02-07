import { convexTest } from "convex-test"
import type { Id } from "../../convex/_generated/dataModel"

type TestContext = ReturnType<typeof convexTest>

// ===== Admin User =====
export const createAdminUser = async (t: TestContext) => {
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

// ===== Regular User =====
export const createRegularUser = async (
  t: TestContext,
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

// ===== Product Cache =====
const productCache = new Map<string, Id<"products">>()

export const clearProductCache = () => productCache.clear()

export const getOrCreateProduct = async (
  t: TestContext,
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

// ===== Grant Access =====
export const grantAccess = async (
  t: TestContext,
  userId: Id<"users">,
  accessType: "exam" | "training",
) => {
  const productId = await getOrCreateProduct(t, accessType)

  await t.run(async (ctx) => {
    const transactionId = await ctx.db.insert("transactions", {
      userId,
      productId,
      type: "manual",
      status: "completed",
      amountPaid: 0,
      currency: "CAD",
      accessType,
      durationDays: 30,
      accessExpiresAt: Date.now() + 86400000,
      createdAt: Date.now(),
    })

    await ctx.db.insert("userAccess", {
      userId,
      accessType,
      expiresAt: Date.now() + 86400000,
      lastTransactionId: transactionId,
    })
  })
}
