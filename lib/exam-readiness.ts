import { toAppZoneCalendarDay } from "@/lib/app-zone"
import type { ExamSchedule } from "@/lib/exam-phase"
import { formatClockTime, formatDayMonth } from "@/lib/format"

/**
 * Ce qui reste à faire avant qu'un examen s'ouvre : vérifications de la carte
 * « À préparer » (liste) et du récapitulatif du formulaire. `now` toujours en
 * paramètre (ancre serveur au premier rendu).
 */

export type ReadinessInput = ExamSchedule & {
  questionCount: number
  /** Questions du jeu supprimées depuis leur ajout : bloquantes. */
  deletedQuestionCount?: number
  targetQuestionCount: number
  audienceType: "subscribers" | "restricted"
  /** Étudiants de la liste restreinte (comptes supprimés exclus). */
  audienceSize: number
}

export type ReadinessCheck = {
  key: "questions" | "dates" | "audience" | "reports"
  label: string
  ok: boolean
  /** `danger` : bloque la finalisation ; `warning` : à vérifier. */
  tone: "danger" | "warning"
  value: string
}

/** Texte d'une date absente d'un examen en préparation. */
export const NO_DATE = "à choisir"

/** Examen en préparation dont la date d'ouverture est passée : il ne s'ouvrira pas seul. */
export const isLateToOpen = (exam: ExamSchedule, now: number): boolean =>
  exam.finalizedAt === null && exam.startDate !== null && exam.startDate <= now

/** « 23 oct. → 26 oct. », ou « à choisir » sans dates. */
export const shortWindow = (exam: ExamSchedule): string =>
  exam.startDate === null || exam.endDate === null
    ? NO_DATE
    : `${formatDayMonth(exam.startDate)} → ${formatDayMonth(exam.endDate)}`

/** « 23 oct. 0 h 00 → 26 oct. 0 h 00 » : ouverture et fermeture à l'heure près. */
export const preciseWindow = (exam: ExamSchedule): string =>
  exam.startDate === null || exam.endDate === null
    ? NO_DATE
    : `${formatDayMonth(exam.startDate)} ${formatClockTime(exam.startDate)} → ${formatDayMonth(exam.endDate)} ${formatClockTime(exam.endDate)}`

const dayNumber = (instant: number) => {
  const [y, m, d] = toAppZoneCalendarDay(instant).split("-").map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

/** Journées civiles (heure de l'Est) de `now` à `target` : « dans 3 j ». */
export const calendarDaysUntil = (target: number, now: number): number =>
  dayNumber(target) - dayNumber(now)

const plural = (n: number, one: string, many: string) =>
  `${n} ${n > 1 ? many : one}`

/**
 * `finalizing` : vues du formulaire, au moment de finaliser. Une ouverture
 * passée n'y bloque pas (la finalisation ouvre aussitôt l'examen) ; une
 * fermeture passée, si (la finalisation la refuse).
 */
export const examReadiness = (
  exam: ReadinessInput,
  now: number,
  { finalizing = false }: { finalizing?: boolean } = {},
): ReadinessCheck[] => {
  const late = !finalizing && isLateToOpen(exam, now)
  const hasDates = exam.startDate !== null && exam.endDate !== null
  const closed = finalizing && exam.endDate !== null && exam.endDate <= now
  const restricted = exam.audienceType === "restricted"
  return [
    {
      key: "questions",
      label: "Questions",
      ok:
        exam.questionCount === exam.targetQuestionCount &&
        !exam.deletedQuestionCount,
      tone: "danger",
      value: exam.deletedQuestionCount
        ? `${plural(exam.deletedQuestionCount, "supprimée", "supprimées")} à retirer`
        : `${exam.questionCount} / ${exam.targetQuestionCount}`,
    },
    {
      key: "dates",
      label: "Dates",
      ok: hasDates && !late && !closed,
      tone: "danger",
      value:
        late && exam.startDate !== null
          ? `devait ouvrir le ${formatDayMonth(exam.startDate)}`
          : closed
            ? "fenêtre déjà close"
            : shortWindow(exam),
    },
    {
      key: "audience",
      label: "Audience",
      ok: !restricted || exam.audienceSize > 0,
      tone: "danger",
      value: restricted
        ? exam.audienceSize > 0
          ? plural(exam.audienceSize, "invité", "invités")
          : "liste vide"
        : "Abonnés Examens",
    },
    // Le signalement côté candidat n'existe pas encore.
    {
      key: "reports",
      label: "Signalements",
      ok: true,
      tone: "warning",
      value: "aucun",
    },
  ]
}

/** Badge de synthèse : « Prêt », « 2 points bloquants », « 3 points dont 1 bloquant ». */
export const readinessSummary = (
  checks: ReadinessCheck[],
): { tone: "success" | "danger" | "warning"; label: string } => {
  const issues = checks.filter((c) => !c.ok)
  const blocking = issues.filter((c) => c.tone === "danger").length
  if (issues.length === 0) return { tone: "success", label: "Prêt" }
  if (blocking === 0) {
    return {
      tone: "warning",
      label: plural(issues.length, "point à vérifier", "points à vérifier"),
    }
  }
  if (blocking === issues.length) {
    return {
      tone: "danger",
      label: plural(blocking, "point bloquant", "points bloquants"),
    }
  }
  return {
    tone: "danger",
    label: `${issues.length} points dont ${plural(blocking, "bloquant", "bloquants")}`,
  }
}
