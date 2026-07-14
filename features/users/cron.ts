import { and, eq, isNull, lt } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { account, user } from "@/db/schema"
import { DELETION_GRACE_MS } from "@/features/users/lib/account-deletion"
import { captureServerError } from "@/lib/observability"

export type AnonymizeResult = { anonymizedCount: number }

// Anonymise définitivement les comptes soft-supprimés dont la grâce (30 j) est
// dépassée : scrub PII (nom/email/username/bio/image), purge des lignes `account`
// (tokens OAuth / hash de mot de passe). `id` conservé → intégrité de l'historique.
// Borné à 500 par run (AGENTS.md : reads bornés).
export async function anonymizeExpiredDeletedAccounts(): Promise<AnonymizeResult> {
  const cutoff = new Date(Date.now() - DELETION_GRACE_MS)

  const expired = await db
    .select({ id: user.id })
    .from(user)
    .where(and(lt(user.deletedAt, cutoff), isNull(user.anonymizedAt)))
    .limit(500)

  let anonymizedCount = 0
  for (const { id } of expired) {
    // Résilience : une ligne qui échoue ne doit ni casser tout le lot ni bloquer
    // la file aux runs suivants (poison row). On isole chaque compte.
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(user)
          .set({
            name: "Utilisateur supprimé",
            email: `deleted-${id}@deleted.invalid`,
            username: null,
            bio: null,
            image: null,
            anonymizedAt: new Date(),
          })
          .where(eq(user.id, id))
        await tx.delete(account).where(eq(account.userId, id))
      })
      anonymizedCount++
    } catch (error) {
      captureServerError("[cron:anonymize]", error, { detail: `user ${id}` })
    }
  }

  return { anonymizedCount }
}
