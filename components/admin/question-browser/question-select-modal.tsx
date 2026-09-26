"use client"

import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQuestionBrowser } from "./question-browser-context"
import { QuestionDetailModal } from "./question-detail-modal"

interface QuestionSelectModalProps {
  questionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function SelectionActions({
  questionId,
  isLoading,
}: {
  questionId: string
  isLoading: boolean
}) {
  const {
    isSelected,
    toggleSelection,
    isQuotaReached,
    selectedIds,
    maxSelection,
  } = useQuestionBrowser()
  const selected = isSelected(questionId)

  return (
    <>
      <span className="mr-auto text-sm text-gray-500 dark:text-gray-400">
        {selectedIds.length} sur {maxSelection} sélectionnées
      </span>
      <Button
        type="button"
        variant={selected ? "outline" : "default"}
        disabled={isLoading || (!selected && isQuotaReached)}
        onClick={() => toggleSelection(questionId)}
        className="gap-2"
      >
        {selected ? (
          <>
            <Minus className="h-4 w-4" />
            Retirer de l&apos;examen
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" />
            Ajouter à l&apos;examen
          </>
        )}
      </Button>
    </>
  )
}

/** Détail d'une question pendant la constitution d'un examen. */
export function QuestionSelectModal(props: QuestionSelectModalProps) {
  return (
    <QuestionDetailModal
      {...props}
      footer={(questionId, isLoading) => (
        <SelectionActions questionId={questionId} isLoading={isLoading} />
      )}
    />
  )
}
