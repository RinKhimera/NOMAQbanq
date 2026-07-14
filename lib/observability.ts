import * as Sentry from "@sentry/nextjs"
import "server-only"

/**
 * Capture d'une exception INATTENDUE côté serveur (catch fallback générique
 * des Server Actions, tâches cron, webhook). Les erreurs métier mappées
 * (TIME_UP, ACCESS_EXPIRED, zod, 23505 username…) sont du flux de contrôle :
 * elles ne passent JAMAIS ici — c'est ce qui garde le signal Sentry
 * exploitable.
 *
 * `tag` doit rester statique (cardinalité des tags Sentry) ; les ids
 * dynamiques vont dans `detail` (→ extra). Contexte léger uniquement : pas de
 * payload (PII) dans les événements.
 */
export const captureServerError = (
  tag: string,
  error: unknown,
  context?: { userId?: string; detail?: string },
) => {
  console.error(context?.detail ? `${tag} ${context.detail}` : tag, error)
  if (process.env.NODE_ENV === "production") {
    Sentry.captureException(error, {
      tags: { action: tag },
      user: context?.userId ? { id: context.userId } : undefined,
      extra: context?.detail ? { detail: context.detail } : undefined,
    })
  }
}
