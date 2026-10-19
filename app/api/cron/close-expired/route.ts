import { runSchedule } from "@/features/cron/run"
import { SCHEDULE } from "@/features/cron/schedule"
import { env } from "@/lib/env/server"

// Accès DB → runtime Node.
export const runtime = "nodejs"
// Budget partagé par toutes les tâches d'un passage ; posé ici plutôt que
// laissé au défaut du projet, qui dépend de l'activation de Fluid Compute.
export const maxDuration = 300

/**
 * Cron : une seule route pour l'ensemble des tâches de `SCHEDULE`
 * (`features/cron/schedule.ts`), exécutées par `runSchedule`.
 *
 * Sécurité : l'appelant doit envoyer `Authorization: Bearer ${CRON_SECRET}`.
 * Fail-closed : sans `CRON_SECRET` configuré, on répond 401 (jamais ouvert).
 *
 * ⚠️ Planification : seul le cron Vercel (`vercel.json`) appelle cet endpoint,
 * calé sur la fermeture des examens (hypothèse et horaires :
 * `.claude/rules/exams.md`). Plusieurs passages par jour exigent
 * le forfait Pro : sur Hobby, tout déploiement échouerait.
 * Vercel envoie lui-même le bearer `CRON_SECRET` (variable définie côté Vercel).
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
