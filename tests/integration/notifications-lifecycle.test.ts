import { eq } from "drizzle-orm"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
import { sendAbandonedCartReminder } from "@/features/notifications/abandoned-cart"
import { sendWelcomeEmailOnce } from "@/features/notifications/welcome"
import { DELETION_GRACE_MS } from "@/features/users/lib/account-deletion"
import { auth } from "@/lib/auth"
import { createId } from "@/lib/ids"

const welcome = vi.fn().mockResolvedValue("id")
const cart = vi.fn().mockResolvedValue("id")
const reset = vi.fn().mockResolvedValue("id")
const verify = vi.fn().mockResolvedValue("id")
vi.mock("@/email", () => ({
  sendWelcomeEmail: (...a: unknown[]) => welcome(...a),
  sendAbandonedCartEmail: (...a: unknown[]) => cart(...a),
  sendResetPassword: (...a: unknown[]) => reset(...a),
  sendVerificationEmail: (...a: unknown[]) => verify(...a),
}))

const uid = createId()
const googleUid = createId()
const emailUid = createId()
const loginUid = createId()

beforeAll(async () => {
  await db.insert(user).values([
    { id: uid, name: "Bienvenue Test", email: `w-${uid}@test.invalid` },
    {
      id: googleUid,
      name: "Google",
      email: `g-${googleUid}@test.invalid`,
      emailVerified: true,
    },
    { id: emailUid, name: "Courriel", email: `e-${emailUid}@test.invalid` },
    { id: loginUid, name: "Connexion", email: `l-${loginUid}@test.invalid` },
  ])
})

afterAll(async () => {
  for (const id of [uid, googleUid, emailUid, loginUid]) {
    await db.delete(user).where(eq(user.id, id))
  }
})

beforeEach(() => {
  welcome.mockClear()
  cart.mockClear()
})

const column = async <
  K extends "welcomeEmailSentAt" | "lastLoginAt" | "deletedAt",
>(
  id: string,
  key: K,
) =>
  (
    await db.select({ v: user[key] }).from(user).where(eq(user.id, id)).limit(1)
  )[0]?.v

describe("sendWelcomeEmailOnce", () => {
  it("envoie une fois, marque, puis refuse", async () => {
    expect(await sendWelcomeEmailOnce(uid)).toBe(true)
    expect(welcome).toHaveBeenCalledWith({
      to: `w-${uid}@test.invalid`,
      name: "Bienvenue Test",
    })
    expect(await column(uid, "welcomeEmailSentAt")).toBeInstanceOf(Date)
    expect(await sendWelcomeEmailOnce(uid)).toBe(false)
    expect(welcome).toHaveBeenCalledTimes(1)
  })

  it("échec SES : marqueur posé, pas d'exception", async () => {
    const id = createId()
    await db
      .insert(user)
      .values({ id, name: "Panne", email: `p-${id}@test.invalid` })
    welcome.mockRejectedValueOnce(new Error("SES down"))
    await expect(sendWelcomeEmailOnce(id)).resolves.toBe(false)
    expect(await column(id, "welcomeEmailSentAt")).toBeInstanceOf(Date)
    await db.delete(user).where(eq(user.id, id))
  })

  it("utilisateur inconnu : false sans exception", async () => {
    await expect(sendWelcomeEmailOnce("inconnu")).resolves.toBe(false)
  })
})

