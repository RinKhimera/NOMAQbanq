import { and, eq } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { uploadRateLimits } from "@/db/schema"

/**
 * Rate-limit des uploads par utilisateur + type, sur fenêtre glissante d'1 h.
 * La table `upload_rate_limits` a une contrainte UNIQUE(userId, uploadType).
 *
 * **Un seul appel atomique** consomme le quota AVANT l'upload.
 * Avantages : (a) ferme la fenêtre TOCTOU (deux requêtes concurrentes du même
 * user ne peuvent plus dépasser la limite — le `SELECT … FOR UPDATE` les
 * sérialise) ; (b) plus résistant à l'abus (une requête qui spamme l'endpoint
 * est comptée même si l'upload échoue ensuite). Contrepartie acceptée : un
 * upload qui échoue côté Bunny consomme tout de même un slot (limites
 * généreuses : 5/h avatars, 50/h images de questions).
 */

const WINDOW_MS = 60 * 60 * 1000 // 1 h

type UploadType = "avatar" | "question-image"

const MAX_PER_WINDOW: Record<UploadType, number> = {
  avatar: 5,
  "question-image": 50,
}

export type RateLimitResult =
  { allowed: true } | { allowed: false; retryAfterMinutes: number }

/**
 * Consomme un slot d'upload pour `(userId, uploadType)`. Renvoie `allowed:false`
 * (sans consommer) si la limite de la fenêtre courante est atteinte.
 */
export const consumeUploadRateLimit = async (
  userId: string,
  uploadType: UploadType,
): Promise<RateLimitResult> => {
  const now = Date.now()
  const max = MAX_PER_WINDOW[uploadType]

  return db.transaction(async (tx) => {
    // Garantit l'existence d'une ligne sans modifier les compteurs d'une ligne
    // déjà présente (gère la course à la première insertion concurrente).
    await tx
      .insert(uploadRateLimits)
      .values({ userId, uploadType, count: 0, windowStart: new Date(now) })
      .onConflictDoNothing({
        target: [uploadRateLimits.userId, uploadRateLimits.uploadType],
      })

    // Verrou de ligne : sérialise les requêtes concurrentes du même (user, type).
    const [row] = await tx
      .select({
        id: uploadRateLimits.id,
        count: uploadRateLimits.count,
        windowStart: uploadRateLimits.windowStart,
      })
      .from(uploadRateLimits)
      .where(
        and(
          eq(uploadRateLimits.userId, userId),
          eq(uploadRateLimits.uploadType, uploadType),
        ),
      )
      .for("update")
      .limit(1)

    // La ligne existe forcément (insert ci-dessus) ; garde défensive.
    if (!row) return { allowed: true as const }

    const windowAge = now - row.windowStart.getTime()

    // Fenêtre expirée → réinitialise le compteur à 1 (cet upload).
    if (windowAge >= WINDOW_MS) {
      await tx
        .update(uploadRateLimits)
        .set({ count: 1, windowStart: new Date(now) })
        .where(eq(uploadRateLimits.id, row.id))
      return { allowed: true as const }
    }

    // Sous la limite → incrémente.
    if (row.count < max) {
      await tx
        .update(uploadRateLimits)
        .set({ count: row.count + 1 })
        .where(eq(uploadRateLimits.id, row.id))
      return { allowed: true as const }
    }

    // Limite atteinte → refuse sans consommer.
    const retryAfterMs = WINDOW_MS - windowAge
    return {
      allowed: false as const,
      retryAfterMinutes: Math.max(1, Math.ceil(retryAfterMs / (60 * 1000))),
    }
  })
}
