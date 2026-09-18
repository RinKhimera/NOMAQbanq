/**
 * AttemptClock — propriétaire unique de l'arithmétique de temps d'une tentative
 * (budget, crédit de pause, grâce, zones d'alerte). Voir `CONTEXT.md`.
 *
 * `now` est toujours un paramètre : le premier rendu du chrono s'ancre sur
 * l'horloge serveur (`initialNow`), jamais sur `Date.now()`.
 */

const SECOND = 1000
const MINUTE = 60 * SECOND

/** Tolérance serveur au-delà du budget, pour la latence entre les horloges. */
export const GRACE_MS = 10 * SECOND

export type PauseInProgress = { startedAt: number; capMinutes: number }

export type AttemptTiming = {
  startedAt: number
  budgetSeconds: number
  /** Crédit de pause figé (pauses déjà reprises). */
  pauseCreditMs: number
  pauseInProgress?: PauseInProgress | null
}

const cappedPauseMs = (pause: PauseInProgress, now: number): number =>
  Math.min(Math.max(0, now - pause.startedAt), pause.capMinutes * MINUTE)

/** Crédit de pause total : figé + pause en cours plafonnée. */
export const pauseCredit = (
  timing: Pick<AttemptTiming, "pauseCreditMs" | "pauseInProgress">,
  now: number,
): number =>
  timing.pauseCreditMs +
  (timing.pauseInProgress ? cappedPauseMs(timing.pauseInProgress, now) : 0)

const elapsedMs = (timing: AttemptTiming, now: number): number =>
  now - timing.startedAt - pauseCredit(timing, now)

/**
 * Temps restant, borné dans `[0, budget]` : un écoulé négatif (ancre plus
 * ancienne que le démarrage, horloge cliente en retard) ne décrit pas un
 * état de tentative.
 */
export const remainingMs = (timing: AttemptTiming, now: number): number => {
  const budgetMs = timing.budgetSeconds * SECOND
  return Math.min(budgetMs, Math.max(0, budgetMs - elapsedMs(timing, now)))
}

export const isExpired = (timing: AttemptTiming, now: number): boolean =>
  elapsedMs(timing, now) > timing.budgetSeconds * SECOND + GRACE_MS

/** Décompte de la pause en cours, jamais négatif. */
export const pauseRemainingMs = (pause: PauseInProgress, now: number): number =>
  Math.max(0, pause.capMinutes * MINUTE - (now - pause.startedAt))

export type TimeZone = "normal" | "warning" | "critical"

export const zone = (remaining: number): TimeZone => {
  if (remaining < 5 * MINUTE) return "critical"
  if (remaining < 10 * MINUTE) return "warning"
  return "normal"
}

const pad = (n: number) => n.toString().padStart(2, "0")

/** HH:MM:SS */
export const formatExamTime = (ms: number): string => {
  const hours = Math.floor(ms / (60 * MINUTE))
  const minutes = Math.floor((ms % (60 * MINUTE)) / MINUTE)
  const seconds = Math.floor((ms % MINUTE) / SECOND)
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/** MM:SS (les minutes peuvent dépasser 59). */
export const formatPauseTime = (ms: number): string => {
  const minutes = Math.floor(ms / MINUTE)
  const seconds = Math.floor((ms % MINUTE) / SECOND)
  return `${pad(minutes)}:${pad(seconds)}`
}
