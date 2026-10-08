import { and, eq, inArray, isNull, ne } from "drizzle-orm"
import { describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { account, session, user } from "@/db/schema"
import {
  deleteMyAccount,
  revokeOtherUserSessions,
  revokeUserSession,
} from "@/features/users/actions"
import {
  type AnonymizeResult,
  anonymizeExpiredDeletedAccounts,
} from "@/features/users/cron"
import { getLoginMethods, getUserSessions } from "@/features/users/dal"
import { DELETION_GRACE_MS } from "@/features/users/lib/account-deletion"
import { requireSession } from "@/lib/auth-guards"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"

// getLoginMethods/getUserSessions passent par getCurrentSession ; les actions par
// requireSession. On stub `@/lib/auth` (jamais appelé ici) pour ne pas charger
// toute la stack Better Auth au moment de l'import de `actions.ts`.
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))
vi.mock("@/lib/auth-guards", () => ({ requireSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ auth: { api: {} } }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/headers", () => ({ headers: vi.fn() }))

/**
 * Compte connecté par mot de passe et Google, avec deux sessions actives dont
 * la courante ; les gardes de session sont branchées dessus.
 */
const seedSignedInAccount = async () => {
  const userId = createId()
  const googleAccountId = createId()
  const currentSessionId = createId()
  const otherSessionId = createId()
  const userEmail = `account-${userId}@test.invalid`

  await db.insert(user).values({
    id: userId,
    name: "Compte Test",
    email: userEmail,
    emailVerified: true,
  })
  await db.insert(account).values([
    {
      id: createId(),
      userId,
      providerId: "credential",
      accountId: userId,
      password: "hash",
    },
    {
      id: googleAccountId,
      userId,
      providerId: "google",
      accountId: `google-sub-${userId}`,
    },
  ])
  await db.insert(session).values([
    {
      id: currentSessionId,
      userId,
      token: `tok-${currentSessionId}`,
      expiresAt: new Date(Date.now() + 86400000),
      ipAddress: "1.2.3.4",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36",
    },
    {
      id: otherSessionId,
      userId,
      token: `tok-${otherSessionId}`,
      expiresAt: new Date(Date.now() + 86400000),
      ipAddress: "5.6.7.8",
      userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Firefox/120.0",
    },
  ])

  const sessionShape = {
    user: { id: userId, email: userEmail, role: "user" },
    session: { id: currentSessionId },
  }
  vi.mocked(getCurrentSession).mockResolvedValue(sessionShape as never)
  vi.mocked(requireSession).mockResolvedValue(sessionShape as never)
  return {
    userId,
    userEmail,
    googleAccountId,
    currentSessionId,
    otherSessionId,
  }
}

describe("getLoginMethods", () => {
  it("indique mot de passe + Google liés et email vérifié, sans secret", async () => {
    const { googleAccountId } = await seedSignedInAccount()
    const methods = await getLoginMethods()
    expect(methods).not.toBeNull()
    expect(methods?.hasPassword).toBe(true)
    // La clé primaire de la ligne, pas l'identifiant Google : c'est ce que
    // `unlinkAccount` attend.
    expect(methods?.google).toEqual({
      linked: true,
      linkedAt: expect.any(Date),
      accountId: googleAccountId,
    })
    expect(methods?.emailVerified).toBe(true)
    expect(JSON.stringify(methods)).not.toContain("hash")
  })
})

describe("account — identité (provider_id, account_id)", () => {
  // Le code d'erreur est vérifié, pas un simple rejet : une insertion peut
  // échouer pour une autre raison (colonne obligatoire oubliée) et faire passer
  // à tort un test de refus.
  it("refuse qu'un second utilisateur lie le même compte Google", async () => {
    const { userId } = await seedSignedInAccount()
    const otherId = createId()
    await db.insert(user).values({
      id: otherId,
      name: "Autre",
      email: `other-${otherId}@test.invalid`,
    })
    await expect(
      db.insert(account).values({
        id: createId(),
        userId: otherId,
        providerId: "google",
        accountId: `google-sub-${userId}`,
      }),
    ).rejects.toMatchObject({ cause: { code: "23505" } })
    const rows = await db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.userId, otherId))
    expect(rows).toHaveLength(0)
  })

  it("accepte le même account_id chez un autre fournisseur", async () => {
    const { userId } = await seedSignedInAccount()
    const otherId = createId()
    await db.insert(user).values({
      id: otherId,
      name: "Autre",
      email: `other-${otherId}@test.invalid`,
    })
    await db.insert(account).values({
      id: createId(),
      userId: otherId,
      providerId: "credential",
      accountId: `google-sub-${userId}`,
    })
    const rows = await db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.userId, otherId))
    expect(rows).toHaveLength(1)
  })
})

