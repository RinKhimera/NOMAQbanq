"use client"

import { useCallback } from "react"
import { useQuestionBrowser } from "./question-browser-context"
import { PanelRenderProps } from "./types"

interface QuestionBrowserPanelProps {
  renderPanel: (props: PanelRenderProps) => React.ReactNode
}

export function QuestionBrowserPanel({
  renderPanel,
}: QuestionBrowserPanelProps) {
  const { previewQuestionId, setPreviewQuestionId } = useQuestionBrowser()

  const handleClose = useCallback(() => {
    setPreviewQuestionId(null)
  }, [setPreviewQuestionId])

  return (
    <>
      {renderPanel({
        questionId: previewQuestionId,
        onClose: handleClose,
      })}
    </>
  )
}
