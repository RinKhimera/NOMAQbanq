"use client"

import { useCallback } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { cn } from "@/lib/utils"
import { QuestionBrowserProvider } from "./question-browser-context"
import { QuestionBrowserPanel } from "./question-browser-panel"
import { QuestionBrowserSelectionBar } from "./question-browser-selection-bar"
import { QuestionBrowserTable } from "./question-browser-table"
import { QuestionBrowserToolbar } from "./question-browser-toolbar"
import { QuestionBrowserProps } from "./types"

// Re-export types and utilities
export * from "./types"
export { getDomainColor, truncateText } from "./utils"
export { useQuestionBrowser } from "./question-browser-context"

function QuestionBrowserContent({
  mode,
  selectedIds,
  onSelectionChange,
  maxSelection,
  renderPanel,
  className,
}: QuestionBrowserProps) {
  // Query for all question IDs (used for auto-complete)
  const allQuestionIds = useQuery(
    api.questions.getAllQuestionIds,
    mode === "select" ? {} : "skip"
  )

  // Handle auto-complete for select mode
  const handleAutoComplete = useCallback(() => {
    if (!allQuestionIds || !onSelectionChange || !maxSelection) return

    const remaining = maxSelection - (selectedIds?.length || 0)
    if (remaining <= 0) return

    // Filter out already selected questions
    const availableIds = allQuestionIds.filter(
      (id) => !selectedIds?.includes(id)
    )

    // Shuffle and take the needed amount
    const shuffled = [...availableIds].sort(() => Math.random() - 0.5)
    const randomIds = shuffled.slice(0, remaining)

    onSelectionChange([...(selectedIds || []), ...randomIds])
  }, [allQuestionIds, selectedIds, onSelectionChange, maxSelection])

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Selection bar (only in select mode) */}
      {mode === "select" && (
        <QuestionBrowserSelectionBar onAutoComplete={handleAutoComplete} />
      )}

      {/* Filter toolbar */}
      <QuestionBrowserToolbar />

      {/* Questions table */}
      <QuestionBrowserTable />

      {/* Side panel (if renderPanel provided) */}
      {renderPanel && <QuestionBrowserPanel renderPanel={renderPanel} />}
    </div>
  )
}

export function QuestionBrowser(props: QuestionBrowserProps) {
  const {
    mode,
    selectedIds,
    onSelectionChange,
    maxSelection = 230,
    previewQuestionId,
    onPreviewChange,
    onFiltersChange,
  } = props

  return (
    <QuestionBrowserProvider
      mode={mode}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      maxSelection={maxSelection}
      externalPreviewId={previewQuestionId}
      onPreviewChange={onPreviewChange}
      onFiltersChange={onFiltersChange}
    >
      <QuestionBrowserContent {...props} />
    </QuestionBrowserProvider>
  )
}

// Export sub-components for advanced usage
export { QuestionBrowserProvider } from "./question-browser-context"
export { QuestionBrowserToolbar } from "./question-browser-toolbar"
export { QuestionBrowserTable } from "./question-browser-table"
export { QuestionBrowserSelectionBar } from "./question-browser-selection-bar"
export { QuestionBrowserPanel } from "./question-browser-panel"
export { QuestionPreviewPanel } from "./question-preview-panel"
