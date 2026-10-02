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

/** Phase d'un examen finalisé : à venir, en cours, terminé ou désactivé. */
export const phaseOf = (
  exam: ExamWindow,
  now: number,
): Exclude<ExamStatus, "preparation"> => {
  if (!exam.isActive) return "inactive"
  if (now < exam.startDate) return "upcoming"
  if (!isOpen(exam, now)) return "completed"
  return "active"
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

/** Phase vue par l'admin, qui voit aussi les examens en préparation. « Désactivé » prime. */
export type AdminExamWindow = ExamSchedule & { isActive: boolean }

export const adminPhaseOf = (
  exam: AdminExamWindow,
  now: number,
): ExamStatus => {
  if (!exam.isActive) return "inactive"
  const window = finalizedWindow(exam)
  if (window === null) return "preparation"
  return phaseOf({ isActive: true, ...window }, now)
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
 * Classe les examens par phase. Un désactivé n'apparaît que pour qui y a
 * participé, classé par ses dates : il doit pouvoir reprendre son épreuve ou
 * relire ses résultats.
 */
export const partition = <
  T extends ExamWindow & { userParticipation?: unknown },
>(
  exams: readonly T[],
  now: number,
): ExamPartition<T> => {
  const out: ExamPartition<T> = { active: [], upcoming: [], completed: [] }
  for (const exam of exams) {
    const phase = phaseOf(
      exam.userParticipation ? { ...exam, isActive: true } : exam,
      now,
    )
    if (phase !== "inactive") out[phase].push(exam)
  }
  return out
}

/** Les résultats d'un examen ne sont lisibles qu'après sa clôture, sauf pour un admin. */
export const canReadResults = (
  exam: { endDate: number },
  viewer: { role?: string | null } | null | undefined,
  now: number,
): boolean => viewer?.role === "admin" || !isOpen(exam, now)
