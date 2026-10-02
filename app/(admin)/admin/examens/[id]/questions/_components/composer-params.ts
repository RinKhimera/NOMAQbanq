import type { BankFilters } from "@/features/questions/dal"
import { keyForParam } from "@/lib/url-param"
import { NOT_USED_SINCE_MAX } from "../../../../questions/_components/question-params"

// Module pur : l'état de la banque du compositeur vit dans l'URL, lu par la
// page serveur et réécrit par l'écran client. `retour` dit où ramènent le fil
// d'Ariane et « Terminé ».

export type BankSort = BankFilters["sortBy"]
export type ComposerReturn = "fiche" | "formulaire"

export type ComposerState = {
  q: string
  domain: string
  /** Pas utilisée depuis K examens ; `null` = toutes. */
  since: number | null
  sort: BankSort
  page: number
  back: ComposerReturn
}

export const DEFAULT_COMPOSER: ComposerState = {
  q: "",
  domain: "",
  since: null,
  sort: "lastUse",
  page: 1,
  back: "formulaire",
}

const SORT_PARAM: Record<BankSort, string | null> = {
  lastUse: null,
  domain: "domaine",
  successRate: "reussite",
}

export const SORT_LABEL: Record<BankSort, string> = {
  lastUse: "Tri : dernière utilisation",
  domain: "Tri : domaine",
  successRate: "Tri : réussite",
}

const positiveInt = (raw: string | null) => {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

export const parseComposer = (params: URLSearchParams): ComposerState => {
  const since = positiveInt(params.get("depuis"))
  return {
    q: params.get("q")?.trim() ?? "",
    domain: params.get("domaine")?.trim() ?? "",
    since: since === null ? null : Math.min(since, NOT_USED_SINCE_MAX),
    sort: keyForParam(SORT_PARAM, params.get("tri")) ?? "lastUse",
    page: positiveInt(params.get("page")) ?? 1,
    back: params.get("retour") === "fiche" ? "fiche" : "formulaire",
  }
}

export const serializeComposer = (s: ComposerState): URLSearchParams => {
  const p = new URLSearchParams()
  if (s.q.trim()) p.set("q", s.q.trim())
  if (s.domain) p.set("domaine", s.domain)
  if (s.since !== null) p.set("depuis", String(s.since))
  const sort = SORT_PARAM[s.sort]
  if (sort) p.set("tri", sort)
  if (s.page > 1) p.set("page", String(s.page))
  p.set("retour", s.back)
  return p
}

/** Un changement de recherche, de filtre ou de tri ramène en page 1. */
export const withChange = (
  s: ComposerState,
  change: Partial<Omit<ComposerState, "page" | "back">>,
): ComposerState => ({ ...s, ...change, page: 1 })

/** Filtres effacés ; le tri et le retour restent. */
export const cleared = (s: ComposerState): ComposerState => ({
  ...DEFAULT_COMPOSER,
  sort: s.sort,
  back: s.back,
})

/** Les filtres lus par `getExamBank`. */
export const toBankFilters = (s: ComposerState): BankFilters => ({
  search: s.q || undefined,
  domain: s.domain || undefined,
  notUsedInLast: s.since ?? undefined,
  sortBy: s.sort,
  page: s.page,
})

/** La page d'où l'on vient : fiche de l'examen ou formulaire. */
export const returnHref = (examId: string, back: ComposerReturn) =>
  back === "fiche"
    ? `/admin/examens/${examId}`
    : `/admin/examens/modifier/${examId}`
