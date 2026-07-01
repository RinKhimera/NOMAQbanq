import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
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

const userId = createId()
const currentSessionId = createId()
const otherSessionId = createId()
const userEmail = `account-${userId}@test.invalid`

beforeAll(async () => {
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
      id: createId(),
      userId,
      providerId: "google",
      accountId: "google-sub-123",
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
})

afterAll(async () => {
  await db.delete(session).where(eq(session.userId, userId))
  await db.delete(account).where(eq(account.userId, userId))
  await db.delete(user).where(eq(user.id, userId))
})

describe("getLoginMethods", () => {
  it("indique mot de passe + Google liés et email vérifié, sans secret", async () => {
    const methods = await getLoginMethods()
    expect(methods).not.toBeNull()
    expect(methods?.hasPassword).toBe(true)
    expect(methods?.google.linked).toBe(true)
    expect(methods?.emailVerified).toBe(true)
    expect(JSON.stringify(methods)).not.toContain("hash")
  })
})

describe("getUserSessions", () => {
  it("liste les sessions actives, marque la courante, sans token", async () => {
    const sessions = await getUserSessions()
    expect(sessions).toHaveLength(2)
    const current = sessions.find((s) => s.isCurrent)
    expect(current?.id).toBe(currentSessionId)
    expect(current?.deviceLabel).toBe("Chrome · Windows")
    expect(JSON.stringify(sessions)).not.toContain("tok-")
    expect(sessions.every((s) => !("token" in s))).toBe(true)
  })

  it("exclut les sessions expirées", async () => {
    const expiredId = createId()
    await db.insert(session).values({
      id: expiredId,
      userId,
      token: `tok-${expiredId}`,
      expiresAt: new Date(Date.now() - 1000),
    })
    const sessions = await getUserSessions()
    expect(sessions.some((s) => s.id === expiredId)).toBe(false)
    await db.delete(session).where(eq(session.id, expiredId))
  })
})

describe("revokeUserSession", () => {
  it("refuse de révoquer la session courante", async () => {
    const res = await revokeUserSession(currentSessionId)
    expect(res.success).toBe(false)
  })

  it("révoque une autre session appartenant à l'utilisateur", async () => {
    const res = await revokeUserSession(otherSessionId)
    expect(res.success).toBe(true)
    const rows = await db
      .select({ id: session.id })
      .from(session)
      .where(and(eq(session.id, otherSessionId), eq(session.userId, userId)))
    expect(rows).toHaveLength(0)
  })

  it("ne révoque pas la session d'un autre utilisateur (IDOR)", async () => {
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
    await db.delete(session).where(eq(session.userId, strangerId))
    await db.delete(user).where(eq(user.id, strangerId))
  })
})

describe("revokeOtherUserSessions", () => {
  it("supprime toutes les sessions sauf la courante", async () => {
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
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe(currentSessionId)
  })
})

// ⚠️ En dernier parmi les tests utilisant `userId` actif : marque le compte comme
// supprimé et détruit ses sessions.
describe("deleteMyAccount", () => {
  it("refuse si l'email de confirmation ne correspond pas", async () => {
    const res = await deleteMyAccount({ confirmEmail: "mauvais@test.invalid" })
    expect(res.success).toBe(false)
  })

  it("pose deletedAt, supprime les sessions, sans anonymiser", async () => {
    await db
      .insert(session)
      .values({
        id: currentSessionId,
        userId,
        token: `tok-${currentSessionId}`,
        expiresAt: new Date(Date.now() + 86400000),
      })
      .onConflictDoNothing()

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
      accountId: "sub-old",
    })

    const res: AnonymizeResult = await anonymizeExpiredDeletedAccounts()
    expect(res.anonymizedCount).toBeGreaterThanOrEqual(1)

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

    await db.delete(user).where(eq(user.id, oldId))
  })
})
