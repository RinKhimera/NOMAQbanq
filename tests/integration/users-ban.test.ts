import { and, eq, inArray, isNull } from "drizzle-orm"
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
import {
  products,
  session as sessionTable,
  transactions,
  user,
  userAccess,
  userBans,
} from "@/db/schema"
import { hasAccess } from "@/features/payments/dal"
import { banUser, unbanUser } from "@/features/users/actions"
import { anonymizeExpiredDeletedAccounts } from "@/features/users/cron"
import { getUserBans, getUserForAdmin } from "@/features/users/dal"
import { DELETION_GRACE_MS } from "@/features/users/lib/account-deletion"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"
import { captureServerError } from "@/lib/observability"

// Guards mockés, base réelle : le re-check transactionnel lit la vraie base —
// c'est lui qu'on teste. Le stub de @/lib/auth évite de charger Better Auth.
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))
vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(),
  requireRole: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({ auth: { api: {} } }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/headers", () => ({ headers: vi.fn() }))
vi.mock("@/lib/observability", () => ({ captureServerError: vi.fn() }))
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})

const DAY = 24 * 60 * 60 * 1000
const suffix = createId().slice(0, 8)
const adminId = createId()
const otherAdminId = createId()
const ghostAdminId = createId() // sera anonymisé par le cron dans un test
const targetId = createId()
const bystanderId = createId()
const productId = createId()
const txId = createId()
const FIXTURE_IDS = [adminId, otherAdminId, ghostAdminId, targetId, bystanderId]

const mockCaller = (id = adminId) =>
  vi.mocked(requireRole).mockResolvedValue({
    user: { id, email: `x-${id}@test.invalid`, role: "admin" },
    session: { id: createId() },
  } as never)

const readUser = async (id: string) => {
  const [row] = await db
    .select({ banned: user.banned, banReason: user.banReason })
    .from(user)
    .where(eq(user.id, id))
    .limit(1)
  return row
}

const sessionsOf = (userId: string) =>
  db
    .select({ id: sessionTable.id })
    .from(sessionTable)
    .where(eq(sessionTable.userId, userId))

const bansOf = (userId: string) =>
  db.select().from(userBans).where(eq(userBans.userId, userId))

const seedSession = (userId: string) =>
  db.insert(sessionTable).values({
    id: createId(),
    token: createId(),
    userId,
    expiresAt: new Date(Date.now() + DAY),
    updatedAt: new Date(),
  })

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: adminId,
      name: "Admin Ban",
      email: `ban-admin-${suffix}@test.invalid`,
      role: "admin",
    },
    {
      id: otherAdminId,
      name: "Autre Admin",
      email: `ban-admin2-${suffix}@test.invalid`,
      role: "admin",
    },
    {
      id: ghostAdminId,
      name: "Admin Fantôme",
      email: `ban-ghost-${suffix}@test.invalid`,
      role: "admin",
    },
    {
      id: targetId,
      name: "Cible Ban",
      email: `ban-target-${suffix}@test.invalid`,
    },
    {
      id: bystanderId,
      name: "Témoin",
      email: `ban-bystander-${suffix}@test.invalid`,
    },
  ])
  await db.insert(products).values({
    id: productId,
    code: "exam_access",
    name: "Exam",
    description: "d",
    priceCad: 5000,
    durationDays: 30,
    accessType: "exam",
    stripeProductId: `prod_ban_${suffix}`,
    stripePriceId: `price_ban_${suffix}`,
    stripePriceLookupKey: `price_ban_${suffix}`,
  })
  await db.insert(transactions).values({
    id: txId,
    userId: targetId,
    productId,
    type: "manual",
    status: "completed",
    amountPaid: 5000,
    currency: "CAD",
    accessType: "exam",
    durationDays: 30,
    accessExpiresAt: new Date(Date.now() + 30 * DAY),
    completedAt: new Date(),
  })
  await db.insert(userAccess).values({
    userId: targetId,
    accessType: "exam",
    expiresAt: new Date(Date.now() + 30 * DAY),
    lastTransactionId: txId,
  })
})

afterAll(async () => {
  await db.delete(userAccess).where(eq(userAccess.userId, targetId))
  await db.delete(transactions).where(eq(transactions.id, txId))
  await db.delete(products).where(eq(products.id, productId))
  for (const id of FIXTURE_IDS) {
    await db.delete(user).where(eq(user.id, id))
  }
})

beforeEach(async () => {
  vi.mocked(captureServerError).mockClear()
  // Nettoyage borné aux fixtures (jamais de DELETE de table entière, même sur
  // une branche jetable : le fichier doit rester sûr en `test:integration:keep`).
  await db.delete(userBans).where(inArray(userBans.userId, FIXTURE_IDS))
  await db.delete(sessionTable).where(eq(sessionTable.userId, targetId))
  await db.delete(sessionTable).where(eq(sessionTable.userId, bystanderId))
  await db
    .update(user)
    .set({ role: "admin", deletedAt: null, banned: false, banReason: null })
    .where(eq(user.id, adminId))
  await db
    .update(user)
    .set({ role: "user", deletedAt: null, banned: false, banReason: null })
    .where(eq(user.id, targetId))
  mockCaller()
})

