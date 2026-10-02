"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import { formatCount } from "@/components/admin/question-detail/labels"
import type { DomainPlanRow } from "@/features/questions/dal"
import { RECENT_EXAMS_DEFAULT } from "@/features/questions/recent-exams"
import { TOUCH_MIN_HEIGHT } from "@/lib/touch-target"
import { cn } from "@/lib/utils"

const th =
  "bg-surface-2 text-ink-3 sticky top-0 px-4 py-2 text-right font-mono text-[11px] font-medium tracking-[0.06em] uppercase first:text-left"

/**
 * Plan par domaine, repliable : ouvert dès 1024 px, replié en dessous. Avant
 * le premier clic, la largeur décide en CSS (aucune lecture de `window` au
 * rendu serveur).
 */
export const DomainPlan = ({
  rows,
  activeDomain,
  onPickDomain,
}: {
  rows: DomainPlanRow[]
  activeDomain: string
  onPickDomain: (domain: string) => void
}) => {
  const [open, setOpen] = useState<boolean | null>(null)
  const toggle = () =>
    setOpen((o) => !(o ?? window.matchMedia("(min-width: 1024px)").matches))
  const byWidth = open === null
  return (
    <section
      aria-label="Plan par domaine"
      data-testid="composer-domain-plan"
      className="bg-surface border-line rounded-lg border"
    >
      <button
        type="button"
        aria-expanded={open ?? undefined}
        aria-controls="composer-domain-plan-table"
        onClick={toggle}
        className="focus-ring flex min-h-12 w-full cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-lg px-4 py-2.5 text-left"
      >
        <ChevronDown
          aria-hidden
          className={cn(
            "text-ink-3 size-4",
            byWidth ? "max-lg:hidden" : !open && "hidden",
          )}
        />
        <ChevronRight
          aria-hidden
          className={cn(
            "text-ink-3 size-4",
            byWidth ? "lg:hidden" : open && "hidden",
          )}
        />
        <span className="type-h4 text-ink">Plan par domaine</span>
        <span className="text-ink-3 text-[0.8125rem]">
          Récentes : utilisées dans les {RECENT_EXAMS_DEFAULT} derniers examens.
          Cliquez sur un domaine pour filtrer la banque.
        </span>
      </button>
      <div
        id="composer-domain-plan-table"
        className={cn(
          "border-line max-h-85 overflow-auto border-t",
          byWidth ? "max-lg:hidden" : !open && "hidden",
        )}
      >
        <table className="w-full border-collapse text-[0.8125rem]">
          <thead>
            <tr>
              <th className={th}>Domaine</th>
              <th className={th}>Choisies</th>
              <th className={th}>Disponibles</th>
              <th className={th}>Récentes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const on = activeDomain === r.domain
              return (
                <tr
                  key={r.domain}
                  tabIndex={0}
                  aria-current={on || undefined}
                  data-testid="composer-plan-row"
                  onClick={() => onPickDomain(r.domain)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onPickDomain(r.domain)
                    }
                  }}
                  className={cn(
                    "hover:bg-surface-2 cursor-pointer focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-(--accent)",
                    on && "bg-accent-soft shadow-[inset_3px_0_0_var(--accent)]",
                  )}
                >
                  <td
                    className={cn(
                      "border-line text-ink-2 border-t px-4 py-1.75 text-left pointer-coarse:py-3",
                      TOUCH_MIN_HEIGHT,
                    )}
                  >
                    {r.domain}
                  </td>
                  <td
                    className={cn(
                      "border-line border-t px-4 text-right font-mono",
                      r.chosen ? "text-ink" : "text-ink-3",
                    )}
                  >
                    {formatCount(r.chosen)}
                  </td>
                  <td className="border-line text-ink-2 border-t px-4 text-right font-mono">
                    {formatCount(r.available)}
                  </td>
                  <td
                    className={cn(
                      "border-line border-t px-4 text-right font-mono",
                      r.recent ? "text-warning-ink" : "text-ink-3",
                    )}
                  >
                    {formatCount(r.recent)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
