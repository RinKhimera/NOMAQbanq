import {
  type AttemptTiming,
  pauseRemainingMs,
  remainingMs,
} from "@/lib/attempt-clock"
import { isPassing } from "@/lib/score"

/**
 * ExamList — état d'affichage des examens blancs d'un étudiant, dérivé de la
 * liste servie par la DAL et de l'horloge. Module pur : `now` est toujours un
 * paramètre (règle d'hydratation, `.claude/rules/loading-ui.md`).
 */

export type ListParticipation = {
  status: "in_progress" | "completed" | "auto_submitted"
  /** `null` = score retenu. */
  score: number | null
  completedAt: number | null
  answeredCount: number
  /** Présent pour une participation démarrée : de quoi lire le temps restant. */
  timing: AttemptTiming | null
}

export type ListExam = {
  id: string
  endDate: number
  completionTime: number
  audienceType: "subscribers" | "restricted"
  userParticipation: ListParticipation | null
}

/**
 * État d'un examen ouvert, dans l'ordre d'affichage : temps écoulé, en cours
 * ou en pause, ouvert, réservé aux abonnés, soumis.
 */
export type OpenExamState =
  "elapsed" | "paused" | "started" | "eligible" | "locked" | "submitted"

const RANK: Record<OpenExamState, number> = {
  elapsed: 0,
  started: 1,
  paused: 1,
  eligible: 2,
  locked: 3,
  submitted: 4,
}

/** Un examen sur invitation se passe sans abonnement : l'audience est l'accès. */
export const isEligible = (
  exam: Pick<ListExam, "audienceType">,
  hasAccess: boolean,
): boolean => hasAccess || exam.audienceType === "restricted"

/** Le budget de temps d'une participation démarrée est épuisé (ou jamais démarrée). */
export const budgetExhausted = (
  participation: Pick<ListParticipation, "timing">,
  now: number,
): boolean =>
  !participation.timing || remainingMs(participation.timing, now) <= 0

/**
 * Une participation en cours sans accès (abonnement échu en route) se rend
 * comme « réservé aux abonnés » : le serveur refuserait chaque réponse, la
 * clôture aussi — même le temps écoulé, l'examen ne se soumettra qu'à la
 * fermeture, par le cron.
 */
export const openExamState = (
  exam: ListExam,
  now: number,
  hasAccess: boolean,
): OpenExamState => {
  const p = exam.userParticipation
  if (p && p.status !== "in_progress") return "submitted"
  if (!isEligible(exam, hasAccess)) return "locked"
  if (!p) return "eligible"
  const timing = p.timing
  if (!timing || remainingMs(timing, now) <= 0) return "elapsed"
  if (
    timing.pauseInProgress &&
    pauseRemainingMs(timing.pauseInProgress, now) > 0
  ) {
    return "paused"
  }
  return "started"
}

export const sortOpenExams = <T extends { state: OpenExamState }>(
  items: readonly T[],
): T[] => items.toSorted((a, b) => RANK[a.state] - RANK[b.state])

/** Temps affiché pour une participation en cours : le plus court du budget et de la fermeture. */
export const shownRemainingMs = (
  exam: Pick<ListExam, "endDate">,
  timing: AttemptTiming,
  now: number,
): { ms: number; limitedByClosing: boolean } => {
  const budget = remainingMs(timing, now)
  const closing = Math.max(0, exam.endDate - now)
  return { ms: Math.min(budget, closing), limitedByClosing: closing < budget }
}

/** L'examen ferme avant la fin de la durée prévue : il sera soumis à la fermeture. */
export const closesBeforeBudget = (
  exam: Pick<ListExam, "endDate" | "completionTime">,
  now: number,
): boolean => exam.endDate - now < exam.completionTime * 1000

export type ExamListStats = {
  /** Participations soumises, examen encore ouvert compris. */
  taken: number
  /** Scores lisibles (publiés). */
  graded: number
  passed: number
  /** Moyenne des scores lisibles, au plancher ; `null` sans score lisible. */
  average: number | null
}

/**
 * Chiffres d'en-tête. Un score retenu compte dans « passés » mais ni dans
 * « réussis » ni dans la moyenne : la moyenne le rendrait par soustraction.
 */
export const examListStats = (
  exams: readonly Pick<ListExam, "userParticipation">[],
): ExamListStats => {
  const submitted = exams.flatMap((e) =>
    e.userParticipation && e.userParticipation.status !== "in_progress"
      ? [e.userParticipation]
      : [],
  )
  const scores = submitted.flatMap((p) => (p.score === null ? [] : [p.score]))
  return {
    taken: submitted.length,
    graded: scores.length,
    passed: scores.filter(isPassing).length,
    average:
      scores.length > 0
        ? Math.floor(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null,
  }
}

/** Ce que la ligne d'un examen terminé affiche à la place du score. */
export type PastScoreState =
  | { kind: "score"; score: number }
  | { kind: "withheld" }
  /** Participation en cours d'un examen fermé, pas encore balayée par le cron. */
  | { kind: "closing" }
  | { kind: "none" }

export const pastScoreState = (
  participation: ListParticipation | null,
): PastScoreState => {
  if (!participation) return { kind: "none" }
  if (participation.status === "in_progress") return { kind: "closing" }
  if (participation.score === null) return { kind: "withheld" }
  return { kind: "score", score: Math.floor(participation.score) }
}

export type MonthGroup<T> = { key: string; items: T[] }

/**
 * Groupe des examens terminés par mois de fermeture, dans l'ordre reçu (le
 * plus récent d'abord). `monthKey` rend la clé d'un instant (« 2026-09 »).
 */
export const groupByMonth = <T extends { endDate: number }>(
  items: readonly T[],
  monthKey: (endDate: number) => string,
): MonthGroup<T>[] => {
  const groups: MonthGroup<T>[] = []
  for (const item of items) {
    const key = monthKey(item.endDate)
    const last = groups.at(-1)
    if (last && last.key === key) last.items.push(item)
    else groups.push({ key, items: [item] })
  }
  return groups
}

/** Mois affichés d'emblée ; au-delà, un repli « Afficher les mois précédents ». */
export const VISIBLE_MONTHS = 3
