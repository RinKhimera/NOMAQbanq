"use client"

import { ArrowRight } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import type { AccessType } from "@/features/payments/access-ledger"
import { formatMediumDate } from "@/lib/format"
import { TONE_SOFT } from "@/lib/tone"
import { cn } from "@/lib/utils"
import { ACCESS_TYPE_LABEL } from "./access-badge"
import { impactLines } from "./access-impact"
import { type AccessImpactState } from "./use-access-impact"

/** Impact d'un retrait sur chaque accès couvert par la transaction. */
export const AccessImpactPanel = ({
  state,
  covered,
}: {
  state: AccessImpactState
  covered: AccessType[]
}) => {
  if (state.status === "failed")
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col gap-1 rounded-md border p-3 text-sm",
          TONE_SOFT.warning,
        )}
      >
        <p className="font-medium">Impact sur l&apos;accès indisponible</p>
        <p>
          Le calcul n&apos;a pas pu être chargé. L&apos;opération reste possible
          ; vérifiez ensuite l&apos;accès du client dans sa fiche.
        </p>
      </div>
    )

  return (
    <div
      aria-busy={state.status === "loading"}
      className="border-line bg-surface-2 flex flex-col gap-2 rounded-md border p-3"
    >
      <span className="type-label">Impact sur l&apos;accès</span>
      {state.status === "loading" ? (
        <span className="text-ink-2 inline-flex items-center gap-2 text-sm">
          <Spinner size="sm" />
          Calcul de l&apos;impact sur l&apos;accès…
        </span>
      ) : (
        impactLines(state.impacts, covered, state.loadedAt).map((line) => (
          <div
            key={line.accessType}
            className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm"
          >
            <span className="text-ink font-medium">
              Accès {ACCESS_TYPE_LABEL[line.accessType]}
            </span>
            {line.affected ? (
              <span className="inline-flex flex-wrap items-center gap-1.5 font-mono text-[0.8125rem]">
                <span className="text-ink-2">
                  expire le {formatMediumDate(line.current!)}
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="text-ink-3 size-3.5"
                />
                <span
                  className={cn(
                    "font-medium",
                    line.after ? "text-warning-ink" : "text-danger-ink",
                  )}
                >
                  {line.after
                    ? `expire le ${formatMediumDate(line.after)}`
                    : "retiré"}
                </span>
              </span>
            ) : (
              <span className="text-ink-3">
                Non affecté
                {line.current !== null && line.current <= state.loadedAt
                  ? ` · expiré le ${formatMediumDate(line.current)}`
                  : ""}
              </span>
            )}
          </div>
        ))
      )}
    </div>
  )
}
