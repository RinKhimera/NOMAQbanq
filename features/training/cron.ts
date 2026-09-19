import "server-only"
import { db } from "@/db"
import { closeAttempts } from "../attempts/close"

export type CloseExpiredTrainingResult = { closedCount: number }

/**
 * Clôt par lot borné (100) les sessions d'entraînement `in_progress` dont
 * l'expiration est passée, en `abandoned`. Le score de clôture et sa garde
 * appartiennent à `closeAttempts` (`docs/adr/0001`) ; `createTrainingSession`
 * appelle le même écrivain pour la seule session qui lui barre la place.
 * Appelé par la route cron.
 */
export async function closeExpiredTrainingSessions(): Promise<CloseExpiredTrainingResult> {
  const now = new Date()
  const closed = await closeAttempts(db, {
    kind: "training",
    status: "abandoned",
    now,
    where: { expiredBefore: now, limit: 100 },
  })
  return { closedCount: closed.length }
}
