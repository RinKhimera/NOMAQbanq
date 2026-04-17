import type { Doc } from "../_generated/dataModel"

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Vrai si le record d'accès est présent et pas encore expiré.
 * Un record avec `expiresAt === now` est considéré expiré.
 */
export const hasValidAccess = (
  access: Doc<"userAccess"> | null | undefined,
  now: number,
): access is Doc<"userAccess"> => access != null && access.expiresAt > now

/**
 * Jours restants avant expiration. Retourne 0 si déjà expiré.
 */
export const daysRemaining = (expiresAt: number, now: number): number =>
  Math.max(0, Math.ceil((expiresAt - now) / MS_PER_DAY))
