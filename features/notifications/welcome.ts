import { and, eq, isNull } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { user } from "@/db/schema"
import { sendWelcomeEmail } from "@/email"
import { captureServerError } from "@/lib/observability"
import { eligibleRecipient, sendOnce } from "./one-shot"

// Deux déclencheurs (création d'un compte Google déjà vérifié, vérification
// d'une adresse) peuvent viser le même compte : le claim de `sendOnce` tranche.
// Tout est sous try/catch, la lecture comprise : les hooks Better Auth re-lèvent
// les exceptions, et une erreur Neon ne doit faire échouer ni une inscription
// ni une vérification d'adresse. Perte tolérée d'un courriel.
export async function sendWelcomeEmailOnce(userId: string): Promise<boolean> {
  try {
    const sent = await sendOnce({
      tag: "[notif:bienvenue]",
      limit: 1,
      select: ({ limit }) =>
        db
          .select({
            id: user.id,
            userId: user.id,
            email: user.email,
            name: user.name,
          })
          .from(user)
          .where(
            and(
              eq(user.id, userId),
              isNull(user.welcomeEmailSentAt),
              eligibleRecipient,
            ),
          )
          .limit(limit),
      claim: {
        table: user,
        idColumn: user.id,
        markerColumn: user.welcomeEmailSentAt,
      },
      send: (r) => sendWelcomeEmail({ to: r.email, name: r.name }),
      context: () => ({ userId }),
    })
    return sent > 0
  } catch (error) {
    captureServerError("[notif:bienvenue]", error, { userId })
    return false
  }
}
