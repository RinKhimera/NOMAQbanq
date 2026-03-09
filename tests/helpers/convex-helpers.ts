import { convexTest } from "convex-test"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

type TestContext = ReturnType<typeof convexTest>
type AdminContext = Awaited<ReturnType<typeof createAdminUser>>

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

// ===== Training Access (shorthand) =====
export const grantTrainingAccess = async (
  t: TestContext,
  userId: Id<"users">,
) => grantAccess(t, userId, "training")

// ===== Create Questions =====
export const createQuestions = async (
  t: TestContext,
  admin: AdminContext,
  count: number,
  domain: string = "Cardiologie",
) => {
  const ids: Id<"questions">[] = []
  for (let i = 0; i < count; i++) {
    const id = await admin.asAdmin.mutation(api.questions.createQuestion, {
      question: `Question ${i + 1}`,
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
      explanation: `Explication ${i + 1}`,
      objectifCMC: `Objectif ${i + 1}`,
      domain,
    })
    ids.push(id)
  }
  return ids
}

// ===== Create Exam With Pause =====
export const createExamWithPause = async (
  t: TestContext,
  admin: AdminContext,
  questionIds: Id<"questions">[],
  pauseDurationMinutes: number = 15,
) => {
  return await admin.asAdmin.mutation(api.exams.createExam, {
    title: "Examen avec pause",
    startDate: Date.now() - 1000,
    endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
    questionIds,
    enablePause: true,
    pauseDurationMinutes,
  })
}
