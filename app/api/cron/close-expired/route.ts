import { closeExpiredExamParticipations } from "@/features/exams/cron"
import { sendPendingNotifications } from "@/features/notifications/cron"
import { closeExpiredTrainingSessions } from "@/features/training/cron"
import { anonymizeExpiredDeletedAccounts } from "@/features/users/cron"
import { env } from "@/lib/env/server"
import { cleanupQuizRateLimits } from "@/lib/quiz-rate-limit"

// Accès DB → runtime Node.
export const runtime = "nodejs"

/**
 * Cron : ferme les participations d'examen et les sessions d'entraînement
 * expirées. Une seule route pour les deux tâches.
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

  // Séquentiel volontairement (Sentry NOMAQBANQ-17) : en parallèle sur un
  // pool froid, chaque tâche ouvre sa propre connexion Neon (3-4 handshakes
  // de ~100 ms) — le détecteur N+1 flaggait cette rafale. En séquence, la
  // première connexion est réutilisée ; un cron de fond n'a pas de latence
  // à optimiser.
  //
  // Chaque tâche est isolée : un échec persistant de l'une (ex. poison-row à
  // la clôture examens) ne doit pas bloquer les suivantes — notamment
  // l'anonymisation RGPD. (Sous l'ancien Promise.all, les tâches déjà
  // lancées allaient au bout malgré un rejet ; la mise en séquence perdait
  // cette propriété sans l'isolation.) Un échec quelconque → 500 après avoir
  // tout tenté, pour conserver le retry du scheduler.
  let failed = false
  const run = async <T>(
    label: string,
    task: () => Promise<T>,
    empty: T,
  ): Promise<T> => {
    try {
      return await task()
    } catch (error) {
      failed = true
      console.error(`[cron close-expired] ${label} en échec`, error)
      return empty
    }
  }

  const examParticipations = await run(
    "clôture examens",
    closeExpiredExamParticipations,
    { closedCount: 0 },
  )
  const trainingSessions = await run(
    "clôture entraînements",
    closeExpiredTrainingSessions,
    { closedCount: 0 },
  )
  const anonymizedAccounts = await run(
    "anonymisation",
    anonymizeExpiredDeletedAccounts,
    { anonymizedCount: 0 },
  )
  const quizRateLimitCleanup = await run(
    "purge rate-limit quiz",
    cleanupQuizRateLimits,
    { deletedCount: 0 },
  )

  // APRÈS les clôtures (pour inclure les `auto_submitted` du même run).
  const notifications = await run("notifications", sendPendingNotifications, {
    examResultsSent: 0,
    accessRemindersSent: 0,
  })

  if (failed) return new Response("Cron handler error", { status: 500 })

  if (
    examParticipations.closedCount > 0 ||
    trainingSessions.closedCount > 0 ||
    anonymizedAccounts.anonymizedCount > 0 ||
    notifications.examResultsSent > 0 ||
    notifications.accessRemindersSent > 0
  ) {
    console.log(
      `[cron close-expired] examens fermés=${examParticipations.closedCount} ` +
        `sessions fermées=${trainingSessions.closedCount} ` +
        `comptes anonymisés=${anonymizedAccounts.anonymizedCount} ` +
        `notif résultats=${notifications.examResultsSent} ` +
        `notif accès=${notifications.accessRemindersSent}`,
    )
  }

  return Response.json({
    examParticipations,
    trainingSessions,
    anonymizedAccounts,
    notifications,
    quizRateLimitCleanup,
  })
}
