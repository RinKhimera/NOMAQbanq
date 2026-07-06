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
import { updateUserRole } from "@/features/users/actions"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"

// Mêmes stubs que users-account.test.ts : on ne charge pas la stack Better Auth,
// et les guards sont pilotés par le test (le re-check transactionnel, lui, lit la
// vraie base — c'est précisément ce qu'on teste).
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))
vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(),
  requireRole: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({ auth: { api: {} } }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/headers", () => ({ headers: vi.fn() }))

const adminId = createId()
const targetId = createId()
const adminEmail = `role-admin-${adminId}@test.invalid`
const targetEmail = `role-target-${targetId}@test.invalid`

const mockCallerSession = () =>
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: adminId, email: adminEmail, role: "admin" },
    session: { id: createId() },
  } as never)

const getUserRow = async (id: string) => {
  const [row] = await db
    .select({ role: user.role, updatedAt: user.updatedAt })
    .from(user)
    .where(eq(user.id, id))
    .limit(1)
  return row
}

const getRole = async (id: string) => (await getUserRow(id))?.role

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: adminId,
      name: "Admin Test",
      email: adminEmail,
      emailVerified: true,
      role: "admin",
    },
    {
      id: targetId,
      name: "Cible Test",
      email: targetEmail,
      emailVerified: true,
    },
  ])
})

afterAll(async () => {
  await db.delete(user).where(eq(user.id, adminId))
  await db.delete(user).where(eq(user.id, targetId))
})

beforeEach(async () => {
  // Remet l'état de référence : appelant admin actif, cible user active.
  await db
    .update(user)
    .set({ role: "admin", deletedAt: null })
    .where(eq(user.id, adminId))
  await db
    .update(user)
    .set({ role: "user", deletedAt: null })
    .where(eq(user.id, targetId))
  mockCallerSession()
})

describe("updateUserRole", () => {
  it("promeut un utilisateur en admin", async () => {
    const result = await updateUserRole({ userId: targetId, role: "admin" })
    expect(result).toEqual({ success: true })
    expect(await getRole(targetId)).toBe("admin")
  })

  it("rétrograde un admin en utilisateur", async () => {
    await db.update(user).set({ role: "admin" }).where(eq(user.id, targetId))
    const result = await updateUserRole({ userId: targetId, role: "user" })
    expect(result).toEqual({ success: true })
    expect(await getRole(targetId)).toBe("user")
  })

  it("est idempotent si le rôle est déjà celui demandé (aucune écriture)", async () => {
    const before = await getUserRow(targetId)
    const result = await updateUserRole({ userId: targetId, role: "user" })
    expect(result).toEqual({ success: true })
    const after = await getUserRow(targetId)
    expect(after?.role).toBe("user")
    // `updatedAt` a $onUpdate (db/schema/auth.ts) : tout UPDATE le bump —
    // l'égalité prouve qu'aucune écriture n'a eu lieu.
    expect(after?.updatedAt?.getTime()).toBe(before?.updatedAt?.getTime())
  })

  it("refuse l'auto-modification", async () => {
    const result = await updateUserRole({ userId: adminId, role: "user" })
    expect(result.success).toBe(false)
    expect(result.error).toBe("Vous ne pouvez pas modifier votre propre rôle.")
    expect(await getRole(adminId)).toBe("admin")
  })

  it("refuse si l'appelant n'est plus admin actif en base (re-check transactionnel)", async () => {
    // La session mockée dit encore « admin », mais la base a changé entre-temps.
    await db.update(user).set({ role: "user" }).where(eq(user.id, adminId))
    const result = await updateUserRole({ userId: targetId, role: "admin" })
    expect(result.success).toBe(false)
    expect(result.error).toBe(
      "Votre compte n'a plus les droits administrateur.",
    )
    expect(await getRole(targetId)).toBe("user")
  })

  it("refuse si l'appelant est soft-deleted", async () => {
    await db
      .update(user)
      .set({ deletedAt: new Date() })
      .where(eq(user.id, adminId))
    const result = await updateUserRole({ userId: targetId, role: "admin" })
    expect(result.success).toBe(false)
    expect(await getRole(targetId)).toBe("user")
  })

  it("refuse une cible inexistante", async () => {
    const result = await updateUserRole({ userId: createId(), role: "admin" })
    expect(result.success).toBe(false)
    expect(result.error).toBe("Utilisateur introuvable.")
  })

  it("refuse une cible soft-deleted", async () => {
    await db
      .update(user)
      .set({ deletedAt: new Date() })
      .where(eq(user.id, targetId))
    const result = await updateUserRole({ userId: targetId, role: "admin" })
    expect(result.success).toBe(false)
    expect(result.error).toBe("Utilisateur introuvable.")
    expect(await getRole(targetId)).toBe("user")
  })

  it("refuse un rôle hors enum (zod)", async () => {
    const result = await updateUserRole({
      userId: targetId,
      role: "superadmin" as never,
    })
    expect(result.success).toBe(false)
    expect(await getRole(targetId)).toBe("user")
  })

  it("sérialise deux rétrogradations croisées : il reste toujours un admin", async () => {
    // Deux admins qui se rétrogradent mutuellement en concurrence réelle : le
    // verrou (SELECT ... ORDER BY id FOR UPDATE) sérialise ; le perdant voit
    // son propre rôle déjà retiré au re-check sous verrou et échoue. Exactement
    // un succès, exactement un admin restant — l'invariant « jamais zéro admin
    // actif » tient sous concurrence, pas seulement séquentiellement.
    await db.update(user).set({ role: "admin" }).where(eq(user.id, targetId))
    vi.mocked(requireRole)
      .mockResolvedValueOnce({
        user: { id: adminId, email: adminEmail, role: "admin" },
        session: { id: createId() },
      } as never)
      .mockResolvedValueOnce({
        user: { id: targetId, email: targetEmail, role: "admin" },
        session: { id: createId() },
      } as never)

    const [byAdmin, byTarget] = await Promise.all([
      updateUserRole({ userId: targetId, role: "user" }),
      updateUserRole({ userId: adminId, role: "user" }),
    ])

    const results = [byAdmin, byTarget]
    expect(results.filter((r) => r.success)).toHaveLength(1)
    const failed = results.find((r) => !r.success)
    expect(failed?.error).toBe(
      "Votre compte n'a plus les droits administrateur.",
    )

    const roles = [await getRole(adminId), await getRole(targetId)]
    expect(roles.filter((r) => r === "admin")).toHaveLength(1)
  })
})
