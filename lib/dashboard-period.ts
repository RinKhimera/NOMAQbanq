import {
  shiftCalendarDay,
  startOfAppZoneDay,
  toAppZoneCalendarDay,
} from "@/lib/app-zone"

/** Période du tableau de bord étudiant, portée par `?periode=` dans l'URL. */
export type DashboardPeriod = "7" | "30" | "tout"

export const DEFAULT_PERIOD: DashboardPeriod = "30"

export const PERIOD_PARAM = "periode"

const PERIODS: readonly DashboardPeriod[] = ["7", "30", "tout"]

const isPeriod = (value: unknown): value is DashboardPeriod =>
  PERIODS.includes(value as DashboardPeriod)

export const parsePeriod = (
  value: string | string[] | undefined,
): DashboardPeriod => (isPeriod(value) ? value : DEFAULT_PERIOD)

const PERIOD_DAYS: Record<Exclude<DashboardPeriod, "tout">, number> = {
  "7": 7,
  "30": 30,
}

export type PeriodWindow = {
  /** Premier instant de la période ; `null` = depuis toujours. */
  from: Date | null
  /** Premier instant de la période précédente de même durée (qui finit à `from`). */
  previousFrom: Date | null
}

/**
 * Bornes d'une période en journées civiles de l'Est, aujourd'hui compris :
 * « 7 jours » part de minuit il y a six jours. Des tranches de 24 h feraient
 * glisser la borne d'une heure aux changements d'heure, et d'un jour selon
 * l'heure du soir où l'on regarde.
 */
export const periodWindow = (
  period: DashboardPeriod,
  now: number,
): PeriodWindow => {
  if (period === "tout") return { from: null, previousFrom: null }
  const days = PERIOD_DAYS[period]
  const today = toAppZoneCalendarDay(now)
  return {
    from: startOfAppZoneDay(shiftCalendarDay(today, 1 - days)),
    previousFrom: startOfAppZoneDay(shiftCalendarDay(today, 1 - 2 * days)),
  }
}
