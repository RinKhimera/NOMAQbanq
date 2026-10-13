import { ArrowRight, Stethoscope } from "lucide-react"
import Link from "next/link"
import { LinkPendingIndicator } from "@/components/shared/link-pending-indicator"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Progress } from "@/components/ui/progress"
import { PROGRESSION_HREF, trainingDomainUrl } from "@/constants"
import type { DomainMastery } from "@/features/analytics/dal"
import { MASTERY_MIN_ANSWERED, byWeakness } from "@/lib/dashboard-summary"
import { formatScore, scoreTone } from "@/lib/score"
import { TONE_COLOR } from "@/lib/tone"
import { cn } from "@/lib/utils"

const linkClass =
  "focus-ring hover:text-accent-ink rounded-xs underline-offset-4 hover:underline"

/** Domaines affichés : le tableau de bord résume, la page Progression détaille. */
export const WEAKEST_COUNT = 5

/**
 * Les domaines les plus faibles, puis le nombre de domaines jamais pratiqués
 * et le lien vers la page Progression. Toujours sur l'ensemble de
 * l'historique, quelle que soit la période choisie.
 */
export const DomainMasteryPanel = ({
  domains,
}: {
  domains: DomainMastery[]
}) => {
  const practiced = domains
    .filter((d) => d.mastery !== null)
    .toSorted(byWeakness)
  // Le détail des 22 domaines vit sur la page Progression.
  const weakest = practiced.slice(0, WEAKEST_COUNT)
  const unpracticedCount = domains.length - practiced.length

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
        {weakest.map((d) => {
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
      <div className="border-line flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        {unpracticedCount > 0 ? (
          <p
            data-testid="domain-mastery-unpracticed"
            className="text-ink-3 text-sm"
          >
            <span className="font-mono">{unpracticedCount}</span>{" "}
            {unpracticedCount > 1
              ? "domaines jamais pratiqués"
              : "domaine jamais pratiqué"}
          </p>
        ) : (
          <span />
        )}
        <Button asChild size="sm" variant="ghost" className="max-md:h-11">
          <Link href={PROGRESSION_HREF} prefetch={false}>
            Rapport complet
            <ArrowRight aria-hidden="true" />
            <LinkPendingIndicator />
          </Link>
        </Button>
      </div>
    </div>
  )
}
