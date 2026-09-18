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

/** Phase d'affichage : à venir, en cours, terminé ou désactivé. */
export const phaseOf = (exam: ExamWindow, now: number): ExamStatus => {
  if (!exam.isActive) return "inactive"
  if (now < exam.startDate) return "upcoming"
  if (now > exam.endDate) return "completed"
  return "active"
}

/** Examen ouvert : sa date de fin n'est pas passée (déclenche le verrou). */
export const isOpen = (exam: { endDate: number }, now: number): boolean =>
  now <= exam.endDate

export type ExamPartition<T> = { active: T[]; upcoming: T[]; completed: T[] }

/** Classe les examens actifs par phase ; les désactivés n'apparaissent nulle part. */
export const partition = <T extends ExamWindow>(
  exams: readonly T[],
  now: number,
): ExamPartition<T> => {
  const out: ExamPartition<T> = { active: [], upcoming: [], completed: [] }
  for (const exam of exams) {
    const phase = phaseOf(exam, now)
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
