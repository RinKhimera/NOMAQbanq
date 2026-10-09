import type { ExamStatus } from "@/types"

/**
 * ExamPhase — un seul propriétaire de la phase d'un examen blanc (affichage)
 * et du prédicat « examen ouvert » du glossaire (`CONTEXT.md`).
 *
 * `now` est toujours un paramètre : les surfaces rendues côté serveur
 * s'ancrent sur `initialNow` (règle d'hydratation, `.claude/rules/loading-ui.md`).
 */

export type ExamWindow = {
  isActive: boolean
  startDate: number
  endDate: number
}

type WindowPhase = "upcoming" | "active" | "completed"

/** Phase d'un examen finalisé par ses seules dates, suspension ignorée. */
const windowPhaseOf = (
  exam: Pick<ExamWindow, "startDate" | "endDate">,
  now: number,
): WindowPhase => {
  if (now < exam.startDate) return "upcoming"
  if (!isOpen(exam, now)) return "completed"
  return "active"
}

/**
 * Phase d'un examen finalisé : à venir, en cours, suspendu ou terminé.
 * Suspendu prime sur à venir et en cours ; un examen clos est terminé,
 * suspendu ou non.
 */
export const phaseOf = (
  exam: ExamWindow,
  now: number,
): Exclude<ExamStatus, "preparation"> => {
  const phase = windowPhaseOf(exam, now)
  return phase !== "completed" && !exam.isActive ? "suspended" : phase
}

/**
 * Calendrier d'un examen vu par l'admin, en epoch ms : sans finalisation
 * (`finalizedAt` nul, examen en préparation), ses dates peuvent manquer.
 */
export type ExamSchedule = {
  startDate: number | null
  endDate: number | null
  finalizedAt: number | null
}

/**
 * Fenêtre d'un examen finalisé, `null` en préparation. Dates nulles sur un
 * examen finalisé : exclu par la contrainte `exams_finalized_complete`.
 */
export const finalizedWindow = (
  exam: ExamSchedule,
): { startDate: number; endDate: number } | null =>
  exam.finalizedAt === null || exam.startDate === null || exam.endDate === null
    ? null
    : { startDate: exam.startDate, endDate: exam.endDate }

/** Examen finalisé et ouvert (à venir ou en cours) : celui qui tient le verrou de clé. */
export const isFinalizedOpen = (exam: ExamSchedule, now: number): boolean => {
  const window = finalizedWindow(exam)
  return window !== null && isOpen(window, now)
}

/** Examen finalisé et clos : il se rouvre, sa fin ne se repousse plus s'il a des participations. */
export const isFinalizedClosed = (exam: ExamSchedule, now: number): boolean => {
  const window = finalizedWindow(exam)
  return window !== null && !isOpen(window, now)
}

/** Phase vue par l'admin, qui voit aussi les examens en préparation. */
export type AdminExamWindow = ExamSchedule & { isActive: boolean }

export const adminPhaseOf = (
  exam: AdminExamWindow,
  now: number,
): ExamStatus => {
  const window = finalizedWindow(exam)
  if (window === null) return "preparation"
  return phaseOf({ isActive: exam.isActive, ...window }, now)
}

/**
 * Section d'un examen dans les vues par phase : celle de ses dates, un examen
 * suspendu restant à sa place (en cours ou à venir).
 */
export const adminSectionOf = (
  exam: AdminExamWindow,
  now: number,
): Exclude<ExamStatus, "suspended"> => {
  const window = finalizedWindow(exam)
  return window === null ? "preparation" : windowPhaseOf(window, now)
}

/**
 * Examen ouvert : sa date de fin n'est pas passée. Même borne que le verrou de
 * clé de réponse (`end_date > now()`) : à l'instant exact de la fin, l'examen
 * est clos partout.
 */
export const isOpen = (exam: { endDate: number }, now: number): boolean =>
  now < exam.endDate

export type ExamPartition<T> = { active: T[]; upcoming: T[]; completed: T[] }

/**
 * Classe les examens par leurs dates : un examen suspendu reste dans sa
 * section, où il porte « Suspendu ». La DAL a déjà retiré ceux que l'étudiant
 * ne voit pas.
 */
export const partition = <T extends ExamWindow>(
  exams: readonly T[],
  now: number,
): ExamPartition<T> => {
  const out: ExamPartition<T> = { active: [], upcoming: [], completed: [] }
  for (const exam of exams) out[windowPhaseOf(exam, now)].push(exam)
  return out
}

/** Les résultats d'un examen ne sont lisibles qu'après sa clôture, sauf pour un admin. */
export const canReadResults = (
  exam: { endDate: number },
  viewer: { role?: string | null } | null | undefined,
  now: number,
): boolean => viewer?.role === "admin" || !isOpen(exam, now)
