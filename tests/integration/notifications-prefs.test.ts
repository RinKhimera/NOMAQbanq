import { eq } from "drizzle-orm"
import { describe, expect, it, vi } from "vitest"
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

/** Nouvel utilisateur aux préférences par défaut, connecté pour la suite du test. */
const signInNewUser = async () => {
  const id = createId()
  await db
    .insert(user)
    .values({ id, name: "Prefs", email: `prefs-${id}@test.invalid` })
  const shape = { user: { id }, session: { id: createId() } }
  vi.mocked(getCurrentSession).mockResolvedValue(shape as never)
  vi.mocked(requireSession).mockResolvedValue(shape as never)
  return id
}

describe("préférences de notification", () => {
  it("valeurs par défaut = opt-out (les 3 activées)", async () => {
    await signInNewUser()
    const prefs = await getNotificationPreferences()
    expect(prefs).toEqual({
      examResults: true,
      accessExpiry: true,
      marketing: true,
    })
  })

  it("updateNotificationPreferences persiste les 3 booléens", async () => {
    const uid = await signInNewUser()
    const res = await updateNotificationPreferences({
      examResults: false,
      accessExpiry: true,
      marketing: false,
    })
    expect(res.success).toBe(true)
    const [row] = await db
      .select({
        e: user.notifyExamResults,
        a: user.notifyAccessExpiry,
        m: user.notifyMarketing,
      })
      .from(user)
      .where(eq(user.id, uid))
      .limit(1)
    expect(row).toEqual({ e: false, a: true, m: false })
  })
})
