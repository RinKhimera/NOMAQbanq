import type { UserSegment, UsersFilters } from "@/features/users/dal"
import {
  shiftCalendarDay,
  startOfAppZoneMonth,
  toAppZoneCalendarDay,
} from "@/lib/app-zone"
import { keyForParam } from "@/lib/url-param"

// Module pur : l'état de la liste des utilisateurs vit dans l'URL, lu par la
// page serveur et réécrit par l'écran client.

export type UserSort = "name" | "createdAt" | "lastLogin"
export type UserPeriod = "all" | "month" | "30" | "90" | "custom"

export type UserListState = {
  q: string
  role: "all" | "user" | "admin"
  period: UserPeriod
  from: string
  to: string
  suspended: boolean
  segment: UserSegment
  sort: UserSort
  order: "asc" | "desc"
  page: number
}

export const DEFAULT_USER_LIST: UserListState = {
  q: "",
  role: "all",
  period: "all",
  from: "",
  to: "",
  suspended: false,
  segment: "all",
  sort: "createdAt",
  order: "desc",
  page: 1,
}

const SEGMENT_PARAM: Record<UserSegment, string | null> = {
  all: null,
  active: "actif",
  expiring: "bientot",
  expired: "expire",
  never: "jamais",
}
const ROLE_PARAM = { all: null, user: "etudiants", admin: "administrateurs" }
const PERIOD_PARAM: Record<UserPeriod, string | null> = {
  all: null,
  month: "mois",
  "30": "30j",
  "90": "90j",
  custom: "dates",
}
const SORT_PARAM: Record<UserSort, string> = {
  name: "nom",
  createdAt: "inscription",
  lastLogin: "connexion",
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const parseUserList = (params: URLSearchParams): UserListState => {
  const page = Number(params.get("page"))
  return {
    q: params.get("q")?.trim() ?? "",
    role: keyForParam(ROLE_PARAM, params.get("role")) ?? "all",
    period: keyForParam(PERIOD_PARAM, params.get("periode")) ?? "all",
    from: DAY_PATTERN.test(params.get("du") ?? "") ? params.get("du")! : "",
    to: DAY_PATTERN.test(params.get("au") ?? "") ? params.get("au")! : "",
    suspended: params.get("suspendus") === "1",
    segment: keyForParam(SEGMENT_PARAM, params.get("segment")) ?? "all",
    sort: keyForParam(SORT_PARAM, params.get("tri")) ?? "createdAt",
    order: params.get("ordre") === "asc" ? "asc" : "desc",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  }
}

export const serializeUserList = (s: UserListState): URLSearchParams => {
  const p = new URLSearchParams()
  if (s.q.trim()) p.set("q", s.q.trim())
  const role = ROLE_PARAM[s.role]
  if (role) p.set("role", role)
  const period = PERIOD_PARAM[s.period]
  if (period) p.set("periode", period)
  if (s.period === "custom") {
    if (s.from) p.set("du", s.from)
    if (s.to) p.set("au", s.to)
  }
  if (s.suspended) p.set("suspendus", "1")
  const segment = SEGMENT_PARAM[s.segment]
  if (segment) p.set("segment", segment)
  if (s.sort !== "createdAt" || s.order !== "desc") {
    p.set("tri", SORT_PARAM[s.sort])
    p.set("ordre", s.order)
  }
  if (s.page > 1) p.set("page", String(s.page))
  return p
}

/** Un changement de recherche, de segment ou de filtre ramène en page 1. */
export const withChange = (
  s: UserListState,
  change: Partial<Omit<UserListState, "page">>,
): UserListState => ({ ...s, ...change, page: 1 })

/** Première journée d'inscription (`YYYY-MM-DD`, heure de l'Est) de chaque période. */
const PERIOD_START: Record<
  UserPeriod,
  (s: UserListState, today: string, now: number) => string | undefined
> = {
  all: () => undefined,
  month: (_s, _today, now) =>
    toAppZoneCalendarDay(startOfAppZoneMonth(new Date(now))),
  "30": (_s, today) => shiftCalendarDay(today, -30),
  "90": (_s, today) => shiftCalendarDay(today, -90),
  custom: (s) => s.from || undefined,
}

/** Les filtres lus par la DAL ; les périodes deviennent des journées de l'Est. */
export const toUsersFilters = (s: UserListState, now: number): UsersFilters => {
  const today = toAppZoneCalendarDay(now)
  const from = PERIOD_START[s.period](s, today, now)
  return {
    search: s.q || undefined,
    role: s.role === "all" ? undefined : s.role,
    segment: s.segment,
    suspended: s.suspended || undefined,
    dateFrom: from,
    dateTo: s.period === "custom" ? s.to || undefined : undefined,
  }
}

/** Au moins un filtre au-delà du tri : « Effacer » s'affiche. */
export const isFiltered = (s: UserListState) =>
  Boolean(s.q) ||
  s.role !== "all" ||
  s.period !== "all" ||
  s.suspended ||
  s.segment !== "all"