describe("hooks Better Auth", () => {
  const hooks = auth.options.databaseHooks
  const emailVerification = auth.options.emailVerification

  it("création d'un compte déjà vérifié (Google) → bienvenue", async () => {
    await hooks.user.create.after({
      id: googleUid,
      emailVerified: true,
    } as never)
    expect(welcome).toHaveBeenCalledTimes(1)
  })

  it("création d'un compte courriel non vérifié → rien", async () => {
    await hooks.user.create.after({
      id: emailUid,
      emailVerified: false,
    } as never)
    expect(welcome).not.toHaveBeenCalled()
  })

  it("vérification de l'adresse → bienvenue, une seule fois", async () => {
    await emailVerification.afterEmailVerification({ id: emailUid } as never)
    await emailVerification.afterEmailVerification({ id: emailUid } as never)
    expect(welcome).toHaveBeenCalledTimes(1)
  })

  it("création de session → lastLoginAt posé, compte en grâce réactivé", async () => {
    await db
      .update(user)
      .set({ deletedAt: new Date() })
      .where(eq(user.id, loginUid))
    await hooks.session.create.after({ userId: loginUid } as never)
    expect(await column(loginUid, "lastLoginAt")).toBeInstanceOf(Date)
    expect(await column(loginUid, "deletedAt")).toBeNull()
  })

  it("création de session refusée quand la grâce de suppression est expirée", async () => {
    const expiredUid = createId()
    await db.insert(user).values({
      id: expiredUid,
      name: "Expiré",
      email: `x-${expiredUid}@test.invalid`,
      deletedAt: new Date(Date.now() - DELETION_GRACE_MS - 86400000),
    })
    const before = await hooks.session.create.before({
      userId: expiredUid,
    } as never)
    expect(before).toBe(false)
    expect(await column(expiredUid, "deletedAt")).not.toBeNull()
    await db.delete(user).where(eq(user.id, expiredUid))
  })

  it("réinitialisation et vérification transmettent le nom au courriel", async () => {
    const authUser = {
      id: loginUid,
      email: `l-${loginUid}@test.invalid`,
      name: "Connexion Test",
    } as never
    await auth.options.emailAndPassword.sendResetPassword({
      user: authUser,
      url: "https://x/r",
      token: "t",
    } as never)
    expect(reset).toHaveBeenCalledWith({
      to: `l-${loginUid}@test.invalid`,
      name: "Connexion Test",
      url: "https://x/r",
    })
    await auth.options.emailVerification.sendVerificationEmail({
      user: authUser,
      url: "https://x/v",
      token: "t",
    } as never)
    expect(verify).toHaveBeenCalledWith({
      to: `l-${loginUid}@test.invalid`,
      name: "Connexion Test",
      url: "https://x/v",
    })
  })
})

