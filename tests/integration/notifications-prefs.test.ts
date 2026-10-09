import { eq } from "drizzle-orm"
import { describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { user } from "@/db/schema"
import {
  updateNotificationPreferences,
  updatePaymentAlertsPreference,
} from "@/features/notifications/actions"
import { getNotificationPreferences } from "@/features/notifications/dal"
import { requireRole, requireSession } from "@/lib/auth-guards"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"

vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))
vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(),
  requireRole: vi.fn(),
}))
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
  it("valeurs par défaut = opt-out (toutes activées)", async () => {
    await signInNewUser()
    const prefs = await getNotificationPreferences()
    expect(prefs).toEqual({
      examResults: true,
      accessExpiry: true,
      marketing: true,
      paymentAlerts: true,
    })
  })

  it("un admin désactive puis réactive ses alertes de paiement", async () => {
    const uid = await signInNewUser()
    vi.mocked(requireRole).mockResolvedValue({
      user: { id: uid, role: "admin" },
    } as never)

    expect(await updatePaymentAlertsPreference({ enabled: false })).toEqual({
      success: true,
    })
    expect((await getNotificationPreferences())?.paymentAlerts).toBe(false)

    await updatePaymentAlertsPreference({ enabled: true })
    expect((await getNotificationPreferences())?.paymentAlerts).toBe(true)
    expect(requireRole).toHaveBeenCalledWith(["admin"])
  })

  it("un candidat ne peut pas toucher aux alertes de paiement", async () => {
    const uid = await signInNewUser()
    vi.mocked(requireRole).mockRejectedValue(new Error("NEXT_REDIRECT"))

    await expect(
      updatePaymentAlertsPreference({ enabled: false }),
    ).rejects.toThrow("NEXT_REDIRECT")
    const [row] = await db
      .select({ p: user.notifyPaymentAlerts })
      .from(user)
      .where(eq(user.id, uid))
      .limit(1)
    expect(row?.p).toBe(true)
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
