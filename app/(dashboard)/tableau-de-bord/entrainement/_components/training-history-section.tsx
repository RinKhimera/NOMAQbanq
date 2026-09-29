"use client"

import { Hourglass, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { SCORE_WITHHELD_MESSAGE } from "@/components/quiz/runner/types"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { TablePagination } from "@/components/shared/data-table/table-pagination"
import { StatusPill } from "@/components/shared/status-pill"
import { Button } from "@/components/ui/button"
import { PendingRegion } from "@/components/ui/pending-region"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  deleteAllTrainingSessions,
  deleteTrainingSession,
  loadTrainingHistory,
} from "@/features/training/actions"
import type {
  TrainingHistoryItem,
  TrainingHistoryPage,
} from "@/features/training/dal"
import { formatMediumDate } from "@/lib/format"
import { callAction } from "@/lib/safe-action"
import { formatScore, scoreTextClass } from "@/lib/score"
import { cn } from "@/lib/utils"

// Zone de toucher de 44 px des boutons de 32 px des lignes (`design-system.md`).
const TOUCH =
  "relative max-md:after:absolute max-md:after:-inset-2.5 max-md:after:content-['']"

const ModePill = ({ mode }: { mode: TrainingHistoryItem["mode"] }) =>
  mode === "tutor" ? (
    <StatusPill tone="success">Tuteur</StatusPill>
  ) : (
    <StatusPill tone="info">Test</StatusPill>
  )

const Score = ({ score }: { score: number | null }) => {
  if (score === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            data-testid="history-score-withheld"
            aria-label={`Score retenu. ${SCORE_WITHHELD_MESSAGE}.`}
            className="text-ink-2 focus-ring inline-flex cursor-help items-center gap-1.5 rounded-xs text-[13px]"
          >
            <Hourglass aria-hidden className="size-3.5" />
            Score retenu
          </span>
        </TooltipTrigger>
        <TooltipContent>{SCORE_WITHHELD_MESSAGE}</TooltipContent>
      </Tooltip>
    )
  }
  return (
    <span
      data-testid="history-score"
      className={cn("font-mono tabular-nums", scoreTextClass(score))}
    >
      {formatScore(score)}
    </span>
  )
}

const Actions = ({
  item,
  onDelete,
}: {
  item: TrainingHistoryItem
  onDelete: (item: TrainingHistoryItem) => void
}) => (
  <span className="inline-flex items-center gap-1">
    <Button asChild variant="ghost" size="sm" className={TOUCH}>
      <Link href={`/tableau-de-bord/entrainement/${item.id}/resultats`}>
        Revoir
        <span className="sr-only">
          {" "}
          : série du {formatMediumDate(item.completedAt ?? item.startedAt)}
        </span>
      </Link>
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Supprimer cette série"
      onClick={() => onDelete(item)}
      className={cn("text-ink-3 hover:text-danger-ink", TOUCH)}
    >
      <Trash2 aria-hidden className="size-3.5" />
    </Button>
  </span>
)

/**
 * Séries terminées : tableau paginé (10 par page) dès 1100 px, lignes
 * empilées en dessous. Une suppression relit la page courante : le total et
 * la pagination restent justes.
 */
