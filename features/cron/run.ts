import "server-only"
import { captureServerError } from "@/lib/observability"

/**
 * Une tâche du cron : `key` est sa clé dans le rapport JSON, `tag` son
 * étiquette Sentry, `label` son libellé humain (journal, détail d'erreur).
 * `boolean` parce que la dérive des prix renvoie un drapeau `failed`.
 * `quiet` : le rapport de la tâche est une jauge (taille du catalogue), pas
 * un compteur de travail — il ne figure pas dans le journal, sinon un passage
 * qui n'a rien fait ne serait plus jamais silencieux.
 */
export type CronTask = {
  key: string
  label: string
  tag: string
  quiet?: true
  run: () => Promise<Record<string, number | boolean>>
}

export type CronReport = Record<string, Record<string, number | boolean>>

/** Les compteurs numériques non nuls, `libellé clé=valeur` ; vide si rien. */
const summarize = (tasks: readonly CronTask[], report: CronReport): string =>
  tasks
    .map((task) => {
      if (task.quiet) return ""
      const counters = Object.entries(report[task.key] ?? {})
        .filter(([, value]) => typeof value === "number" && value !== 0)
        .map(([key, value]) => `${key}=${value}`)
      return counters.length > 0 ? `${task.label} ${counters.join(" ")}` : ""
    })
    .filter(Boolean)
    .join(" · ")

/**
 * Exécute les tâches dans l'ordre, chacune isolée : un échec est capturé
 * sous le tag et le libellé de la tâche, rend un résultat vide et n'empêche
 * pas les suivantes (notamment l'anonymisation RGPD) ; `failed` permet à la
 * route de répondre 500 après avoir tout tenté, pour conserver le retry du
 * planificateur.
 *
 * Séquentiel volontairement (Sentry NOMAQBANQ-17) : en parallèle sur un
 * pool froid, chaque tâche ouvre sa propre connexion Neon — le détecteur N+1
 * flaggait cette rafale. En séquence, la première connexion est réutilisée ;
 * un cron de fond n'a pas de latence à optimiser.
 */
export const runSchedule = async (
  tasks: readonly CronTask[],
): Promise<{ report: CronReport; failed: boolean }> => {
  const report: CronReport = {}
  let failed = false
  for (const task of tasks) {
    try {
      report[task.key] = await task.run()
    } catch (error) {
      failed = true
      captureServerError(task.tag, error, { detail: task.label })
      report[task.key] = {}
    }
  }

  const summary = summarize(tasks, report)
  if (summary) console.log(`[cron] ${summary}`)

  return { report, failed }
}
