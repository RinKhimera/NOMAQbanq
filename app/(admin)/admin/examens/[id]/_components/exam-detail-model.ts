import {
  countLabel,
  formatCount,
} from "@/components/admin/question-detail/labels"
import type { StatBandItem } from "@/components/shared/stat-band"
import type {
  AdminExam,
  ExamFigures,
  LeaderboardFlag,
} from "@/features/exams/dal"
import { SECONDS_PER_QUESTION } from "@/features/exams/schemas"
import { isLateToOpen } from "@/lib/exam-readiness"
import type { ExamStatus } from "@/lib/exam-status"
import {
  NBSP,
  formatClockTime,
  formatDayMonth,
  formatShortDuration,
} from "@/lib/format"
import { PASS_THRESHOLD, formatScore } from "@/lib/score"

/**
 * Règles d'affichage de la fiche d'un examen (admin) : badges, bande de
 * chiffres, carte « Suivi ». Fonctions pures, `now` en paramètre.
 */

export type DetailExam = AdminExam["exam"]

export const examQuestionsHref = (examId: string) =>
  `/admin/questions?examen=${examId}`

/** « Terminé » ou « Désactivé » : la bande montre le bilan, pas le suivi. */
const isSettled = (phase: ExamStatus) =>
  phase === "completed" || phase === "inactive"

/** « 230 questions », ou « 140 / 230 questions » tant que le jeu se compose. */
export const questionsBadge = (exam: DetailExam): string =>
  exam.finalizedAt === null
    ? `${exam.questionCount} / ${exam.targetQuestionCount} questions`
    : countLabel(exam.questionCount, "question", "questions")

/** Durée fixée à la finalisation, ou estimée sur le nombre visé avant. */
export const durationBadge = (exam: DetailExam): string =>
  exam.completionTime === null
    ? `${formatShortDuration(exam.targetQuestionCount * SECONDS_PER_QUESTION * 1000)} (estimée)`
    : formatShortDuration(exam.completionTime * 1000)

export const pauseBadge = (exam: DetailExam): string =>
  exam.enablePause && exam.pauseDurationMinutes
    ? `pause ${exam.pauseDurationMinutes}${NBSP}min`
    : "sans pause"

export const audienceBadge = (exam: DetailExam): string =>
  exam.audienceType === "restricted" ? "Audience restreinte" : "Abonnés Examens"

const passRate = (figures: ExamFigures): string => {
  if (figures.submitted === 0) return "—"
  const percent = Math.floor((figures.passed / figures.submitted) * 100)
  return `${formatCount(figures.passed)} / ${formatCount(figures.submitted)} · ${percent}${NBSP}%`
}

/** Bande de chiffres : bilan d'un examen clos, suivi d'un examen ouvert. */
export const statItems = (
  phase: ExamStatus,
  figures: ExamFigures,
  audienceType: DetailExam["audienceType"],
): StatBandItem[] =>
  isSettled(phase)
    ? [
        { label: "Participants", value: formatCount(figures.submitted) },
        { label: "Score moyen", value: formatScore(figures.average) },
        { label: "Meilleur score", value: formatScore(figures.best) },
        {
          label: `Réussite (≥${NBSP}${PASS_THRESHOLD}${NBSP}%)`,
          value: passRate(figures),
        },
      ]
    : [
        { label: "Ont commencé", value: formatCount(figures.started) },
        { label: "Soumis", value: formatCount(figures.submitted) },
        { label: "En cours", value: formatCount(figures.inProgress) },
        {
          label: "Éligibles",
          value:
            audienceType === "restricted"
              ? countLabel(figures.eligible, "invité", "invités")
              : formatCount(figures.eligible),
        },
      ]

const atClock = (instant: number) =>
  `${formatDayMonth(instant)} à ${formatClockTime(instant)}`

export type Tracking = {
  title: string
  description: string
  /** « Finaliser » : en préparation, sauf en retard (l'alerte le porte déjà). */
  finalize: boolean
  /** Barre « N soumis sur M commencés » d'un examen en cours. */
  progress: { submitted: number; started: number } | null
}

/** Carte « Suivi », tant que l'examen n'est ni terminé ni désactivé. */
export const tracking = (
  exam: DetailExam,
  phase: ExamStatus,
  figures: ExamFigures,
  now: number,
): Tracking | null => {
  if (phase === "preparation") {
    const missing = exam.targetQuestionCount - exam.questionCount
    return {
      title: "En préparation",
      description: `Un examen en préparation ne s'ouvre pas, même à sa date d'ouverture.${
        missing > 0
          ? ` Il reste ${countLabel(missing, "question", "questions")} à choisir.`
          : " Le jeu de questions est complet : il reste à le finaliser."
      }`,
      finalize: !isLateToOpen(exam, now),
      progress: null,
    }
  }
  if (phase === "upcoming" && exam.startDate !== null) {
    return {
      title: "L'examen n'est pas encore ouvert",
      description: `Ouverture le ${atClock(exam.startDate)}. Vérifiez le jeu de questions avant cette date.`,
      finalize: false,
      progress: null,
    }
  }
  if (phase === "active" && exam.endDate !== null) {
    return {
      title: "Examen en cours",
      description: `Les participations restées ouvertes seront fermées automatiquement le ${atClock(exam.endDate)}.`,
      finalize: false,
      progress: { submitted: figures.submitted, started: figures.started },
    }
  }
  return null
}

/**
 * Rangs du classement sur sa population (`CONTEXT.md`) : une copie d'un compte
 * admin ou supprimé reste listée, sans rang, comme dans les chiffres de la
 * fiche et le classement étudiant.
 */
export const populationRanks = (
  leaderboard: readonly { user: { flag: LeaderboardFlag | null } | null }[],
): (number | null)[] => {
  let rank = 0
  return leaderboard.map((entry) =>
    entry.user && entry.user.flag === null ? ++rank : null,
  )
}

export const rankOf = (
  leaderboard: readonly {
    user: { id: string; flag: LeaderboardFlag | null } | null
  }[],
  userId: string,
): { rank: number; total: number } | null => {
  const ranks = populationRanks(leaderboard)
  const rank = ranks[leaderboard.findIndex((e) => e.user?.id === userId)]
  if (rank === undefined || rank === null) return null
  return { rank, total: ranks.filter((r) => r !== null).length }
}
