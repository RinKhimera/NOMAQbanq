import "server-only"

import { and, eq } from "drizzle-orm"
import { cache } from "react"

import { db } from "@/db"
import { user, userAccess } from "@/db/schema"
import { getCurrentSession } from "@/lib/dal"

const DAY_MS = 24 * 60 * 60 * 1000

export type AccessInfo = { expiresAt: number; daysRemaining: number } | null
export type AccessStatus = {
  examAccess: AccessInfo
  trainingAccess: AccessInfo
}

const toAccessInfo = (
  expiresAt: Date | null | undefined,
  now: number,
): AccessInfo => {
  if (!expiresAt) return null
  const ms = expiresAt.getTime()
  if (ms <= now) return null
  return { expiresAt: ms, daysRemaining: Math.ceil((ms - now) / DAY_MS) }
}

/**
 * Statut d'accès complet (exam + training). `userId` optionnel → défaut = session.
 * Remplace `getMyAccessStatus` + `getMyAccess`. `null` si non connecté.
 * Borné par la contrainte UNIQUE(user_id, access_type) → au plus 2 lignes.
 */
export const getAccessStatus = cache(
  async (userId?: string): Promise<AccessStatus | null> => {
    let targetId = userId
    if (!targetId) {
      const session = await getCurrentSession()
      if (!session?.user) return null
      targetId = session.user.id
    }

    const rows = await db
      .select({
        accessType: userAccess.accessType,
        expiresAt: userAccess.expiresAt,
      })
      .from(userAccess)
      .where(eq(userAccess.userId, targetId))

    const now = Date.now()
    return {
      examAccess: toAccessInfo(
        rows.find((r) => r.accessType === "exam")?.expiresAt,
        now,
      ),
      trainingAccess: toAccessInfo(
        rows.find((r) => r.accessType === "training")?.expiresAt,
        now,
      ),
    }
  },
)

/**
 * Gating : `true` si admin (bypass) ou accès valide pour le type donné.
 * Remplace `hasExamAccess` / `hasTrainingAccess`. `userId` optionnel → défaut = session.
 */
export const hasAccess = async (
  type: "exam" | "training",
  userId?: string,
): Promise<boolean> => {
  let targetId = userId
  if (!targetId) {
    const session = await getCurrentSession()
    if (!session?.user) return false
    if (session.user.role === "admin") return true
    targetId = session.user.id
  } else {
    const [u] = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, targetId))
      .limit(1)
    if (u?.role === "admin") return true
  }

  const [row] = await db
    .select({ expiresAt: userAccess.expiresAt })
    .from(userAccess)
    .where(and(eq(userAccess.userId, targetId), eq(userAccess.accessType, type)))
    .limit(1)

  return Boolean(row) && row.expiresAt.getTime() > Date.now()
}
