import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { user } from "@/db/schema"
import { updateNotificationPreferences } from "@/features/notifications/actions"
import { getNotificationPreferences } from "@/features/notifications/dal"
import { requireSession } from "@/lib/auth-guards"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"

vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))
vi.mock("@/lib/auth-guards", () => ({ requireSession: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const uid = createId()

beforeAll(async () => {
  await db
    .insert(user)
    .values({ id: uid, name: "Prefs", email: `prefs-${uid}@test.invalid` })
  const shape = { user: { id: uid }, session: { id: createId() } }
  vi.mocked(getCurrentSession).mockResolvedValue(shape as never)
  vi.mocked(requireSession).mockResolvedValue(shape as never)
})

afterAll(async () => {
  await db.delete(user).where(eq(user.id, uid))
})

describe("préférences de notification", () => {
  it("valeurs par défaut = opt-out (les 2 activées)", async () => {
    const prefs = await getNotificationPreferences()
    expect(prefs).toEqual({ examResults: true, accessExpiry: true })
  })

  it("updateNotificationPreferences persiste les 2 booléens", async () => {
    const res = await updateNotificationPreferences({
      examResults: false,
      accessExpiry: true,
    })
    expect(res.success).toBe(true)
    const [row] = await db
      .select({
        e: user.notifyExamResults,
        a: user.notifyAccessExpiry,
      })
      .from(user)
      .where(eq(user.id, uid))
      .limit(1)
    expect(row).toEqual({ e: false, a: true })
  })
})
