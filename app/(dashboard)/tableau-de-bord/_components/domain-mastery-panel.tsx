"use client"

import { ChevronRight, Stethoscope } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { LinkPendingIndicator } from "@/components/shared/link-pending-indicator"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { trainingDomainUrl } from "@/constants"
import type { DomainMastery } from "@/features/analytics/dal"
import { cn } from "@/lib/utils"

/** Sous ce nombre de questions comptées, une maîtrise n'est pas significative. */
const MASTERY_MIN_ANSWERED = 5

// Rang de tri : domaines significatifs, puis peu pratiqués, puis jamais
// pratiqués — pour qu'un 0/2 ne passe pas pour la pire lacune.
const tierOf = (d: DomainMastery) =>
  d.mastery === null ? 2 : d.answered < MASTERY_MIN_ANSWERED ? 1 : 0

const byPriority = (a: DomainMastery, b: DomainMastery) =>
  tierOf(a) - tierOf(b) ||
  (a.mastery ?? 0) - (b.mastery ?? 0) ||
  a.domain.localeCompare(b.domain, "fr")

interface DomainMasteryPanelProps {
  domains: DomainMastery[]
}

export const DomainMasteryPanel = ({ domains }: DomainMasteryPanelProps) => {
  const ordered = domains.toSorted(byPriority)
  const hasPractice = domains.some((d) => d.mastery !== null)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/30">
          <Stethoscope className="h-5 w-5 text-teal-600" />
        </div>
        <div>
          <h3 className="font-display text-base font-semibold text-gray-900 dark:text-white">
            Maîtrise par domaine
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Votre dernière réponse à chaque question, domaines faibles en tête
          </p>
        </div>
      </div>

      {hasPractice ? (
        <ul className="space-y-2">
          {ordered.map((d) => {
            const significant =
              d.mastery !== null && d.answered >= MASTERY_MIN_ANSWERED
            return (
              <li
                key={d.domain}
                data-testid="domain-mastery-row"
                data-domain={d.domain}
                data-significant={String(significant)}
                className={cn(
                  "rounded-xl border border-gray-200/50 bg-white/80 p-3 backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-900/80",
                  !significant && "opacity-60",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {d.domain}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-gray-700 dark:text-gray-200">
                        {d.mastery === null ? null : `${d.mastery} %`}
                      </span>
                    </div>
                    {d.mastery !== null && (
                      <Progress value={d.mastery} className="mt-1.5 h-1.5" />
                    )}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {d.mastery === null
                        ? "Pas encore pratiqué"
                        : `sur ${d.answered} question${d.answered > 1 ? "s" : ""}`}
                      {d.mastery !== null &&
                        !significant &&
                        " · Peu de données"}
                    </p>
                  </div>
                  <Link
                    href={trainingDomainUrl(d.domain)}
                    prefetch={false}
                    className="flex shrink-0 items-center gap-1 text-xs font-medium text-teal-600 transition-colors hover:text-teal-700 dark:text-teal-400"
                  >
                    Réviser
                    <span className="sr-only"> {d.domain}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <LinkPendingIndicator />
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-gray-200/50 bg-white/80 p-8 text-center backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-900/80">
          <Stethoscope className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="font-medium text-gray-900 dark:text-white">
            Aucune réponse pour l&apos;instant
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Vos domaines forts et faibles apparaîtront ici dès vos premières
            réponses
          </p>
          <Button asChild className="mt-4 bg-teal-600 hover:bg-teal-700">
            <Link href="/tableau-de-bord/entrainement" prefetch={false}>
              Commencer un entraînement
              <LinkPendingIndicator className="ml-2" />
            </Link>
          </Button>
        </div>
      )}
    </motion.div>
  )
}
