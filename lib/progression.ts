import type { DashboardPeriod } from "@/lib/dashboard-period"
import { byWeakness } from "@/lib/dashboard-summary"

/** Participations par page de l'historique des examens blancs. */
export const EXAM_HISTORY_PAGE_SIZE = 10

/** Curseurs keyset de l'historique dans l'URL : page suivante, page précédente. */
export const AFTER_PARAM = "apres"
export const BEFORE_PARAM = "avant"

/** Tri du tableau « Résultats par domaine ». */
export type DomainSort = "weakest" | "trend" | "az"

type SortableDomain = {
  domain: string
  answered: number
  mastery: number | null
  trend: number | null
}

const byName = (a: { domain: string }, b: { domain: string }) =>
  a.domain.localeCompare(b.domain, "fr")

// Une tendance absente (domaine neuf sur la période) passe après les autres.
const byTrend = (a: SortableDomain, b: SortableDomain) =>
  (a.trend ?? Infinity) - (b.trend ?? Infinity) || byWeakness(a, b)

/**
 * Ordre des lignes : domaines pratiqués selon le tri choisi, puis les domaines
 * jamais pratiqués, par nom. Sur « Tout », il n'y a pas de tendance : le tri
 * « Tendance » retombe sur « Plus faibles ».
 */
export const sortDomains = <T extends SortableDomain>(
  domains: readonly T[],
  sort: DomainSort,
  period: DashboardPeriod,
): T[] => {
  const practiced = domains.filter((d) => d.mastery !== null)
  const never = domains.filter((d) => d.mastery === null).toSorted(byName)
  const effective = sort === "trend" && period === "tout" ? "weakest" : sort
  const compare =
    effective === "az" ? byName : effective === "trend" ? byTrend : byWeakness
  return [...practiced.toSorted(compare), ...never]
}

/** Part des questions actives déjà vues, à l'entier inférieur ; `null` sans question. */
export const coveragePercent = (
  covered: number,
  total: number,
): number | null => (total === 0 ? null : Math.floor((100 * covered) / total))

/** « +4 », « −2 », « 0 » ; « — » sans tendance. */
export const formatTrend = (trend: number | null): string => {
  if (trend === null) return "—"
  if (trend > 0) return `+${trend}`
  if (trend < 0) return `−${-trend}`
  return "0"
}

const PERIOD_EYEBROW: Record<DashboardPeriod, string> = {
  "7": "7 derniers jours",
  "30": "30 derniers jours",
  tout: "depuis l'inscription",
}

/** Libellé de période de l'en-tête. */
export const periodEyebrow = (period: DashboardPeriod): string =>
  `Rapport · ${PERIOD_EYEBROW[period]}`