describe("getUserSessions", () => {
  it("liste les sessions actives, marque la courante, sans token", async () => {
    const { currentSessionId } = await seedSignedInAccount()
    const sessions = await getUserSessions()
    expect(sessions).toHaveLength(2)
    const current = sessions.find((s) => s.isCurrent)
    expect(current?.id).toBe(currentSessionId)
    expect(current?.deviceLabel).toBe("Chrome · Windows")
    expect(JSON.stringify(sessions)).not.toContain("tok-")
    expect(sessions.every((s) => !("token" in s))).toBe(true)
  })

  it("exclut les sessions expirées", async () => {
    const { userId, currentSessionId, otherSessionId } =
      await seedSignedInAccount()
    const expiredId = createId()
    await db.insert(session).values({
      id: expiredId,
      userId,
      token: `tok-${expiredId}`,
      expiresAt: new Date(Date.now() - 1000),
    })
    const sessions = await getUserSessions()
    expect(sessions.map((s) => s.id).sort()).toEqual(
      [currentSessionId, otherSessionId].sort(),
    )
  })
})

describe("revokeUserSession", () => {
  it("refuse de révoquer la session courante", async () => {
    const { currentSessionId } = await seedSignedInAccount()
    const res = await revokeUserSession(currentSessionId)
    expect(res.success).toBe(false)
    const rows = await db
      .select({ id: session.id })
      .from(session)
      .where(eq(session.id, currentSessionId))
    expect(rows).toHaveLength(1)
  })

  it("révoque une autre session appartenant à l'utilisateur", async () => {
    const { userId, otherSessionId } = await seedSignedInAccount()
    const res = await revokeUserSession(otherSessionId)
    expect(res.success).toBe(true)
    const rows = await db
      .select({ id: session.id })
      .from(session)
      .where(and(eq(session.id, otherSessionId), eq(session.userId, userId)))
    expect(rows).toHaveLength(0)
  })

  it("ne révoque pas la session d'un autre utilisateur (IDOR)", async () => {
    await seedSignedInAccount()
    const strangerId = createId()
    const strangerSession = createId()
    await db.insert(user).values({
      id: strangerId,
      name: "Étranger",
      email: `stranger-${strangerId}@test.invalid`,
    })
    await db.insert(session).values({
      id: strangerSession,
      userId: strangerId,
      token: `tok-${strangerSession}`,
      expiresAt: new Date(Date.now() + 86400000),
    })
    const res = await revokeUserSession(strangerSession)
    expect(res.success).toBe(true) // action « succès » mais aucune ligne touchée
    const rows = await db
      .select({ id: session.id })
      .from(session)
      .where(eq(session.id, strangerSession))
    expect(rows).toHaveLength(1)
  })
})

describe("revokeOtherUserSessions", () => {
  it("supprime toutes les sessions sauf la courante", async () => {
    const { userId, currentSessionId } = await seedSignedInAccount()
    const extraId = createId()
    await db.insert(session).values({
      id: extraId,
      userId,
      token: `tok-${extraId}`,
      expiresAt: new Date(Date.now() + 86400000),
    })
    const res = await revokeOtherUserSessions()
    expect(res.success).toBe(true)
    const rows = await db
      .select({ id: session.id })
      .from(session)
      .where(eq(session.userId, userId))
    expect(rows).toEqual([{ id: currentSessionId }])
  })
})

describe("deleteMyAccount", () => {
  it("refuse si l'email de confirmation ne correspond pas", async () => {
    const { userId } = await seedSignedInAccount()
    const res = await deleteMyAccount({ confirmEmail: "mauvais@test.invalid" })
    expect(res.success).toBe(false)
    const [u] = await db
      .select({ deletedAt: user.deletedAt })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    expect(u?.deletedAt).toBeNull()
  })

  it("pose deletedAt, supprime les sessions, sans anonymiser", async () => {
    const { userId, userEmail } = await seedSignedInAccount()
    const res = await deleteMyAccount({ confirmEmail: userEmail })
    expect(res.success).toBe(true)

    const [u] = await db
      .select({
        deletedAt: user.deletedAt,
        anonymizedAt: user.anonymizedAt,
        email: user.email,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    expect(u?.deletedAt).not.toBeNull()
    expect(u?.anonymizedAt).toBeNull()
    expect(u?.email).toBe(userEmail) // email intact pendant la grâce

    const sess = await db
      .select({ id: session.id })
      .from(session)
      .where(eq(session.userId, userId))
    expect(sess).toHaveLength(0)
  })
})

describe("anonymizeExpiredDeletedAccounts", () => {
  it("anonymise les comptes hors grâce et purge leurs accounts", async () => {
    const oldId = createId()
    await db.insert(user).values({
      id: oldId,
      name: "Vieux Supprimé",
      email: `old-${oldId}@test.invalid`,
      deletedAt: new Date(Date.now() - (DELETION_GRACE_MS + 86400000)),
    })
    await db.insert(account).values({
      id: createId(),
      userId: oldId,
      providerId: "google",
      accountId: `google-sub-${oldId}`,
    })

    const res: AnonymizeResult = await anonymizeExpiredDeletedAccounts()
    expect(res.anonymizedCount).toBe(1)

    const [u] = await db
      .select({
        name: user.name,
        email: user.email,
        anonymizedAt: user.anonymizedAt,
      })
      .from(user)
      .where(eq(user.id, oldId))
      .limit(1)
    expect(u?.name).toBe("Utilisateur supprimé")
    expect(u?.email).toBe(`deleted-${oldId}@deleted.invalid`)
    expect(u?.anonymizedAt).not.toBeNull()

    const accs = await db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.userId, oldId))
    expect(accs).toHaveLength(0)
  })
})

