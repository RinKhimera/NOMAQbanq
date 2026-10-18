import type {
  StudentAccess,
  StudentProgressFilters,
  StudentProgressSort,
} from "@/features/analytics/dal.admin-progression"
import { ADMIN_PROGRESSION_HREF } from "@/lib/admin-links"
import {
  DEFAULT_PERIOD,
  type DashboardPeriod,
  PERIOD_PARAM,
  parsePeriod,
} from "@/lib/dashboard-period"
import { keyForParam, positiveIntParam } from "@/lib/url-param"

// Module pur : l'état du tableau de suivi vit dans l'URL, lu par les pages
// serveur (tableau et détail) et réécrit par l'écran client.

export type ProgressionListState = {
  q: string
  access: "all" | StudentAccess
  activeOnly: boolean
  period: DashboardPeriod
  sort: StudentProgressSort
  order: "asc" | "desc"
  page: number
}

export const DEFAULT_PROGRESSION_LIST: ProgressionListState = {
  q: "",
  access: "all",
  activeOnly: false,
  period: DEFAULT_PERIOD,
  sort: "lastActivity",
  order: "desc",
  page: 1,
}

/**
 * Posé par le tableau sur le lien d'un étudiant : sans lui (fiche, lien
 * direct), le détail est « Hors de la liste filtrée », même si les autres
 * paramètres valent ceux par défaut.
 */
export const FROM_LIST_PARAM = "liste"

const ACCESS_PARAM: Record<ProgressionListState["access"], string | null> = {
  all: null,
  active: "actif",
  expired: "expire",
  none: "aucun",
}
const SORT_PARAM: Record<StudentProgressSort, string> = {
  lastActivity: "activite",
  score: "score",
  passed: "reussis",
  questions: "questions",
  days: "jours",
}

export const parseProgressionList = (
  params: URLSearchParams,
): ProgressionListState => ({
  q: params.get("q")?.trim() ?? "",
  access: keyForParam(ACCESS_PARAM, params.get("acces")) ?? "all",
  activeOnly: params.get("actifs") === "1",
  period: parsePeriod(params.get(PERIOD_PARAM) ?? undefined),
  sort: keyForParam(SORT_PARAM, params.get("tri")) ?? "lastActivity",
  order: params.get("ordre") === "asc" ? "asc" : "desc",
  page: positiveIntParam(params.get("page")) ?? 1,
})

export const serializeProgressionList = (
  s: ProgressionListState,
): URLSearchParams => {
  const p = new URLSearchParams()
  if (s.q.trim()) p.set("q", s.q.trim())
  const access = ACCESS_PARAM[s.access]
  if (access) p.set("acces", access)
  if (s.activeOnly) p.set("actifs", "1")
  if (s.period !== DEFAULT_PERIOD) p.set(PERIOD_PARAM, s.period)
  if (s.sort !== "lastActivity" || s.order !== "desc") {
    p.set("tri", SORT_PARAM[s.sort])
    p.set("ordre", s.order)
  }
  if (s.page > 1) p.set("page", String(s.page))
  return p
}

/** Les paramètres d'URL d'une page serveur, valeurs multiples ignorées. */
export const toSearchParams = (
  raw: Record<string, string | string[] | undefined>,
) =>
  new URLSearchParams(
    Object.entries(raw).flatMap(([k, v]) =>
      typeof v === "string" ? [[k, v]] : [],
    ),
  )

/** Un changement de recherche, de filtre, de période ou de tri ramène en page 1. */
export const withChange = (
  s: ProgressionListState,
  change: Partial<Omit<ProgressionListState, "page">>,
): ProgressionListState => ({ ...s, ...change, page: 1 })

/** Au moins un filtre : « Effacer » s'affiche. La période n'en est pas un. */
export const isFiltered = (s: ProgressionListState) =>
  Boolean(s.q) || s.access !== "all" || s.activeOnly

/** Filtres effacés, période et tri conservés. */
export const cleared = (s: ProgressionListState): ProgressionListState => ({
  ...s,
  q: "",
  access: "all",
  activeOnly: false,
  page: 1,
})

/** Les filtres lus par la DAL. */
export const toProgressFilters = (
  s: ProgressionListState,
): StudentProgressFilters => ({
  search: s.q || undefined,
  access: s.access === "all" ? undefined : s.access,
  activeOnly: s.activeOnly || undefined,
  period: s.period,
  sortBy: s.sort,
  sortOrder: s.order,
})

const withQuery = (path: string, params: URLSearchParams) =>
  params.size ? `${path}?${params}` : path

export const progressionListHref = (s: ProgressionListState) =>
  withQuery(ADMIN_PROGRESSION_HREF, serializeProgressionList(s))

/** La progression d'un étudiant, qui garde le tableau d'où l'on vient. */
export const studentProgressHref = (id: string, s: ProgressionListState) => {
  const params = serializeProgressionList(s)
  params.set(FROM_LIST_PARAM, "1")
  return withQuery(`${ADMIN_PROGRESSION_HREF}/${id}`, params)
}
