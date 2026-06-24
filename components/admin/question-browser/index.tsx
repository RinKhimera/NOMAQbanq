"use client"

import { useCallback } from "react"
import { loadAllQuestionIds } from "@/features/questions/actions"
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
  // Auto-complete (mode select) : récupère les ids à la demande via Server Action
  // (plus de chargement réactif de 5000 ids au montage).
  const handleAutoComplete = useCallback(async () => {
    if (!onSelectionChange || !maxSelection) return

    const selected = selectedIds ?? []
    const remaining = maxSelection - selected.length
    if (remaining <= 0) return

    const allIds = await loadAllQuestionIds()
    const selectedSet = new Set<string>(selected)
    const available = allIds.filter((id) => !selectedSet.has(id))

    const shuffled = [...available].sort(() => Math.random() - 0.5)
    const randomIds = shuffled.slice(0, remaining)

    onSelectionChange([...selected, ...randomIds])
  }, [selectedIds, onSelectionChange, maxSelection])

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