// La garde compte les admins de toute la base : chaque test retire les siens
// dans un `finally`, sans quoi le suivant verrait un « autre admin » (sessions
// et comptes partent en cascade).
describe("deleteMyAccount — garde dernier admin", () => {
  const removeUsers = (...ids: string[]) =>
    db.delete(user).where(inArray(user.id, ids))

  it("autorise la suppression d'un admin s'il en reste un autre", async () => {
    const adminA = createId()
    const adminB = createId()
    const emailA = `admin-a-${adminA}@test.invalid`
    await db.insert(user).values([
      { id: adminA, name: "Admin A", email: emailA, role: "admin" },
      {
        id: adminB,
        name: "Admin B",
        email: `admin-b-${adminB}@test.invalid`,
        role: "admin",
      },
    ])
    try {
      vi.mocked(requireSession).mockResolvedValueOnce({
        user: { id: adminA, email: emailA, role: "admin" },
        session: { id: createId() },
      } as never)

      const res = await deleteMyAccount({ confirmEmail: emailA })
      expect(res.success).toBe(true)
      const [u] = await db
        .select({ deletedAt: user.deletedAt })
        .from(user)
        .where(eq(user.id, adminA))
        .limit(1)
      expect(u?.deletedAt).not.toBeNull()
    } finally {
      await removeUsers(adminA, adminB)
    }
  })

  it("refuse la suppression du seul admin actif", async () => {
    const soloAdmin = createId()
    const emailSolo = `solo-${soloAdmin}@test.invalid`
    await db.insert(user).values({
      id: soloAdmin,
      name: "Solo Admin",
      email: emailSolo,
      role: "admin",
    })
    try {
      // Précondition : un autre admin rendrait la suppression légitime, et le
      // refus ne serait plus testé.
      const activeAdmins = await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.role, "admin"), isNull(user.deletedAt)))
      expect(activeAdmins).toEqual([{ id: soloAdmin }])

      vi.mocked(requireSession).mockResolvedValueOnce({
        user: { id: soloAdmin, email: emailSolo, role: "admin" },
        session: { id: createId() },
      } as never)
      const res = await deleteMyAccount({ confirmEmail: emailSolo })
      expect(res.success).toBe(false)

      const [u] = await db
        .select({ deletedAt: user.deletedAt })
        .from(user)
        .where(eq(user.id, soloAdmin))
        .limit(1)
      expect(u?.deletedAt).toBeNull()
    } finally {
      await removeUsers(soloAdmin)
    }
  })

  it("un admin suspendu ne compte pas comme « autre admin »", async () => {
    const adminA = createId()
    const bannedB = createId()
    const emailA = `admin-a-${adminA}@test.invalid`
    await db.insert(user).values([
      { id: adminA, name: "Admin A", email: emailA, role: "admin" },
      {
        id: bannedB,
        name: "Admin B suspendu",
        email: `admin-b-${bannedB}@test.invalid`,
        role: "admin",
        banned: true,
        banReason: "test",
      },
    ])
    try {
      // Précondition sans le prédicat `banned` de l'implémentation : hors A et
      // B, aucun admin. Un garde manquant compterait alors B et laisserait
      // passer la suppression.
      const otherAdminsIgnoringB = await db
        .select({ id: user.id })
        .from(user)
        .where(
          and(
            eq(user.role, "admin"),
            isNull(user.deletedAt),
            ne(user.id, adminA),
            ne(user.id, bannedB),
          ),
        )
      expect(otherAdminsIgnoringB).toEqual([])

      vi.mocked(requireSession).mockResolvedValueOnce({
        user: { id: adminA, email: emailA, role: "admin" },
        session: { id: createId() },
      } as never)
      const res = await deleteMyAccount({ confirmEmail: emailA })
      // B est admin mais suspendu : il ne sauve pas A.
      expect(res.success).toBe(false)
    } finally {
      await removeUsers(adminA, bannedB)
    }
  })
})
