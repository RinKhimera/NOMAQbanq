import { ConvexError } from "convex/values"

/**
 * Error codes for type-safe error handling in frontend
 */
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "ACCESS_EXPIRED"
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "ALREADY_EXISTS"
  | "INVALID_STATE"

/**
 * Standardized error factory for Convex mutations/queries
 *
 * @example
 * // In mutation handler:
 * throw Errors.unauthorized()
 *
 * // In frontend:
 * try {
 *   await mutation()
 * } catch (e) {
 *   if (e instanceof ConvexError) {
 *     const { code, message } = e.data as { code: ErrorCode; message: string }
 *     if (code === "ACCESS_EXPIRED") showUpgradeModal()
 *   }
 * }
 */
export const Errors = {
  unauthenticated: () =>
    new ConvexError({
      code: "UNAUTHENTICATED" as const,
      message: "Non authentifié",
    }),

  unauthorized: (message?: string) =>
    new ConvexError({
      code: "UNAUTHORIZED" as const,
      message: message ?? "Accès non autorisé",
    }),

  notFound: (entity: string) =>
    new ConvexError({
      code: "NOT_FOUND" as const,
      message: `${entity} non trouvé`,
    }),

  accessExpired: (accessType?: "exam" | "training") =>
    new ConvexError({
      code: "ACCESS_EXPIRED" as const,
      message: accessType
        ? `Votre accès ${accessType === "exam" ? "aux examens" : "à l'entraînement"} a expiré`
        : "Votre accès a expiré",
    }),

  invalidInput: (message: string) =>
    new ConvexError({ code: "INVALID_INPUT" as const, message }),

  rateLimited: (retryAfterMinutes: number) =>
    new ConvexError({
      code: "RATE_LIMITED" as const,
      message: `Limite atteinte. Réessayez dans ${retryAfterMinutes} minute(s).`,
    }),

  alreadyExists: (entity: string) =>
    new ConvexError({
      code: "ALREADY_EXISTS" as const,
      message: `${entity} existe déjà`,
    }),

  invalidState: (message: string) =>
    new ConvexError({ code: "INVALID_STATE" as const, message }),
}
