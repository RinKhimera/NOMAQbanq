"use client"

import { Minus, Plus } from "lucide-react"
import { useState } from "react"
import { questionTitle } from "@/components/admin/question-detail/labels"
import {
  QuestionDetailContent,
  type QuestionFile,
} from "@/components/admin/question-detail/question-detail-content"
import { ErrorState } from "@/components/shared/error-state"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { loadQuestionFile } from "@/features/questions/actions"
import type { BankQuestion } from "@/features/questions/dal"
import { callAction } from "@/lib/safe-action"
import { lastUseLabel } from "./composer-model"

type FileState = "loading" | "error" | QuestionFile

const toFileState = (res: unknown): FileState =>
  res !== null && typeof res === "object" && "question" in res
    ? (res as QuestionFile)
    : "error"

/**
 * Aperçu d'une question en Dialog : la fiche de la page de détail, sans
 * actions ni liens vers les examens (on ne quitte pas le compositeur).
 */
export const useQuestionPreview = () => {
  const [preview, setPreview] = useState<{
    item: BankQuestion
    file: FileState
  } | null>(null)

  const load = async (item: BankQuestion) => {
    setPreview({ item, file: "loading" })
    const res = await callAction(() => loadQuestionFile(item.id))
    setPreview((p) =>
      p?.item.id === item.id ? { item, file: toFileState(res) } : p,
    )
  }

  return { preview, open: load, close: () => setPreview(null) }
}

export const QuestionPreviewDialog = ({
  preview,
  now,
  inSelection,
  frozen,
  full,
  writing,
  onClose,
  onRetry,
  onToggle,
}: {
  preview: { item: BankQuestion; file: FileState } | null
  now: number
  inSelection: boolean
  frozen: boolean
  /** Jeu au visé : plus d'ajout possible. */
  full: boolean
  writing: boolean
  onClose: () => void
  onRetry: (item: BankQuestion) => void
  /** Ajoute ou retire la question affichée. */
  onToggle: (item: BankQuestion) => void
}) => {
  const item = preview?.item
  const file = preview?.file
  const use = item?.lastUse ?? null
  return (
    <Dialog open={!!preview} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        data-testid="composer-preview-dialog"
        className="max-h-[calc(100dvh-4rem)] overflow-y-auto max-md:h-dvh max-md:max-h-dvh max-md:max-w-full max-md:rounded-none sm:max-w-220"
      >
        {item && (
          <>
            <DialogHeader>
              <DialogTitle>{questionTitle(item.createdAt)}</DialogTitle>
              <DialogDescription>
                {item.domain} · {item.objectifCMC} · dernière utilisation{" "}
                {use ? lastUseLabel(use, now) : "—"}
              </DialogDescription>
            </DialogHeader>
            <div className="flex min-w-0 flex-col gap-4">
              {file === "loading" ? (
                <div
                  aria-busy="true"
                  aria-label="Chargement de la question"
                  className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
                >
                  <div className="flex flex-col gap-3">
                    <Skeleton className="h-4 w-[92%]" />
                    <Skeleton className="h-4 w-[70%]" />
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10" />
                    ))}
                  </div>
                  <div className="flex flex-col gap-3">
                    <Skeleton className="h-3 w-2/5" />
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-4" />
                    ))}
                  </div>
                </div>
              ) : file === "error" || !file ? (
                <ErrorState
                  variant="inline"
                  title="Impossible d'afficher cette question."
                  description="Elle a peut-être été supprimée, ou la connexion a été perdue."
                  onRetry={() => onRetry(item)}
                />
              ) : (
                <QuestionDetailContent
                  file={file}
                  now={now}
                  examLinks={false}
                />
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Fermer
              </Button>
              {!frozen &&
                (inSelection ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={writing}
                    onClick={() => onToggle(item)}
                    data-testid="btn-composer-preview-remove"
                  >
                    <Minus aria-hidden />
                    Retirer de l&apos;examen
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={writing || full}
                    onClick={() => onToggle(item)}
                    data-testid="btn-composer-preview-add"
                  >
                    <Plus aria-hidden />
                    Ajouter à l&apos;examen
                  </Button>
                ))}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
