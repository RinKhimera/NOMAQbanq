"use client"

import {
  ArrowRight,
  Bookmark,
  ChevronDown,
  ChevronRight,
  EyeOff,
  type LucideIcon,
  RotateCcw,
} from "lucide-react"
import Link from "next/link"
import { type ReactNode, useState } from "react"
import { LinkPendingIndicator } from "@/components/shared/link-pending-indicator"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { SegmentedControl } from "@/components/ui/segmented-control"
import {
  PRICING_HREF,
  trainingDomainUrl,
  trainingRevisionUrl,
} from "@/constants"
import type {
  DomainProgress,
  ObjectiveProgress,
} from "@/features/analytics/dal"
import type { RevisionCriterion } from "@/features/training/schemas"
import type { DashboardPeriod } from "@/lib/dashboard-period"
import { MASTERY_MIN_ANSWERED } from "@/lib/dashboard-summary"
import {
  type DomainSort,
  coveragePercent,
  formatTrend,
  sortDomains,
} from "@/lib/progression"
import { formatScore, scoreTone } from "@/lib/score"
import { TONE_COLOR, TONE_TEXT } from "@/lib/tone"
import { cn } from "@/lib/utils"

const SORT_OPTIONS: { value: DomainSort; label: string }[] = [
  { value: "weakest", label: "Plus faibles" },
  { value: "trend", label: "Tendance" },
  { value: "az", label: "A–Z" },
]

const REVISION_ACTIONS: {
  criterion: RevisionCriterion
  label: string
  icon: LucideIcon
}[] = [
  { criterion: "failed", label: "Revoir mes ratées", icon: RotateCcw },
  { criterion: "unseen", label: "Questions non vues", icon: EyeOff },
  { criterion: "bookmarked", label: "Mes marquées", icon: Bookmark },
]

const fmt = (n: number) => n.toLocaleString("fr-CA")

// Sous 768 px, chaque domaine est une carte : nom, barre, puis maîtrise et
// couverture. Au-delà, les mêmes cellules se posent dans les colonnes du
// tableau (`md:contents` libère les enveloppes de la carte).
const gridColumns = (withTrend: boolean) =>
  withTrend
    ? "md:grid md:grid-cols-[1.25rem_minmax(0,13rem)_minmax(0,1fr)_4rem_4rem_8rem_6rem] md:items-center md:gap-x-4"
    : "md:grid md:grid-cols-[1.25rem_minmax(0,13rem)_minmax(0,1fr)_4rem_8rem_6rem] md:items-center md:gap-x-4"

const col = (withTrend: boolean) => ({
  mastery: "md:col-start-4",
  trend: "md:col-start-5",
  coverage: withTrend ? "md:col-start-6" : "md:col-start-5",
  answers: withTrend ? "md:col-start-7" : "md:col-start-6",
})

const MasteryBar = ({
  mastery,
  significant,
  label,
  thin = false,
}: {
  mastery: number | null
  significant: boolean
  label: string
  thin?: boolean
}) =>
  mastery === null ? (
    <span
      aria-hidden="true"
      className={cn("bg-surface-2 block rounded-full", thin ? "h-1" : "h-1.5")}
    />
  ) : (
    <Progress
      value={mastery}
      indicatorColor={
        significant ? TONE_COLOR[scoreTone(mastery)] : TONE_COLOR.neutral
      }
      className={thin ? "h-1" : "h-1.5"}
      aria-label={label}
    />
  )

const Coverage = ({ covered, total }: { covered: number; total: number }) => {
  const pct = coveragePercent(covered, total)
  return (
    <span className="inline-flex items-baseline gap-3 font-mono text-[0.8125rem] whitespace-nowrap">
      <span className="sr-only">Couverture </span>
      <span className={covered > 0 ? "text-ink-2" : "text-ink-3"}>
        {fmt(covered)}&nbsp;/&nbsp;{fmt(total)}
      </span>
      <small className="text-ink-3 text-xs">
        {pct === null ? "—" : `${pct} %`}
      </small>
    </span>
  )
}

const Trend = ({ trend }: { trend: number | null }) => (
  <span
    className={cn(
      "font-mono text-[0.8125rem]",
      trend === null || trend === 0
        ? "text-ink-3"
        : trend > 0
          ? TONE_TEXT.success
          : TONE_TEXT.danger,
    )}
  >
    <span className="sr-only">Tendance </span>
    {formatTrend(trend)}
  </span>
)

