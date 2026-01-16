import { Doc, Id } from "../_generated/dataModel"
import { MutationCtx, QueryCtx } from "../_generated/server"

/**
 * Type pour le contexte avec authentification
 */
export type AuthenticatedUser = Doc<"users">

/**
 * Récupère l'utilisateur courant depuis le contexte
 * @throws Error si non authentifié ou utilisateur non trouvé
 */
export const getCurrentUserOrThrow = async (
  ctx: QueryCtx | MutationCtx,
): Promise<AuthenticatedUser> => {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error("Utilisateur non authentifié")
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique()

  if (!user) {
    throw new Error("Utilisateur non trouvé")
  }

  return user
}

/**
 * Récupère l'utilisateur courant ou null
 * Utilisé pour les queries qui peuvent retourner des résultats même sans auth
 */
export const getCurrentUserOrNull = async (
  ctx: QueryCtx | MutationCtx,
): Promise<AuthenticatedUser | null> => {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    return null
  }

  return await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique()
}

/**
 * Récupère l'utilisateur admin courant
 * @throws Error si non authentifié, non trouvé ou non admin
 */
export const getAdminUserOrThrow = async (
  ctx: QueryCtx | MutationCtx,
): Promise<AuthenticatedUser> => {
  const user = await getCurrentUserOrThrow(ctx)

  if (user.role !== "admin") {
    throw new Error("Accès non autorisé")
  }

  return user
}

/**
 * Vérifie si l'utilisateur courant est admin
 */
export const isAdmin = async (
  ctx: QueryCtx | MutationCtx,
): Promise<boolean> => {
  const user = await getCurrentUserOrNull(ctx)
  return user?.role === "admin"
}

/**
 * Helper pour récupérer plusieurs documents par leurs IDs en batch
 * Plus efficace que Promise.all avec ctx.db.get() individuels
 */
export const getManyByIds = async (
  ctx: QueryCtx | MutationCtx,
  table: "questions" | "users" | "exams" | "trainingParticipations" | "trainingAnswers",
  ids: Id<typeof table>[],
): Promise<(Doc<typeof table> | null)[]> => {
  // Utiliser Promise.all est actuellement la meilleure approche dans Convex
  // car il n'y a pas de méthode batch native
  return Promise.all(ids.map((id) => ctx.db.get(id)))
}
