"use client"

import { BarChart3, Check } from "lucide-react"
import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import type { QuestionAnswerBreakdown as Breakdown } from "@/features/analytics/dal"
import { loadQuestionAnswerBreakdown } from "@/features/questions/actions"
import { cn } from "@/lib/utils"

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`

/**
 * Répartition des premières réponses d'étudiants entre les options d'une
 * question. Monté avec la question ouverte : un nouvel id = remontage.
 */
export function QuestionAnswerBreakdown({
  questionId,
}: {
  questionId: string
}) {
  // `undefined` = en chargement ; `null` = échec du chargement.
  const [breakdown, setBreakdown] = useState<Breakdown | null | undefined>(
    undefined,
  )

  useEffect(() => {
    let active = true
    loadQuestionAnswerBreakdown(questionId)
      .then((b) => {
        if (active) setBreakdown(b)
      })
      .catch(() => {
        if (active) setBreakdown(null)
      })
    return () => {
      active = false
    }
  }, [questionId])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-gray-500" />
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          Réponses des étudiants
        </h4>
      </div>

      {breakdown === undefined && <Skeleton className="h-20 w-full" />}

      {breakdown === null && (
        <p className="text-sm text-gray-500">
          Répartition indisponible. Vérifiez votre réseau.
        </p>
      )}

      {breakdown && breakdown.answerCount === 0 && (
        <p className="text-sm text-gray-500">
          Aucun étudiant n&apos;a encore répondu
        </p>
      )}

      {breakdown && breakdown.answerCount > 0 && (
        <>
          <p
            data-testid="answer-breakdown-summary"
            className="text-xs text-gray-500 dark:text-gray-400"
          >
            {breakdown.successRate === null
              ? `Données insuffisantes (${plural(breakdown.answerCount, "réponse")})`
              : `${breakdown.successRate} % de réussite sur ${plural(breakdown.answerCount, "réponse")}`}{" "}
            · première réponse de chaque étudiant
          </p>
          <ul className="space-y-1.5">
            {breakdown.options.map((o) => (
              <li
                key={o.option}
                data-testid="answer-share"
                data-key={String(o.isKey)}
                className="space-y-1"
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span
                    className={cn(
                      "flex min-w-0 items-center gap-1.5",
                      o.isKey
                        ? "font-medium text-emerald-700 dark:text-emerald-400"
                        : "text-gray-700 dark:text-gray-300",
                    )}
                  >
                    {o.isKey && <Check className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{o.option}</span>
                  </span>
                  <span className="shrink-0 text-xs text-gray-500 tabular-nums">
                    {o.share} % · {o.count}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      o.isKey ? "bg-emerald-500" : "bg-gray-400",
                    )}
                    style={{ width: `${o.share}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
