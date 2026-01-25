"use client"

import { Shuffle, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useQuestionBrowser } from "./question-browser-context"
import { QuestionBrowserSelectionBarProps } from "./types"

export function QuestionBrowserSelectionBar({
  onAutoComplete,
  className,
}: QuestionBrowserSelectionBarProps) {
  const { selectedIds, clearSelection, isQuotaReached, maxSelection, mode } =
    useQuestionBrowser()

  // Only show in select mode
  if (mode !== "select") return null

  const canCreate = selectedIds.length >= maxSelection
  const remaining = maxSelection - selectedIds.length

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-gray-700/50 dark:bg-gray-900 lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      {/* Left side: Counter and status */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={canCreate ? "default" : "destructive"}
          className={cn(
            "text-sm",
            canCreate &&
              "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300"
          )}
        >
          {selectedIds.length} / {maxSelection} questions
        </Badge>
        {!canCreate && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            (encore {remaining} à sélectionner)
          </span>
        )}
        {isQuotaReached && (
          <Badge
            variant="outline"
            className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
          >
            Quota atteint
          </Badge>
        )}
      </div>

      {/* Right side: Actions */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {onAutoComplete && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAutoComplete}
            disabled={isQuotaReached}
            className="w-full cursor-pointer gap-2 sm:w-auto"
          >
            <Shuffle className="h-4 w-4" />
            Compléter automatiquement
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={clearSelection}
          disabled={selectedIds.length === 0}
          className="w-full cursor-pointer gap-2 text-gray-500 hover:text-gray-700 sm:w-auto"
        >
          <X className="h-4 w-4" />
          Tout effacer
        </Button>
      </div>
    </div>
  )
}
