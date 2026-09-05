import { and, eq, isNull } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { user } from "@/db/schema"
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token"

export type UnsubscribeOutcome = "updated" | "invalid"

/** Pose la préférence « rappels » depuis un jeton signé, sans session. */
export async function applyMarketingPreferenceByToken(
  token: string | null | undefined,
  enabled: boolean,
): Promise<UnsubscribeOutcome> {
  const userId = verifyUnsubscribeToken(token)
  if (!userId) return "invalid"
  const updated = await db
    .update(user)
    .set({ notifyMarketing: enabled })
    .where(and(eq(user.id, userId), isNull(user.deletedAt)))
    .returning({ id: user.id })
  return updated.length > 0 ? "updated" : "invalid"
}
