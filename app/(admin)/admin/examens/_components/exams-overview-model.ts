import type { AdminExamOverviewItem } from "@/features/exams/dal"
import { adminPhaseOf } from "@/lib/exam-phase"
import type { ExamStatus } from "@/lib/exam-status"
import { NBSP } from "@/lib/format"

export type OverviewExam = AdminExamOverviewItem & { phase: ExamStatus }

export type OverviewSections = {
  live: OverviewExam[]
  toPrepare: OverviewExam[]
  finished: OverviewExam[]
}

/** Terminés affichés avant « Afficher les N examens terminés ». */
export const RECENT_FINISHED = 5

const byStartAsc = (a: OverviewExam, b: OverviewExam) => {
  if (a.startDate === b.startDate) return 0
  if (a.startDate === null) return 1
  if (b.startDate === null) return -1
  return a.startDate - b.startDate
}

const byStartDesc = (a: OverviewExam, b: OverviewExam) => {
  if (a.startDate === b.startDate) return 0
  if (a.startDate === null) return 1
  if (b.startDate === null) return -1
  return b.startDate - a.startDate
}

/**
 * Range les examens par section : « À préparer » par ouverture la plus proche
 * (sans dates à la fin), « Terminés » du plus récent au plus ancien.
 */
export const overviewSections = (
  exams: readonly AdminExamOverviewItem[],
  now: number,
): OverviewSections => {
  const out: OverviewSections = { live: [], toPrepare: [], finished: [] }
  for (const exam of exams) {
    const item = { ...exam, phase: adminPhaseOf(exam, now) }
    if (item.phase === "active") out.live.push(item)
    else if (item.phase === "upcoming" || item.phase === "preparation")
      out.toPrepare.push(item)
    else out.finished.push(item)
  }
  out.live.sort(byStartAsc)
  out.toPrepare.sort(byStartAsc)
  out.finished.sort(byStartDesc)
  return out
}

/** Moyenne des moyennes des derniers terminés qui en ont une ; `null` sinon. */
export const recentAverage = (finished: readonly OverviewExam[]) => {
  const averages = finished
    .slice(0, RECENT_FINISHED)
    .map((e) => e.figures.average)
    .filter((a): a is number => a !== null)
  if (averages.length === 0) return null
  // Au plancher, comme les moyennes de la DAL : 59,5 ne s'affiche pas 60 %.
  return {
    value: Math.floor(averages.reduce((s, a) => s + a, 0) / averages.length),
    count: averages.length,
  }
}

/** Part des soumises au seuil de réussite, « — » sans participation soumise. */
export const passRateLabel = ({
  passed,
  submitted,
}: {
  passed: number
  submitted: number
}) =>
  submitted === 0 ? "—" : `${Math.floor((passed / submitted) * 100)}${NBSP}%`

/** Part des participations commencées déjà soumises (0 sans participation). */
export const submittedPercent = ({
  started,
  submitted,
}: {
  started: number
  submitted: number
}) => (started === 0 ? 0 : Math.round((submitted / started) * 100))

/** « dans 3 j », « aujourd'hui ». */
export const inDaysLabel = (days: number) =>
  days <= 0 ? "aujourd'hui" : `dans ${days}${NBSP}j`
