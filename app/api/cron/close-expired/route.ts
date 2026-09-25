import { runSchedule } from "@/features/cron/run"
import { SCHEDULE } from "@/features/cron/schedule"
import { env } from "@/lib/env/server"

// Accès DB → runtime Node.
export const runtime = "nodejs"

/**
 * Cron : une seule route pour l'ensemble des tâches de `SCHEDULE`
 * (`features/cron/schedule.ts`), exécutées par `runSchedule`.
 *
 * Sécurité : l'appelant doit envoyer `Authorization: Bearer ${CRON_SECRET}`.
 * Fail-closed : sans `CRON_SECRET` configuré, on répond 401 (jamais ouvert).
 *
 * ⚠️ Planification (plan Vercel Hobby — pas de cron infra-quotidien) :
 *   - `vercel.json` déclenche cet endpoint 1×/jour (`0 0 * * *`) = plancher garanti.
 *   - `.github/workflows/cron-close-expired.yml` le rappelle toutes les 6 h (best-effort).
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

  const { report, failed } = await runSchedule(SCHEDULE)
  if (failed) return new Response("Cron handler error", { status: 500 })
  return Response.json(report)
}