describe("banUser", () => {
  it("pose le drapeau, journalise, supprime les sessions de la cible seulement, garde l'accès", async () => {
    await seedSession(targetId)
    await seedSession(targetId)
    await seedSession(bystanderId)

    const result = await banUser({
      userId: targetId,
      reason: "Litige perdu, fraude",
    })
    expect(result).toEqual({ success: true })

    expect(await readUser(targetId)).toEqual({
      banned: true,
      banReason: "Litige perdu, fraude",
    })
    const bans = await bansOf(targetId)
    expect(bans).toHaveLength(1)
    expect(bans[0]).toMatchObject({
      reason: "Litige perdu, fraude",
      bannedBy: adminId,
      liftedAt: null,
      liftedBy: null,
    })
    expect(await sessionsOf(targetId)).toHaveLength(0)
    expect(await sessionsOf(bystanderId)).toHaveLength(1)
    expect(await hasAccess("exam", targetId)).toBe(true)
  })

  it("refuse l'auto-suspension", async () => {
    const result = await banUser({ userId: adminId, reason: "Motif suffisant" })
    expect(result).toEqual({
      success: false,
      error: "Vous ne pouvez pas suspendre votre propre compte.",
    })
    expect((await readUser(adminId))?.banned).toBe(false)
  })

  it("refuse de suspendre un admin", async () => {
    await db.update(user).set({ role: "admin" }).where(eq(user.id, targetId))
    const result = await banUser({
      userId: targetId,
      reason: "Motif suffisant",
    })
    expect(result).toEqual({
      success: false,
      error: "Retirez d'abord le rôle administrateur de ce compte.",
    })
    expect(await bansOf(targetId)).toHaveLength(0)
  })

  it("refuse une cible supprimée ou inconnue", async () => {
    await db
      .update(user)
      .set({ deletedAt: new Date() })
      .where(eq(user.id, targetId))
    expect(
      await banUser({ userId: targetId, reason: "Motif suffisant" }),
    ).toEqual({
      success: false,
      error: "Utilisateur introuvable.",
    })
    expect(
      await banUser({ userId: createId(), reason: "Motif suffisant" }),
    ).toEqual({
      success: false,
      error: "Utilisateur introuvable.",
    })
  })

  it("refuse un compte déjà suspendu", async () => {
    await banUser({ userId: targetId, reason: "Premier motif" })
    const result = await banUser({ userId: targetId, reason: "Second motif" })
    expect(result).toEqual({
      success: false,
      error: "Ce compte est déjà suspendu.",
    })
    expect(await bansOf(targetId)).toHaveLength(1)
  })

  it("refuse si l'appelant n'est plus admin en base (re-check transactionnel)", async () => {
    await db.update(user).set({ role: "user" }).where(eq(user.id, adminId))
    const result = await banUser({
      userId: targetId,
      reason: "Motif suffisant",
    })
    expect(result).toEqual({
      success: false,
      error: "Votre compte n'a plus les droits administrateur.",
    })
    expect((await readUser(targetId))?.banned).toBe(false)
  })

  it("refuse un motif trop court (zod)", async () => {
    const result = await banUser({ userId: targetId, reason: "abc" })
    expect(result.success).toBe(false)
    expect(result.error).toBe("Le motif doit contenir au moins 5 caractères")
  })

  it("drapeau retombé avec épisode ouvert : la suspension passe, l'orphelin est clos et signalé", async () => {
    await banUser({ userId: targetId, reason: "Épisode devenu orphelin" })
    // Le plugin admin remet `banned=false` tout seul quand `ban_expires` est
    // passé ; on simule cet état sans passer par unbanUser.
    await db
      .update(user)
      .set({ banned: false, banReason: null })
      .where(eq(user.id, targetId))

    const result = await banUser({ userId: targetId, reason: "Nouvel épisode" })
    expect(result).toEqual({ success: true })

    const bans = await bansOf(targetId)
    expect(bans).toHaveLength(2)
    const orphan = bans.find((b) => b.reason === "Épisode devenu orphelin")
    expect(orphan?.liftedAt).toBeInstanceOf(Date)
    expect(orphan?.liftReason).toContain("clos automatiquement")
    expect(bans.find((b) => b.reason === "Nouvel épisode")?.liftedAt).toBeNull()
    expect((await readUser(targetId))?.banned).toBe(true)
    expect(captureServerError).toHaveBeenCalledWith(
      "[banUser]",
      expect.any(Error),
      { userId: targetId },
    )
  })

  it("sérialise deux suspensions concurrentes : un seul épisode", async () => {
    const [a, b] = await Promise.all([
      banUser({ userId: targetId, reason: "Motif A concurrent" }),
      banUser({ userId: targetId, reason: "Motif B concurrent" }),
    ])
    const results = [a, b]
    expect(results.filter((r) => r.success)).toHaveLength(1)
    expect(results.find((r) => !r.success)?.error).toBe(
      "Ce compte est déjà suspendu.",
    )
    expect(await bansOf(targetId)).toHaveLength(1)
  })
})

