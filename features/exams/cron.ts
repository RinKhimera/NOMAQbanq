import "server-only"
import { db } from "@/db"
import { closeAttempts } from "../attempts/close"

export type CloseExpiredParticipationsResult = { closedCount: number }

/**
 * Clôt par lot borné (500) les participations `in_progress` dont l'examen
 * blanc est terminé, en `auto_submitted`. Le score de clôture et sa garde
 * appartiennent à `closeAttempts` (`docs/adr/0001`). Appelé par la route cron.
 */
export async function closeExpiredExamParticipations(): Promise<CloseExpiredParticipationsResult> {
  const now = new Date()
  const closed = await closeAttempts(db, {
    kind: "exam",
    status: "auto_submitted",
    now,
    where: { expiredBefore: now, limit: 500 },
  })
  return { closedCount: closed.length }
}
