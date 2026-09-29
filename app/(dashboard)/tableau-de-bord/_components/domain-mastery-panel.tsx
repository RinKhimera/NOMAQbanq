import { Stethoscope } from "lucide-react"
import Link from "next/link"
import { LinkPendingIndicator } from "@/components/shared/link-pending-indicator"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Progress } from "@/components/ui/progress"
import { trainingDomainUrl } from "@/constants"
import type { DomainMastery } from "@/features/analytics/dal"
import { MASTERY_MIN_ANSWERED } from "@/lib/dashboard-summary"
import { formatScore, scoreTone } from "@/lib/score"
import { TONE_COLOR } from "@/lib/tone"
import { cn } from "@/lib/utils"

// Rang de tri : domaines significatifs, puis peu pratiqués — pour qu'un 0/2 ne
// passe pas pour la pire lacune.
const tierOf = (d: DomainMastery) => (d.answered < MASTERY_MIN_ANSWERED ? 1 : 0)

const byPriority = (a: DomainMastery, b: DomainMastery) =>
  tierOf(a) - tierOf(b) ||
  (a.mastery ?? 0) - (b.mastery ?? 0) ||
  a.domain.localeCompare(b.domain, "fr")

const linkClass =
  "focus-ring hover:text-accent-ink rounded-xs underline-offset-4 hover:underline"

/**
 * Maîtrise par domaine, domaines faibles en tête. Toujours sur l'ensemble de
 * l'historique, quelle que soit la période choisie.
 */
export const DomainMasteryPanel = ({
  domains,
}: {
  domains: DomainMastery[]
}) => {
  const practiced = domains
    .filter((d) => d.mastery !== null)
    .toSorted(byPriority)
  // Une ligne par domaine jamais pratiqué repousserait le reste du tableau de
  // bord de plus d'un écran : ils tiennent en pastilles.
  const unpracticed = domains
    .filter((d) => d.mastery === null)
    .toSorted((a, b) => a.domain.localeCompare(b.domain, "fr"))

  if (practiced.length === 0) {
    return (
      <EmptyState
        size="compact"
        icons={[Stethoscope]}
        title="Aucune réponse pour l'instant"
        description="Vos domaines forts et faibles apparaîtront ici dès vos premières réponses."
      >
        <Button asChild className="max-md:h-11">
          <Link href="/tableau-de-bord/entrainement" prefetch={false}>
            Commencer une série
            <LinkPendingIndicator className="ml-2" />
          </Link>
        </Button>
      </EmptyState>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-3.5">
        {practiced.map((d) => {
          const significant = d.answered >= MASTERY_MIN_ANSWERED
          const mastery = d.mastery ?? 0
          return (
            <li
              key={d.domain}
              data-testid="domain-mastery-row"
              data-domain={d.domain}
              data-significant={String(significant)}
              className="grid grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)_3rem] items-center gap-4 max-[480px]:grid-cols-[minmax(0,1fr)_2.75rem] max-md:grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_2.75rem] max-md:gap-2.5"
            >
              <Link
                href={trainingDomainUrl(d.domain)}
                prefetch={false}
                className={cn(
                  "text-ink flex min-w-0 items-center gap-1.5 text-sm max-md:min-h-11",
                  linkClass,
                )}
              >
                <span className="truncate">
                  <span className="sr-only">Réviser </span>
                  {d.domain}
                </span>
                <LinkPendingIndicator />
              </Link>
              <Progress
                value={mastery}
                indicatorColor={
                  significant
                    ? TONE_COLOR[scoreTone(mastery)]
                    : TONE_COLOR.neutral
                }
                className="h-1.5 max-[480px]:col-span-2 max-[480px]:row-start-2"
                aria-label={`Maîtrise en ${d.domain}`}
              />
              <span className="text-ink-2 text-right font-mono text-[0.8125rem] max-[480px]:col-start-2 max-[480px]:row-start-1">
                {formatScore(mastery)}
              </span>
              {!significant && (
                <p className="text-ink-3 col-span-full -mt-2 text-xs">
                  Sur {d.answered} question{d.answered > 1 ? "s" : ""} · peu de
                  données
                </p>
              )}
            </li>
          )
        })}
      </ul>
      {unpracticed.length > 0 && (
        <div
          data-testid="domain-mastery-unpracticed"
          className="border-line border-t pt-4"
        >
          <p className="text-ink-3 mb-2 text-xs">
            Pas encore pratiqués ({unpracticed.length})
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {unpracticed.map((d) => (
              <li key={d.domain}>
                <Link
                  href={trainingDomainUrl(d.domain)}
                  prefetch={false}
                  className="focus-ring border-line text-ink-2 hover:bg-surface-2 inline-flex min-h-8 items-center gap-1 rounded-xs border px-2.5 text-xs transition-[background-color] max-md:min-h-11"
                >
                  <span className="sr-only">Réviser </span>
                  {d.domain}
                  <LinkPendingIndicator />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
