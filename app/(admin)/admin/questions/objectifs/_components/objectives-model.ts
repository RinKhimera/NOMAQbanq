// Module pur : l'état de l'écran « Objectifs du CMC » dans l'URL et ses
// filtres. Les groupes, les onglets et la progression viennent de
// `features/objectives/groups.ts`.
import type {
  ObjectiveEntryView,
  ObjectiveGroup,
} from "@/features/objectives/groups"
import { foldForSearch } from "@/lib/search"

export type ObjectivesTab = "todo" | "done"

export type ObjectivesState = { tab: ObjectivesTab; domain: string }

export const parseObjectivesState = (
  params: URLSearchParams,
): ObjectivesState => ({
  tab: params.get("onglet") === "traites" ? "done" : "todo",
  domain: params.get("domaine")?.trim() ?? "",
})

export const serializeObjectivesState = (s: ObjectivesState) => {
  const p = new URLSearchParams()
  if (s.tab === "done") p.set("onglet", "traites")
  if (s.domain) p.set("domaine", s.domain)
  return p
}

/** Un groupe, une valeur ou un objectif est montré s'il touche le domaine choisi. */
export const touchesDomain = (domains: readonly string[], domain: string) =>
  !domain || domains.includes(domain)

export const groupDomains = (entries: readonly ObjectiveEntryView[]) =>
  [...new Set(entries.flatMap((e) => e.domains))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  )

export const visibleGroups = (
  groups: readonly ObjectiveGroup[],
  domain: string,
) => groups.filter((g) => touchesDomain(g.domains, domain))

/** Valeurs proposées au rattachement : au-delà, la recherche doit les affiner. */
export const ATTACH_LIMIT = 50

/** Objectifs rattachables à un groupe : hors de sa sélection, recherchés. */
export const attachCandidates = (
  entries: readonly ObjectiveEntryView[],
  selectedIds: readonly string[],
  search: string,
) => {
  const term = foldForSearch(search)
  return entries.filter(
    (e) =>
      !e.needsFix &&
      !selectedIds.includes(e.id) &&
      (!term || foldForSearch(e.label).includes(term)),
  )
}

/** Libellé de la question dans le volet de correction : l'énoncé sur une ligne. */
export const oneLine = (text: string) => text.replace(/\s+/g, " ").trim()

export const questionsLabel = (n: number) =>
  `${n.toLocaleString("fr-CA")} question${n > 1 ? "s" : ""}`