const ObjectiveRow = ({
  objective,
  withTrend,
}: {
  objective: ObjectiveProgress
  withTrend: boolean
}) => {
  const enough = objective.covered >= MASTERY_MIN_ANSWERED
  const c = col(withTrend)
  return (
    <li
      data-testid="objective-row"
      className={cn(
        "flex flex-col gap-1.5 py-2 md:py-1.5",
        gridColumns(withTrend),
      )}
    >
      <span className="text-ink-2 text-sm md:col-start-2">
        {objective.label}
      </span>
      <span className="md:col-start-3">
        <MasteryBar
          mastery={enough ? objective.mastery : null}
          significant
          label={`Maîtrise : ${objective.label}`}
          thin
        />
      </span>
      <span className="flex items-baseline justify-between gap-3 md:contents">
        {enough ? (
          <span
            className={cn(
              "text-ink font-mono text-[0.8125rem] md:text-right",
              c.mastery,
            )}
          >
            {formatScore(objective.mastery)}
          </span>
        ) : (
          <span
            className={cn(
              "text-ink-3 text-xs md:text-right",
              c.mastery,
              withTrend && "md:col-span-2",
            )}
          >
            Peu de données
          </span>
        )}
        <span className={cn("md:text-right", c.coverage)}>
          <Coverage covered={objective.covered} total={objective.total} />
        </span>
      </span>
    </li>
  )
}

const RevisionActions = ({
  domain,
  trainingAccess,
}: {
  domain: DomainProgress
  trainingAccess: boolean
}) => {
  if (!trainingAccess || !domain.revision) {
    return (
      <Button asChild size="sm" variant="ghost" className="max-md:h-11">
        <Link href={PRICING_HREF}>
          Prolonger l&apos;accès Entraînement
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    )
  }
  const counts = domain.revision
  const actions = REVISION_ACTIONS.filter((a) => counts[a.criterion] > 0)
  if (actions.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 max-md:*:flex-1">
      {actions.map(({ criterion, label, icon: Icon }) => (
        <Button
          key={criterion}
          asChild
          size="sm"
          variant="outline"
          className="max-md:h-11"
        >
          <Link
            href={trainingRevisionUrl(domain.domain, criterion)}
            prefetch={false}
            data-testid={`revision-action-${criterion}`}
          >
            <Icon aria-hidden="true" />
            {label} ({fmt(counts[criterion])})
            <LinkPendingIndicator />
          </Link>
        </Button>
      ))}
    </div>
  )
}

/** Cellules communes d'un domaine, pratiqué ou non. */
const DomainCells = ({
  domain,
  withTrend,
  disclosure,
  trailing,
}: {
  domain: DomainProgress
  withTrend: boolean
  /** Absent : le domaine ne se déplie pas. */
  disclosure?: { open: boolean; panelId: string; onToggle: () => void }
  trailing: ReactNode
}) => {
  const open = disclosure ? disclosure.open : null
  const c = col(withTrend)
  const never = domain.mastery === null
  const significant = domain.answered >= MASTERY_MIN_ANSWERED
  const chevronClass =
    "text-ink-3 size-4 shrink-0 transition-transform duration-(--duration-base)"
  return (
    <>
      <span className="max-md:hidden md:col-start-1">
        {open !== null && (
          <ChevronRight
            aria-hidden="true"
            className={cn(chevronClass, open && "rotate-90")}
          />
        )}
      </span>
      <span className="flex items-center justify-between gap-3 md:contents">
        {disclosure ? (
          // Le bouton couvre toute la ligne (`after:inset-0`) : la barre de
          // maîtrise n'a pas sa place DANS un bouton.
          <button
            type="button"
            aria-expanded={disclosure.open}
            aria-controls={disclosure.panelId}
            onClick={disclosure.onToggle}
            className="focus-ring text-ink min-w-0 cursor-pointer rounded-xs text-left text-sm font-medium after:absolute after:inset-0 md:col-start-2 md:truncate"
          >
            {domain.domain}
          </button>
        ) : (
          <span className="text-ink min-w-0 text-sm font-medium md:col-start-2 md:truncate">
            {domain.domain}
          </span>
        )}
        {open !== null && (
          <ChevronDown
            aria-hidden="true"
            className={cn(chevronClass, "md:hidden", open && "rotate-180")}
          />
        )}
      </span>
      <span className="md:col-start-3">
        <MasteryBar
          mastery={domain.mastery}
          significant={significant}
          label={`Maîtrise en ${domain.domain}`}
        />
      </span>
      <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 md:contents">
        <span className={cn("text-ink-3 text-sm md:text-right", c.mastery)}>
          <span className="sr-only">Maîtrise </span>
          <span
            className={cn(
              "font-mono text-[0.8125rem]",
              never ? "text-ink-3" : "text-ink",
            )}
          >
            {formatScore(domain.mastery)}
          </span>
          <span aria-hidden="true" className="ml-1 md:hidden">
            maîtrise
          </span>
          {withTrend && !never && (
            <span className="md:hidden">
              {" · "}
              <Trend trend={domain.trend} />
            </span>
          )}
        </span>
        {withTrend && (
          <span className={cn("text-right max-md:hidden", c.trend)}>
            <Trend trend={never ? null : domain.trend} />
          </span>
        )}
        <span className={cn("md:text-right", c.coverage)}>
          <Coverage covered={domain.answered} total={domain.total} />
        </span>
      </span>
      <span className={cn("md:text-right", c.answers)}>{trailing}</span>
    </>
  )
}