describe("sendAbandonedCartReminder", () => {
  const DAY = 86400000
  const exam = createId()
  const combo = createId()
  const buyer = createId()
  const optOut = createId()
  const banned = createId()
  const owner = createId()
  const halfOwner = createId()
  const recentBuyer = createId()
  const all = [buyer, optOut, banned, owner, halfOwner, recentBuyer]

  const seedTx = async (
    userId: string,
    productId: string,
    extra: Partial<typeof transactions.$inferInsert> = {},
  ) => {
    const id = createId()
    await db.insert(transactions).values({
      id,
      userId,
      productId,
      type: "stripe",
      status: "failed",
      amountPaid: 20000,
      currency: "CAD",
      accessType: "exam",
      durationDays: 90,
      accessExpiresAt: new Date(Date.now() + 90 * DAY),
      stripeSessionId: `cs_${id}`,
      ...extra,
    })
    return id
  }

  beforeAll(async () => {
    await db.insert(products).values([
      {
        id: exam,
        code: "exam_access",
        name: "Accès examens",
        description: "Accès examens",
        priceCad: 20000,
        durationDays: 90,
        accessType: "exam",
        stripeProductId: `prod_${exam}`,
        stripePriceId: `price_${exam}`,
        stripePriceLookupKey: `price_${exam}`,
      },
      {
        id: combo,
        code: "premium_access",
        name: "Accès premium",
        description: "Examens + entraînement",
        priceCad: 35000,
        durationDays: 180,
        accessType: "exam",
        isCombo: true,
        stripeProductId: `prod_${combo}`,
        stripePriceId: `price_${combo}`,
        stripePriceLookupKey: `price_${combo}`,
      },
    ])
    await db.insert(user).values([
      { id: buyer, name: "Panier", email: `cart-${buyer}@test.invalid` },
      {
        id: optOut,
        name: "Refus",
        email: `cart-${optOut}@test.invalid`,
        notifyMarketing: false,
      },
      {
        id: banned,
        name: "Banni",
        email: `cart-${banned}@test.invalid`,
        banned: true,
      },
      { id: owner, name: "Déjà", email: `cart-${owner}@test.invalid` },
      {
        id: halfOwner,
        name: "Moitié",
        email: `cart-${halfOwner}@test.invalid`,
      },
      {
        id: recentBuyer,
        name: "Récent",
        email: `cart-${recentBuyer}@test.invalid`,
      },
    ])
    // `user_access.last_transaction_id` est NOT NULL : un achat complété ancien
    // sert d'ancre, hors de la fenêtre de 7 jours.
    const ownerTx = await seedTx(owner, exam, {
      status: "completed",
      completedAt: new Date(Date.now() - 30 * DAY),
    })
    await db.insert(userAccess).values({
      userId: owner,
      accessType: "exam",
      expiresAt: new Date(Date.now() + 30 * DAY),
      lastTransactionId: ownerTx,
    })
    const halfTx = await seedTx(halfOwner, exam, {
      status: "completed",
      accessType: "training",
      completedAt: new Date(Date.now() - 30 * DAY),
    })
    await db.insert(userAccess).values({
      userId: halfOwner,
      accessType: "training",
      expiresAt: new Date(Date.now() + 30 * DAY),
      lastTransactionId: halfTx,
    })
  })

  afterAll(async () => {
    for (const id of all) {
      await db.delete(userAccess).where(eq(userAccess.userId, id))
      await db.delete(transactions).where(eq(transactions.userId, id))
      await db.delete(user).where(eq(user.id, id))
    }
    await db.delete(products).where(eq(products.id, exam))
    await db.delete(products).where(eq(products.id, combo))
  })

  const cartSentAt = async (id: string) =>
    (
      await db
        .select({ v: user.cartReminderSentAt })
        .from(user)
        .where(eq(user.id, id))
        .limit(1)
    )[0]?.v

  it("envoie une fois, marque l'utilisateur, puis refuse (rejeu et second panier)", async () => {
    const tx = await seedTx(buyer, exam)
    expect(await sendAbandonedCartReminder(tx)).toBe(true)
    expect(cart).toHaveBeenCalledWith({
      to: `cart-${buyer}@test.invalid`,
      name: "Panier",
      userId: buyer,
      productName: "Accès examens",
      priceCad: 20000,
    })
    expect(await cartSentAt(buyer)).toBeInstanceOf(Date)
    expect(await sendAbandonedCartReminder(tx)).toBe(false)
    expect(await sendAbandonedCartReminder(await seedTx(buyer, exam))).toBe(
      false,
    )
    expect(cart).toHaveBeenCalledTimes(1)
  })

  it("préférence désactivée ou compte banni → rien", async () => {
    expect(await sendAbandonedCartReminder(await seedTx(optOut, exam))).toBe(
      false,
    )
    expect(await sendAbandonedCartReminder(await seedTx(banned, exam))).toBe(
      false,
    )
    expect(cart).not.toHaveBeenCalled()
  })

  it("accès visé déjà actif → rien ; combo avec un seul accès → envoi", async () => {
    expect(await sendAbandonedCartReminder(await seedTx(owner, exam))).toBe(
      false,
    )
    expect(cart).not.toHaveBeenCalled()
    expect(
      await sendAbandonedCartReminder(await seedTx(halfOwner, combo)),
    ).toBe(true)
    expect(cart).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: halfOwner,
        productName: "Accès premium",
      }),
    )
  })

  it("achat complété la veille → rien", async () => {
    await seedTx(recentBuyer, exam, {
      status: "completed",
      completedAt: new Date(Date.now() - DAY),
    })
    expect(
      await sendAbandonedCartReminder(await seedTx(recentBuyer, exam)),
    ).toBe(false)
    expect(cart).not.toHaveBeenCalled()
  })

  it("transaction inconnue → false sans exception", async () => {
    expect(await sendAbandonedCartReminder("tx_inconnue")).toBe(false)
  })
})
