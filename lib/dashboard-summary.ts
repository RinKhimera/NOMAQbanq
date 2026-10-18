import type { DashboardPeriod } from "@/lib/dashboard-period"

/** Sous ce nombre de questions comptées, une maîtrise n'est pas significative. */
export const MASTERY_MIN_ANSWERED = 5

type Mastery = { domain: string; answered: number; mastery: number | null }

const tier = (d: Mastery) => (d.answered < MASTERY_MIN_ANSWERED ? 1 : 0)

/**
 * Tri « plus faibles d'abord » : domaines significatifs, puis peu pratiqués —
 * pour qu'un 0 / 2 ne passe pas pour la pire lacune —, puis maîtrise
 * croissante et ordre alphabétique.
 */
export const byWeakness = (a: Mastery, b: Mastery): number =>
  tier(a) - tier(b) ||
  (a.mastery ?? 0) - (b.mastery ?? 0) ||
  a.domain.localeCompare(b.domain, "fr")

/**
 * Domaine le moins maîtrisé parmi ceux qui ont assez de réponses : un 0 / 2
 * ne doit pas passer pour la pire lacune. Égalité départagée par l'ordre
 * alphabétique, pour une phrase stable d'une visite à l'autre.
 */
export const weakestDomain = (domains: readonly Mastery[]): string | null =>
  domains
    .filter(
      (d): d is Mastery & { mastery: number } =>
        d.mastery !== null && d.answered >= MASTERY_MIN_ANSWERED,
    )
    .toSorted(
      (a, b) => a.mastery - b.mastery || a.domain.localeCompare(b.domain, "fr"),
    )[0]?.domain ?? null

const PERIOD_LABEL: Record<Exclude<DashboardPeriod, "tout">, string> = {
  "7": "7 jours",
  "30": "30 jours",
}

const points = (n: number) => `${n} point${n > 1 ? "s" : ""}`

/** Qui lit : l'étudiant lui-même, ou un admin qui regarde sa progression. */
export type SummaryPerson = "you" | "they"

const WORDS: Record<
  SummaryPerson,
  { score: string; domain: string; fallback: string }
> = {
  you: {
    score: "Votre score moyen",
    domain: "votre domaine le plus faible",
    fallback:
      "Suivez ici vos scores, vos séries et votre maîtrise par domaine.",
  },
  they: {
    score: "Son score moyen",
    domain: "son domaine le plus faible",
    fallback: "Ses scores, ses séries et sa maîtrise par domaine.",
  },
}

const trendSentence = (
  period: DashboardPeriod,
  trend: number | null,
  score: string,
): string | null => {
  if (trend === null || period === "tout") return null
  const span = PERIOD_LABEL[period]
  if (trend > 0) return `${score} a progressé de ${points(trend)} sur ${span}.`
  if (trend < 0) return `${score} a reculé de ${points(-trend)} sur ${span}.`
  return `${score} est stable sur ${span}.`
}

/** Phrase de synthèse sous le salut du tableau de bord. */
export const dashboardSummary = ({
  period,
  trend,
  weakest,
  person = "you",
}: {
  period: DashboardPeriod
  trend: number | null
  weakest: string | null
  person?: SummaryPerson
}): string => {
  const words = WORDS[person]
  const sentences = [
    trendSentence(period, trend, words.score),
    weakest && `${weakest} reste ${words.domain}.`,
  ].filter(Boolean)
  return sentences.length > 0 ? sentences.join(" ") : words.fallback
}

/**
 * Variante « nouvel inscrit » du tableau de bord : rien à montrer, rien à
 * reprendre. Un examen commencé sans abonnement (audience restreinte) ou un
 * accès expiré, même jamais utilisé, gardent le tableau complet et ses alertes
 * (« Reprendre », « Réactiver »).
 */
export const isNewcomer = ({
  isAdmin,
  hasAccess,
  hasHistory,
  hasExamInProgress,
  hasLapsedAccess,
}: {
  isAdmin: boolean
  hasAccess: boolean
  hasHistory: boolean
  hasExamInProgress: boolean
  hasLapsedAccess: boolean
}): boolean =>
  !isAdmin &&
  !hasAccess &&
  !hasHistory &&
  !hasExamInProgress &&
  !hasLapsedAccess
