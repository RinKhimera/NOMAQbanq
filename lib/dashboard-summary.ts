import type { DashboardPeriod } from "@/lib/dashboard-period"

/** Sous ce nombre de questions comptées, une maîtrise n'est pas significative. */
export const MASTERY_MIN_ANSWERED = 5

type Mastery = { domain: string; answered: number; mastery: number | null }

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

const trendSentence = (
  period: DashboardPeriod,
  trend: number | null,
): string | null => {
  if (trend === null || period === "tout") return null
  const span = PERIOD_LABEL[period]
  if (trend > 0)
    return `Votre score moyen a progressé de ${points(trend)} sur ${span}.`
  if (trend < 0)
    return `Votre score moyen a reculé de ${points(-trend)} sur ${span}.`
  return `Votre score moyen est stable sur ${span}.`
}

/** Phrase de synthèse sous le salut du tableau de bord. */
export const dashboardSummary = ({
  period,
  trend,
  weakest,
}: {
  period: DashboardPeriod
  trend: number | null
  weakest: string | null
}): string => {
  const sentences = [
    trendSentence(period, trend),
    weakest && `${weakest} reste votre domaine le plus faible.`,
  ].filter(Boolean)
  return sentences.length > 0
    ? sentences.join(" ")
    : "Suivez ici vos scores, vos séries et votre maîtrise par domaine."
}
