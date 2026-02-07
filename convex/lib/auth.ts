import { Doc } from "../_generated/dataModel"
import { MutationCtx, QueryCtx } from "../_generated/server"
import { Errors } from "./errors"

/**
 * Type pour le contexte avec authentification
 */
export type AuthenticatedUser = Doc<"users">

/**
 * Récupère l'utilisateur courant depuis le contexte
 * @throws ConvexError si non authentifié ou utilisateur non trouvé
 */
export const getCurrentUserOrThrow = async (
  ctx: QueryCtx | MutationCtx,
): Promise<AuthenticatedUser> => {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw Errors.unauthenticated()
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique()

  if (!user) {
    throw Errors.notFound("Utilisateur")
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
 * @throws ConvexError si non authentifié, non trouvé ou non admin
 */
export const getAdminUserOrThrow = async (
  ctx: QueryCtx | MutationCtx,
): Promise<AuthenticatedUser> => {
  const user = await getCurrentUserOrThrow(ctx)

  if (user.role !== "admin") {
    throw Errors.unauthorized()
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

