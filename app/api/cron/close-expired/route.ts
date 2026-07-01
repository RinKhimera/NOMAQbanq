import { closeExpiredExamParticipations } from "@/features/exams/cron"
import { closeExpiredTrainingSessions } from "@/features/training/cron"
import { anonymizeExpiredDeletedAccounts } from "@/features/users/cron"
import { env } from "@/lib/env/server"

// Accès DB → runtime Node.
export const runtime = "nodejs"

/**
 * Cron : ferme les participations d'examen et les sessions d'entraînement
 * expirées. Remplace les 2 crons Convex (`close-expired-exam-participations` +
 * `close-expired-training-sessions`), fusionnés en une route (Postgres n'a pas la
 * contention qui justifiait le décalage :00/:30 de Convex).
 *
 * Sécurité : l'appelant doit envoyer `Authorization: Bearer ${CRON_SECRET}`.
 * Fail-closed : sans `CRON_SECRET` configuré, on répond 401 (jamais ouvert).
 *
 * ⚠️ Planification (plan Vercel Hobby — pas de cron horaire) :
 *   - `vercel.json` déclenche cet endpoint 1×/jour (`0 0 * * *`) = plancher garanti.
 *   - `.github/workflows/cron-hourly.yml` le rappelle chaque heure (best-effort).
 *   Définir `CRON_SECRET` côté Vercel ET en secret GitHub (+ variable
 *   `CRON_ENDPOINT_URL`). Vercel envoie automatiquement le bearer ; le workflow
 *   GitHub l'ajoute explicitement.
 */
export async function GET(request: Request) {
  // Secret absent = misconfiguration (cron inopérant) : on le signale, là où une
  // requête forgée reçoit juste un 401 muet. Fail-closed dans les deux cas.
  if (!env.CRON_SECRET) {
    console.error(
      "[cron close-expired] CRON_SECRET non configuré — cron inopérant (401). Définir CRON_SECRET côté Vercel.",
    )
    return new Response("Unauthorized", { status: 401 })
  }
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    const [examParticipations, trainingSessions, anonymizedAccounts] =
      await Promise.all([
        closeExpiredExamParticipations(),
        closeExpiredTrainingSessions(),
        anonymizeExpiredDeletedAccounts(),
      ])

    if (
      examParticipations.closedCount > 0 ||
      trainingSessions.closedCount > 0 ||
      anonymizedAccounts.anonymizedCount > 0
    ) {
      console.log(
        `[cron close-expired] examens fermés=${examParticipations.closedCount} ` +
          `sessions fermées=${trainingSessions.closedCount} ` +
          `comptes anonymisés=${anonymizedAccounts.anonymizedCount}`,
      )
    }

    return Response.json({
      examParticipations,
      trainingSessions,
      anonymizedAccounts,
    })
  } catch (error) {
    // Erreur inattendue (DB…) → 500 ; Vercel logue + réessaie à la prochaine heure.
    console.error("[cron close-expired] échec", error)
    return new Response("Cron handler error", { status: 500 })
  }
}