describe("unbanUser", () => {
  it("clôt l'épisode, efface le drapeau, l'accès est identique", async () => {
    await banUser({ userId: targetId, reason: "Litige perdu, fraude" })
    mockCaller(otherAdminId)

    const result = await unbanUser({
      userId: targetId,
      reason: "Erreur de manipulation",
    })
    expect(result).toEqual({ success: true })

    expect(await readUser(targetId)).toEqual({ banned: false, banReason: null })
    const [ban] = await bansOf(targetId)
    expect(ban).toMatchObject({
      bannedBy: adminId,
      liftedBy: otherAdminId,
      liftReason: "Erreur de manipulation",
    })
    expect(ban?.liftedAt).toBeInstanceOf(Date)
    expect(await hasAccess("exam", targetId)).toBe(true)
  })

  it("refuse un compte non suspendu", async () => {
    const result = await unbanUser({ userId: targetId })
    expect(result).toEqual({
      success: false,
      error: "Ce compte n'est pas suspendu.",
    })
  })

  it("refuse l'auto-levée", async () => {
    const result = await unbanUser({ userId: adminId })
    expect(result).toEqual({
      success: false,
      error: "Vous ne pouvez pas lever votre propre suspension.",
    })
  })

  it("lève un drapeau sans journal et capture l'incohérence", async () => {
    await db
      .update(user)
      .set({ banned: true, banReason: "posé à la main" })
      .where(eq(user.id, targetId))

    const result = await unbanUser({ userId: targetId })
    expect(result).toEqual({ success: true })
    expect(await readUser(targetId)).toEqual({ banned: false, banReason: null })
    expect(captureServerError).toHaveBeenCalledWith(
      "[unbanUser]",
      expect.any(Error),
      { userId: targetId },
    )
  })

  it("après levée, une nouvelle suspension ouvre un second épisode", async () => {
    await banUser({ userId: targetId, reason: "Premier épisode" })
    await unbanUser({ userId: targetId })
    const result = await banUser({ userId: targetId, reason: "Second épisode" })
    expect(result).toEqual({ success: true })
    const open = await db
      .select()
      .from(userBans)
      .where(and(eq(userBans.userId, targetId), isNull(userBans.liftedAt)))
    expect(open).toHaveLength(1)
    expect(open[0]?.reason).toBe("Second épisode")
    expect(await bansOf(targetId)).toHaveLength(2)
  })
})

describe("DAL admin", () => {
  it("getUserForAdmin expose `banned`", async () => {
    expect((await getUserForAdmin(targetId))?.banned).toBe(false)
    await banUser({ userId: targetId, reason: "Motif suffisant" })
    expect((await getUserForAdmin(targetId))?.banned).toBe(true)
  })

  it("getUserBans : ordre décroissant, noms des admins", async () => {
    await banUser({ userId: targetId, reason: "Premier épisode" })
    mockCaller(otherAdminId)
    await unbanUser({ userId: targetId, reason: "Levée" })
    mockCaller(adminId)
    await banUser({ userId: targetId, reason: "Second épisode" })

    const bans = await getUserBans(targetId)
    expect(bans.map((b) => b.reason)).toEqual([
      "Second épisode",
      "Premier épisode",
    ])
    expect(bans[0]).toMatchObject({
      bannedByName: "Admin Ban",
      liftedAt: null,
      liftedByName: null,
      liftReason: null,
    })
    expect(bans[1]).toMatchObject({
      bannedByName: "Admin Ban",
      liftedByName: "Autre Admin",
      liftReason: "Levée",
    })
    expect(typeof bans[0]?.bannedAt).toBe("number")
    expect(typeof bans[1]?.liftedAt).toBe("number")
  })

  it("getUserBans : borné à 20 épisodes, les plus récents", async () => {
    const base = Date.now() - 100 * DAY
    await db.insert(userBans).values(
      Array.from({ length: 25 }, (_, i) => ({
        userId: targetId,
        reason: `Épisode ${i}`,
        bannedBy: adminId,
        bannedAt: new Date(base + i * 60_000),
        liftedBy: adminId,
        liftedAt: new Date(base + i * 60_000 + 30_000),
      })),
    )
    const bans = await getUserBans(targetId)
    expect(bans).toHaveLength(20)
    expect(bans[0]?.reason).toBe("Épisode 24")
    expect(bans[19]?.reason).toBe("Épisode 5")
  })

  it("auteur anonymisé par le cron : le nom joint devient « Utilisateur supprimé »", async () => {
    // Aucun chemin produit ne supprime une ligne `user` (anonymisation par
    // UPDATE) : c'est le seul scénario « auteur disparu » atteignable.
    mockCaller(ghostAdminId)
    await banUser({ userId: targetId, reason: "Motif du fantôme" })
    await db
      .update(user)
      .set({ deletedAt: new Date(Date.now() - DELETION_GRACE_MS - 60_000) })
      .where(eq(user.id, ghostAdminId))
    await anonymizeExpiredDeletedAccounts()

    const [ban] = await getUserBans(targetId)
    expect(ban?.bannedByName).toBe("Utilisateur supprimé")
  })
})
