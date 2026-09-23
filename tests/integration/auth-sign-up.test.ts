import { eq } from "drizzle-orm"
import { afterAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { account, user } from "@/db/schema"
import { sendVerificationEmail } from "@/email"
import { auth } from "@/lib/auth"

// Seul test qui traverse better-auth jusqu'à la base : les autres insèrent les
// comptes à la main. Il échoue si le schéma Drizzle et les colonnes que
// better-auth écrit divergent — better-auth rejette alors toutes ses requêtes
// au démarrage, ou l'insertion viole une contrainte de la base.
vi.mock("@/email", () => ({
  sendVerificationEmail: vi.fn(),
  sendResetPassword: vi.fn(),
}))
vi.mock("@/features/notifications/welcome", () => ({
  sendWelcomeEmailOnce: vi.fn(),
}))

const email = `signup-${crypto.randomUUID()}@test.invalid`

afterAll(async () => {
  await db.delete(user).where(eq(user.email, email))
})

describe("inscription par courriel via better-auth", () => {
  it("crée l'utilisateur et son compte mot de passe, puis envoie la vérification", async () => {
    await auth.api.signUpEmail({
      body: { name: "Inscription Test", email, password: "motdepasse-solide" },
    })

    const [created] = await db
      .select({ id: user.id, emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.email, email))
    expect(created?.emailVerified).toBe(false)

    const accounts = await db
      .select({ providerId: account.providerId, accountId: account.accountId })
      .from(account)
      .where(eq(account.userId, created!.id))
    expect(accounts).toEqual([
      { providerId: "credential", accountId: created!.id },
    ])
    expect(vi.mocked(sendVerificationEmail)).toHaveBeenCalledOnce()
  })
})
