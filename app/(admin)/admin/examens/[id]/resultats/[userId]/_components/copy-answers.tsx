"use client"

import { Check, ChevronDown, Flag, Minus, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { QuestionCard } from "@/components/quiz/question-card"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { loadExamQuestionExplanations } from "@/features/exams/actions"
import type { QuestionExplanationView } from "@/features/exams/dal"
import { TONE_TEXT } from "@/lib/tone"
import { cn } from "@/lib/utils"
import { type CopyFilter, type CopyRow, matchesFilter } from "./copy-model"

const OUTCOME_ICON = {
  correct: { Icon: Check, className: TONE_TEXT.success, label: "Juste" },
  incorrect: { Icon: X, className: TONE_TEXT.danger, label: "Fausse" },
  unanswered: { Icon: Minus, className: "text-ink-3", label: "Sans réponse" },
  withheld: { Icon: Minus, className: "text-ink-3", label: "Différée" },
} as const

/**
 * Réponses d'une copie : filtre Toutes / Incorrectes / Marquées, lignes
 * repliables qui déplient la question corrigée. L'explication se charge à la
 * première ouverture de la question.
 */
export const CopyAnswers = ({ rows }: { rows: CopyRow[] }) => {
  const [filter, setFilter] = useState<CopyFilter>("all")
  const [openId, setOpenId] = useState<string | null>(null)
  const [explanations, setExplanations] = useState<
    Map<string, QuestionExplanationView>
  >(new Map())
  const requested = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (openId === null || requested.current.has(openId)) return
    requested.current.add(openId)
    let active = true
    loadExamQuestionExplanations([openId])
      .then((loaded) => {
        if (!active) return
        setExplanations((prev) => {
          const next = new Map(prev)
          for (const row of loaded) next.set(row.questionId, row)
          return next
        })
      })
      .catch(() => {
        // Rouvrir la question retente le chargement.
        requested.current.delete(openId)
        if (active)
          toast.error("Explication indisponible. Vérifiez votre réseau.")
      })
    return () => {
      active = false
    }
  }, [openId])

  const shown = rows.filter((row) => matchesFilter(row, filter))
  const digits = String(rows.length).length

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl<CopyFilter>
        label="Filtrer les réponses"
        value={filter}
        onValueChange={setFilter}
        testIdPrefix="copy-filter"
        className="self-start"
        options={[
          { value: "all", label: "Toutes", count: rows.length },
          {
            value: "wrong",
            label: "Incorrectes",
            count: rows.filter((r) => matchesFilter(r, "wrong")).length,
          },
          {
            value: "flagged",
            label: "Marquées",
            count: rows.filter((r) => r.flagged).length,
          },
        ]}
      />

      <ul className="border-line flex flex-col border-t">
        {shown.map((row) => {
          const id = row.question._id
          const open = openId === id
          const icon = OUTCOME_ICON[row.outcome]
          const loaded = explanations.get(id)
          return (
            <li
              key={id}
              className="border-line border-b"
              data-testid={`copy-row-${row.number}`}
              data-state={row.outcome}
            >
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : id)}
                className="focus-ring hover:bg-surface-2 grid min-h-14 w-full cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 px-2 py-3 text-left"
              >
                <span className="text-ink-3 font-mono text-xs tabular-nums">
                  {String(row.number).padStart(digits, "0")}
                </span>
                <icon.Icon
                  aria-label={icon.label}
                  strokeWidth={2.25}
                  className={cn("size-4", icon.className)}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-ink flex items-center gap-2 text-[0.9375rem] font-medium">
                    <span className="truncate">{row.question.domain}</span>
                    {row.flagged && (
                      <Flag
                        aria-label="Marquée"
                        className="text-warning size-3.5 shrink-0 fill-current"
                      />
                    )}
                  </span>
                  <span className="text-ink-3 text-[0.8125rem]">
                    {row.summary}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn("text-ink-3 size-4", open && "rotate-180")}
                />
              </button>
              {open && (
                <div className="pb-5">
                  <QuestionCard
                    variant="review"
                    question={row.question}
                    questionNumber={row.number}
                    userAnswer={row.selected}
                    userVerdict={row.verdict}
                    isFlagged={row.flagged}
                    isExpanded
                    lazyExplanation={
                      loaded?.explanation ?? row.question.explanation
                    }
                    lazyReferences={
                      loaded?.references ?? row.question.references
                    }
                    lazyExplanationImages={
                      loaded?.explanationImages ??
                      row.question.explanationImages ??
                      []
                    }
                  />
                </div>
              )}
            </li>
          )
        })}
        {shown.length === 0 && (
          <li className="text-ink-3 py-5 text-sm">
            Aucune question dans ce filtre.
          </li>
        )}
      </ul>
    </div>
  )
}
