import type {
  QuestionFiltersInput,
  QuestionSortBy,
} from "@/features/questions/dal"
import { QUESTIONS_PAGE_SIZE } from "@/features/questions/page-size"
import { keyForParam } from "@/lib/url-param"

// Module pur : l'état de la liste des questions vit dans l'URL, lu par la
// page serveur (liste et détail) et réécrit par l'écran client. Le détail et
// le formulaire le portent aussi, pour rendre la liste telle qu'on l'a
// quittée.

export type QuestionTab = "all" | "toVerify" | "noReferences"
export type ImageFilter = "all" | "with" | "without"

export type QuestionListState = {
  q: string
  tab: QuestionTab
  domain: string
  objective: string
  images: ImageFilter
  /** Pas utilisée depuis N examens ; `null` = toutes. */
  notUsedSince: number | null
  exam: string
  sort: QuestionSortBy
  order: "asc" | "desc"
  page: number
}

export const DEFAULT_QUESTION_LIST: QuestionListState = {
  q: "",
  tab: "all",
  domain: "",
  objective: "",
  images: "all",
  notUsedSince: null,
  exam: "",
  sort: "createdAt",
  order: "desc",
  page: 1,
}

export const NOT_USED_SINCE_MAX = 20

const TAB_PARAM: Record<QuestionTab, string | null> = {
  all: null,
  toVerify: "cle-a-verifier",
  noReferences: "sans-references",
}
const IMAGES_PARAM: Record<ImageFilter, string | null> = {
  all: null,
  with: "avec",
  without: "sans",
}
const SORT_PARAM: Record<QuestionSortBy, string> = {
  createdAt: "creation",
  updatedAt: "modification",
  successRate: "reussite",
  answerCount: "reponses",
}

/** Sens d'un tri qu'on active : les moins réussies d'abord, sinon les plus grandes valeurs. */
export const FIRST_ORDER: Record<QuestionSortBy, "asc" | "desc"> = {
  createdAt: "desc",
  updatedAt: "desc",
  successRate: "asc",
  answerCount: "desc",
}

const positiveInt = (raw: string | null) => {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

export const parseQuestionList = (
  params: URLSearchParams,
): QuestionListState => {
  const sort = keyForParam(SORT_PARAM, params.get("tri")) ?? "createdAt"
  const order = params.get("ordre")
  const since = positiveInt(params.get("depuis"))
  const domain = params.get("domaine")?.trim() ?? ""
  return {
    q: params.get("q")?.trim() ?? "",
    tab: keyForParam(TAB_PARAM, params.get("onglet")) ?? "all",
    domain,
    // Un objectif n'a de sens que dans son domaine.
    objective: domain ? (params.get("objectif")?.trim() ?? "") : "",
    images: keyForParam(IMAGES_PARAM, params.get("images")) ?? "all",
    notUsedSince: since === null ? null : Math.min(since, NOT_USED_SINCE_MAX),
    exam: params.get("examen")?.trim() ?? "",
    sort,
    order: order === "asc" || order === "desc" ? order : FIRST_ORDER[sort],
    page: positiveInt(params.get("page")) ?? 1,
  }
}

export const serializeQuestionList = (
  s: QuestionListState,
): URLSearchParams => {
  const p = new URLSearchParams()
  if (s.q.trim()) p.set("q", s.q.trim())
  const tab = TAB_PARAM[s.tab]
  if (tab) p.set("onglet", tab)
  if (s.domain) p.set("domaine", s.domain)
  if (s.domain && s.objective) p.set("objectif", s.objective)
  const images = IMAGES_PARAM[s.images]
  if (images) p.set("images", images)
  if (s.notUsedSince !== null) p.set("depuis", String(s.notUsedSince))
  if (s.exam) p.set("examen", s.exam)
  if (s.sort !== "createdAt" || s.order !== "desc") {
    p.set("tri", SORT_PARAM[s.sort])
    p.set("ordre", s.order)
  }
  if (s.page > 1) p.set("page", String(s.page))
  return p
}

/** Les paramètres d'URL d'une page serveur (`searchParams`), valeurs multiples ignorées. */
export const toSearchParams = (
  raw: Record<string, string | string[] | undefined>,
) =>
  new URLSearchParams(
    Object.entries(raw).flatMap(([k, v]) =>
      typeof v === "string" ? [[k, v]] : [],
    ),
  )

/** Un changement de recherche, d'onglet, de filtre ou de tri ramène en page 1. */
export const withChange = (
  s: QuestionListState,
  change: Partial<Omit<QuestionListState, "page">>,
): QuestionListState => {
  const next = { ...s, ...change, page: 1 }
  if (change.domain !== undefined && change.domain !== s.domain)
    next.objective = ""
  return next
}

/** Nombre de filtres du panneau « Filtres » actifs. */
export const panelFilterCount = (s: QuestionListState) =>
  Number(s.images !== "all") +
  Number(s.notUsedSince !== null) +
  Number(s.exam !== "") +
  Number(s.objective !== "")

/** Les filtres lus par la DAL. */
export const toQuestionFilters = (
  s: QuestionListState,
): QuestionFiltersInput => ({
  search: s.q || undefined,
  domain: s.domain || undefined,
  objective: s.objective || undefined,
  hasImages: s.images === "all" ? undefined : s.images === "with",
  usedInExamId: s.exam || undefined,
  notUsedInLast: s.notUsedSince ?? undefined,
  toVerify: s.tab === "toVerify" || undefined,
  noReferences: s.tab === "noReferences" || undefined,
  sortBy: s.sort,
  sortOrder: s.order,
  page: s.page,
  limit: QUESTIONS_PAGE_SIZE,
})

const withQuery = (path: string, params: URLSearchParams) =>
  params.size ? `${path}?${params}` : path

export const questionListHref = (s: QuestionListState) =>
  withQuery("/admin/questions", serializeQuestionList(s))

/** Le détail d'une question, qui garde la liste d'où l'on vient. */
export const questionHref = (id: string, s: QuestionListState) =>
  withQuery(`/admin/questions/${id}`, serializeQuestionList(s))

export const questionEditHref = (id: string, s: QuestionListState) =>
  withQuery(`/admin/questions/${id}/modifier`, serializeQuestionList(s))

/** Page de la liste qui contient la ligne `position` (1-based). */
export const pageOfPosition = (position: number) =>
  Math.floor((position - 1) / QUESTIONS_PAGE_SIZE) + 1
