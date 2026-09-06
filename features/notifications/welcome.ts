import { and, eq, isNull } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { user } from "@/db/schema"
import { sendWelcomeEmail } from "@/email"
import { captureServerError } from "@/lib/observability"

// Claim atomique AVANT l'envoi : deux déclencheurs (création d'un compte Google
// déjà vérifié, vérification d'une adresse) peuvent viser le même compte.
// Tout est sous try/catch, l'UPDATE compris : les hooks Better Auth re-lèvent
// les exceptions, et une erreur Neon ne doit faire échouer ni une inscription
// ni une vérification d'adresse. Perte tolérée d'un courriel.
export async function sendWelcomeEmailOnce(userId: string): Promise<boolean> {
  try {
    const [claimed] = await db
      .update(user)
      .set({ welcomeEmailSentAt: new Date() })
      .where(
        and(
          eq(user.id, userId),
          isNull(user.welcomeEmailSentAt),
          isNull(user.deletedAt),
        ),
      )
      .returning({ email: user.email, name: user.name })
    if (!claimed) return false
    await sendWelcomeEmail({ to: claimed.email, name: claimed.name })
    return true
  } catch (error) {
    captureServerError("[notif:bienvenue]", error, { userId })
    return false
  }
}
