import { eq } from "drizzle-orm"
import { cache } from "react"
import "server-only"
import { db } from "@/db"
import { user } from "@/db/schema"
import { getCurrentSession } from "@/lib/dal"

export type NotificationPreferences = {
  examResults: boolean
  accessExpiry: boolean
}

// Préférences de notification de l'utilisateur courant (self-scoped).
export const getNotificationPreferences = cache(
  async (): Promise<NotificationPreferences | null> => {
    const session = await getCurrentSession()
    if (!session?.user) return null
    const [row] = await db
      .select({
        examResults: user.notifyExamResults,
        accessExpiry: user.notifyAccessExpiry,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)
    return row ?? null
  },
)
