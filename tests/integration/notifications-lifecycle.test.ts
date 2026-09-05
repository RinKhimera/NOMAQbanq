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
import { user } from "@/db/schema"
import { sendWelcomeEmailOnce } from "@/features/notifications/welcome"
import { auth } from "@/lib/auth"
import { createId } from "@/lib/ids"

const welcome = vi.fn().mockResolvedValue("id")
const cart = vi.fn().mockResolvedValue("id")
vi.mock("@/email", () => ({
  sendWelcomeEmail: (...a: unknown[]) => welcome(...a),
  sendAbandonedCartEmail: (...a: unknown[]) => cart(...a),
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
})