/**
 * Résultats par domaine : maîtrise, tendance sur la période, couverture et
 * réponses de la période ; un domaine pratiqué se déplie sur ses objectifs du
 * CMC et ses actions de révision. Les domaines jamais pratiqués viennent en
 * fin de liste, sans dépliage. `readOnly` (vue admin) retire les actions.
 */
export const DomainResults = ({
  domains,
  period,
  trainingAccess,
  readOnly = false,
}: {
  domains: DomainProgress[]
  period: DashboardPeriod
  trainingAccess: boolean
  readOnly?: boolean
}) => {
  const [sort, setSort] = useState<DomainSort>("weakest")
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  const withTrend = period !== "tout"
  const rows = sortDomains(domains, sort, period)
  const c = col(withTrend)

  const toggle = (domain: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(domain)) next.delete(domain)
      else next.add(domain)
      return next
    })

  return (
    <section className="flex flex-col gap-4" aria-labelledby="domain-results">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="type-label">Maîtrise</p>
          <h2 id="domain-results" className="type-h4 text-ink">
            Résultats par domaine
          </h2>
        </div>
        <SegmentedControl
          label="Trier les domaines"
          value={sort}
          options={SORT_OPTIONS}
          onValueChange={setSort}
          testIdPrefix="domain-sort"
        />
      </div>

      <div className="bg-surface border-line shadow-1 rounded-lg border">
        <div
          aria-hidden="true"
          className={cn(
            "type-label border-line border-b px-5 py-3 max-md:hidden",
            gridColumns(withTrend),
          )}
        >
          <span className="md:col-start-2">Domaine</span>
          <span className={cn("text-right", c.mastery)}>Maîtrise</span>
          {withTrend && (
            <span className={cn("text-right", c.trend)}>Tendance</span>
          )}
          <span className={cn("text-right", c.coverage)}>Couverture</span>
          <span className={cn("text-right", c.answers)}>Réponses</span>
        </div>
        <ul>
          {rows.map((d) => {
            const never = d.mastery === null
            const rowClass = cn(
              "flex w-full flex-col gap-2 px-5 py-3.5 text-left",
              gridColumns(withTrend),
            )
            if (never) {
              return (
                <li
                  key={d.domain}
                  data-testid="domain-row"
                  data-domain={d.domain}
                  data-never="true"
                  className="border-line border-b last:border-b-0"
                >
                  <div className={rowClass}>
                    <DomainCells
                      domain={d}
                      withTrend={withTrend}
                      trailing={
                        trainingAccess && !readOnly ? (
                          <Button
                            asChild
                            size="sm"
                            className="max-md:h-11 max-md:w-full"
                          >
                            <Link
                              href={trainingDomainUrl(d.domain)}
                              prefetch={false}
                            >
                              Commencer
                              <span className="sr-only"> : {d.domain}</span>
                              <LinkPendingIndicator />
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-ink-3 font-mono text-[0.8125rem] max-md:hidden">
                            0
                          </span>
                        )
                      }
                    />
                  </div>
                </li>
              )
            }
            const isOpen = open.has(d.domain)
            // `aria-controls` est une liste d'ids séparés par des espaces.
            const panelId = `domain-detail-${d.domain.normalize("NFD").replace(/[^a-z0-9]+/gi, "-")}`
            return (
              <li
                key={d.domain}
                data-testid="domain-row"
                data-domain={d.domain}
                className="border-line border-b last:border-b-0"
              >
                <div
                  className={cn(
                    "has-[button:hover]:bg-surface-2 relative transition-[background-color]",
                    rowClass,
                  )}
                >
                  <DomainCells
                    domain={d}
                    withTrend={withTrend}
                    disclosure={{
                      open: isOpen,
                      panelId,
                      onToggle: () => toggle(d.domain),
                    }}
                    trailing={
                      <span className="text-ink-3 font-mono text-[0.8125rem] max-md:hidden">
                        <span className="sr-only">
                          Réponses sur la période{" "}
                        </span>
                        {fmt(d.periodAnswers)}
                      </span>
                    }
                  />
                </div>
                {isOpen && (
                  <div
                    id={panelId}
                    data-testid="domain-detail"
                    className="bg-background border-line flex flex-col gap-3 border-t px-5 py-4"
                  >
                    {d.objectives.length > 0 && (
                      <>
                        <p className="type-label md:pl-9">Objectifs du CMC</p>
                        <ul className="divide-line flex flex-col divide-y md:divide-y-0">
                          {d.objectives.map((o) => (
                            <ObjectiveRow
                              key={o.id}
                              objective={o}
                              withTrend={withTrend}
                            />
                          ))}
                        </ul>
                      </>
                    )}
                    {!readOnly && (
                      <div className="md:pl-9">
                        <RevisionActions
                          domain={d}
                          trainingAccess={trainingAccess}
                        />
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