export const TrainingHistorySection = ({
  initialHistory,
}: {
  initialHistory: TrainingHistoryPage
}) => {
  const [history, setHistory] = useState(initialHistory)
  const [isPending, startTransition] = useTransition()
  const [toDelete, setToDelete] = useState<TrainingHistoryItem | null>(null)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)

  const { items, total, page, pageSize } = history

  const load = (nextPage: number) =>
    startTransition(async () => {
      try {
        setHistory(await loadTrainingHistory({ page: nextPage }))
      } catch {
        toast.error(
          "Impossible de charger l'historique. Vérifiez votre réseau.",
        )
      }
    })

  // Après une suppression, la page courante peut avoir disparu : on relit la
  // dernière page qui existe encore. L'action a déjà revalidé la route ; un
  // refresh en plus rechargerait tout le segment sans rien changer ici.
  const reloadAfterDelete = (removed: number) => {
    const remaining = Math.max(0, total - removed)
    const lastPage = Math.max(1, Math.ceil(remaining / pageSize))
    load(Math.min(page, lastPage))
  }

  const deleteOne = async () => {
    if (!toDelete) return false
    const res = await callAction(() =>
      deleteTrainingSession({ sessionId: toDelete.id }),
    )
    if (!res.success) {
      toast.error(res.error ?? "Erreur lors de la suppression")
      return false
    }
    toast.success("Série supprimée")
    reloadAfterDelete(1)
  }

  const deleteAll = async () => {
    const res = await callAction(() => deleteAllTrainingSessions())
    if (!res.success) {
      toast.error(res.error ?? "Erreur lors de la suppression")
      return false
    }
    toast.success(
      `${res.deletedCount} série${res.deletedCount > 1 ? "s" : ""} supprimée${res.deletedCount > 1 ? "s" : ""}`,
    )
    reloadAfterDelete(total)
  }

  return (
    <section
      aria-labelledby="training-history-title"
      className="bg-surface border-line shadow-1 flex flex-col rounded-lg border"
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 md:px-6">
        <div className="flex flex-col gap-1">
          <p className="type-label">Historique</p>
          <h2 id="training-history-title" className="type-h4 text-ink">
            Séries précédentes
          </h2>
        </div>
        {total > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteAllOpen(true)}
            className="text-ink-2 hover:text-danger-ink max-md:h-11"
          >
            <Trash2 aria-hidden className="size-3.5" />
            Tout supprimer
          </Button>
        )}
      </div>

      {total === 0 ? (
        <p className="text-ink-3 border-line border-t px-5 py-7 text-sm md:px-6">
          Aucune série pour le moment.
        </p>
      ) : (
        <PendingRegion isPending={isPending}>
          <Table className="border-line hidden border-t min-[1100px]:table">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5 md:pl-6">Date</TableHead>
                <TableHead>Domaine</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Questions</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="pr-5 text-right md:pr-6">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} data-testid="history-row">
                  <TableCell className="text-ink-3 pl-5 font-mono whitespace-nowrap md:pl-6">
                    {formatMediumDate(item.completedAt ?? item.startedAt)}
                  </TableCell>
                  <TableCell className="text-ink font-medium">
                    {item.domain ?? "Tous les domaines"}
                  </TableCell>
                  <TableCell>
                    <ModePill mode={item.mode} />
                  </TableCell>
                  <TableCell className="text-ink-2 text-right font-mono tabular-nums">
                    {item.questionCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <Score score={item.score} />
                  </TableCell>
                  <TableCell className="pr-5 text-right md:pr-6">
                    <Actions item={item} onDelete={setToDelete} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <ul className="border-line border-t min-[1100px]:hidden">
            {items.map((item) => (
              <li
                key={item.id}
                data-testid="history-row"
                className="border-line flex flex-col gap-1.5 border-t px-5 py-3.5 first:border-t-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-ink min-w-0 text-[15px] font-medium">
                    {item.domain ?? "Tous les domaines"}
                  </span>
                  <Score score={item.score} />
                </div>
                <div className="text-ink-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]">
                  <span className="font-mono">
                    {formatMediumDate(item.completedAt ?? item.startedAt)}
                  </span>
                  <ModePill mode={item.mode} />
                  <span className="font-mono">
                    {item.questionCount} questions
                  </span>
                </div>
                <div className="-ml-2">
                  <Actions item={item} onDelete={setToDelete} />
                </div>
              </li>
            ))}
          </ul>

          {total > pageSize && (
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={load}
              isLoading={isPending}
              itemNoun={{ one: "série", many: "séries" }}
              summary="page"
              className="px-5 md:px-6"
            />
          )}
        </PendingRegion>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null)
        }}
        variant="destructive"
        title="Supprimer cette série ?"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        pendingLabel="Suppression…"
        onConfirm={deleteOne}
      />
      <ConfirmDialog
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        variant="destructive"
        title="Supprimer tout l'historique ?"
        description="Les séries terminées et leurs résultats seront supprimés. Vos réponses d'examens blancs et vos questions marquées restent prises en compte dans la révision ciblée."
        confirmLabel="Tout supprimer"
        pendingLabel="Suppression…"
        onConfirm={deleteAll}
      />
    </section>
  )
}
