/**
 * Modèle pur de l'écran « Objectifs du CMC » : groupes de variantes, onglets
 * À traiter / Traités, progression et valeurs invalides. Client + serveur.
 */
import { objectiveKey, objectiveLabelProblems } from "./label"

export type ObjectiveEntryView = {
  id: string
  label: string
  needsFix: boolean
  /** Epoch ms ; `null` = pas encore revue. */
  reviewedAt: number | null
  questionCount: number
  domains: string[]
}

/** Entrées qui partagent une clé normalisée ; une entrée seule forme un groupe. */
export type ObjectiveGroup = {
  key: string
  /** Les plus utilisées d'abord. */
  entries: ObjectiveEntryView[]
  /** Au moins une entrée n'est pas revue. */
  pending: boolean
  questionCount: number
  domains: string[]
}

export type InvalidObjective = ObjectiveEntryView & { problems: string[] }

export type ObjectivesBoard = {
  pending: ObjectiveGroup[]
  /** Entrées revues, par libellé. */
  reviewed: ObjectiveEntryView[]
  progress: { done: number; total: number }
  /** Valeurs invalides encore utilisées par une question active. */
  invalid: InvalidObjective[]
}

const byUsage = (a: ObjectiveEntryView, b: ObjectiveEntryView) =>
  b.questionCount - a.questionCount || a.label.localeCompare(b.label, "fr")

const unionSorted = (lists: string[][]) =>
  [...new Set(lists.flat())].sort((a, b) => a.localeCompare(b, "fr"))

export const objectivesBoard = (
  entries: readonly ObjectiveEntryView[],
): ObjectivesBoard => {
  const byKey = new Map<string, ObjectiveEntryView[]>()
  for (const entry of entries) {
    if (entry.needsFix) continue
    const key = objectiveKey(entry.label)
    byKey.set(key, [...(byKey.get(key) ?? []), entry])
  }
  const groups: ObjectiveGroup[] = [...byKey].map(([key, list]) => {
    const sorted = [...list].sort(byUsage)
    return {
      key,
      entries: sorted,
      pending: sorted.some((e) => e.reviewedAt === null),
      questionCount: sorted.reduce((n, e) => n + e.questionCount, 0),
      domains: unionSorted(sorted.map((e) => e.domains)),
    }
  })
  const pending = groups
    .filter((g) => g.pending)
    .sort(
      (a, b) =>
        b.entries.length - a.entries.length ||
        b.questionCount - a.questionCount ||
        a.entries[0]!.label.localeCompare(b.entries[0]!.label, "fr"),
    )
  return {
    pending,
    reviewed: entries
      .filter((e) => !e.needsFix && e.reviewedAt !== null)
      .sort((a, b) => a.label.localeCompare(b.label, "fr")),
    progress: { done: groups.length - pending.length, total: groups.length },
    invalid: entries
      .filter((e) => e.needsFix && e.questionCount > 0)
      .sort(byUsage)
      .map((e) => ({ ...e, problems: objectiveLabelProblems(e.label) })),
  }
}
