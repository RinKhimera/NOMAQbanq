"use client"

import {
  ChevronDown,
  ChevronRight,
  History,
  ListPlus,
  Minus,
  Shuffle,
  TriangleAlert,
} from "lucide-react"
import { useState } from "react"
import { countLabel } from "@/components/admin/question-detail/labels"
import { SearchInput } from "@/components/shared/search-input"
import { StatusPill } from "@/components/shared/status-pill"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { BankQuestion } from "@/features/questions/dal"
import { TOUCH_HEIGHT, TOUCH_MIN_HEIGHT } from "@/lib/touch-target"
import { cn } from "@/lib/utils"
import { groupSelection, lastUseLabel, selectionAlerts } from "./composer-model"
import { ComposerRow } from "./composer-row"

export const SelectionColumn = ({
  items,
  now,
  frozen,
  onPreview,
  onRemove,
  writing,
  busyKey,
  className,
}: {
  items: BankQuestion[]
  now: number
  frozen: boolean
  onPreview: (q: BankQuestion) => void
  onRemove: (key: string, ids: string[]) => void
  writing: boolean
  busyKey: string | null
  className?: string
}) => {
  const [query, setQuery] = useState("")
  const [shut, setShut] = useState<Record<string, boolean>>({})
  const groups = groupSelection(items, query)
  const alerts = selectionAlerts(items)
  const searching = query.trim() !== ""

  return (
    <section
      aria-label="Sélection"
      data-testid="composer-selection"
      className={cn(
        "bg-surface border-line flex min-w-0 flex-col gap-2.5 rounded-lg border pb-1",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2 px-3.5 pt-3.5">
        <h2 className="type-h4 text-ink">Sélection</h2>
        <span className="text-ink-3 font-mono text-xs">
          {countLabel(items.length, "question")}
        </span>
      </div>

      {alerts.deleted > 0 && (
        <p
          className="text-danger-ink px-3.5 text-[0.8125rem]"
          data-testid="composer-selection-deleted"
        >
          {countLabel(
            alerts.deleted,
            "question supprimée depuis son ajout, à retirer",
            "questions supprimées depuis leur ajout, à retirer",
          )}{" "}
          avant de finaliser.
        </p>
      )}
      {(alerts.recent > 0 || alerts.toVerify > 0) && (
        <div
          className="text-warning-ink flex flex-wrap gap-x-3.5 gap-y-1.5 px-3.5 text-[0.8125rem]"
          data-testid="composer-selection-alerts"
        >
          {alerts.recent > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <History aria-hidden className="text-warning size-3.5" />
              {countLabel(
                alerts.recent,
                "question récente",
                "questions récentes",
              )}
            </span>
          )}
          {alerts.toVerify > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <TriangleAlert aria-hidden className="text-warning size-3.5" />
              {countLabel(alerts.toVerify, "clé à vérifier", "clés à vérifier")}
            </span>
          )}
        </div>
      )}

      <div className="px-3.5">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder="Rechercher dans la sélection"
          data-testid="composer-selection-search"
        />
      </div>
      <p className="text-ink-3 flex items-start gap-1.5 px-3.5 text-xs leading-normal">
        <Shuffle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        L&apos;ordre des questions est mélangé à la finalisation.
      </p>

      {items.length === 0 ? (
        <div
          className="flex flex-col items-center gap-2 px-4 py-9 text-center"
          data-testid="composer-selection-empty"
        >
          <ListPlus aria-hidden className="text-ink-3 size-5" />
          <p className="text-ink text-[0.9375rem] font-medium">
            Aucune question choisie
          </p>
          <p className="text-ink-3 max-w-90 text-[0.8125rem]">
            Ajoutez des questions depuis la banque, ou complétez
            automatiquement.
          </p>
        </div>
      ) : groups.length === 0 ? (
        <p className="text-ink-3 px-4 py-9 text-center text-sm">
          Aucune question de la sélection ne correspond.
        </p>
      ) : (
        <div className="flex flex-col">
          {groups.map((g) => {
            const closed = !!shut[g.domain] && !searching
            return (
              <div key={g.domain} data-testid="composer-selection-group">
                <button
                  type="button"
                  aria-expanded={!closed}
                  onClick={() =>
                    setShut({ ...shut, [g.domain]: !shut[g.domain] })
                  }
                  className={cn(
                    "focus-ring border-line bg-surface-2 text-ink flex min-h-10 w-full cursor-pointer items-center gap-2 border-t px-3.5 py-1.5 text-left text-[0.8125rem] font-semibold",
                    TOUCH_MIN_HEIGHT,
                  )}
                >
                  {closed ? (
                    <ChevronRight aria-hidden className="text-ink-3 size-3.5" />
                  ) : (
                    <ChevronDown aria-hidden className="text-ink-3 size-3.5" />
                  )}
                  <span className="flex-1">{g.domain}</span>
                  <span className="font-mono">{g.rows.length}</span>
                </button>
                {!closed && (
                  <ul>
                    {g.rows.map((q) => {
                      const use = q.lastUse
                      const recent = use?.recent ?? false
                      return (
                        <ComposerRow
                          key={q.id}
                          q={q}
                          onPreview={onPreview}
                          testId="composer-selection-row"
                          meta={
                            (recent || q.keyToVerify || q.deleted) && (
                              <>
                                {q.deleted && (
                                  <StatusPill tone="danger">
                                    Supprimée
                                  </StatusPill>
                                )}
                                {recent && use && (
                                  <StatusPill tone="warning">
                                    Récente · {lastUseLabel(use, now)}
                                  </StatusPill>
                                )}
                                {q.keyToVerify && (
                                  <StatusPill tone="warning">
                                    Clé à vérifier
                                  </StatusPill>
                                )}
                              </>
                            )
                          }
                          action={
                            !frozen && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={writing}
                                onClick={() =>
                                  onRemove(`remove:${q.id}`, [q.id])
                                }
                                aria-label={`Retirer : ${q.question.slice(0, 80)}`}
                                className={TOUCH_HEIGHT}
                                data-testid="btn-composer-remove"
                              >
                                {writing && busyKey === `remove:${q.id}` ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <Minus aria-hidden />
                                )}
                                Retirer
                              </Button>
                            )
                          }
                        />
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
