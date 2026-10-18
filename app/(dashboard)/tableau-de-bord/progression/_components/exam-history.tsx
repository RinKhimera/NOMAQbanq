"use client"

import { GraduationCap } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { SCORE_WITHHELD_MESSAGE } from "@/components/quiz/runner/types"
import { KeysetPagination } from "@/components/shared/data-table/keyset-pagination"
import { LinkPendingIndicator } from "@/components/shared/link-pending-indicator"
import { StatusPill } from "@/components/shared/status-pill"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
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
  examCopyHref,
  studentExamRankingHref,
  studentExamResultsHref,
} from "@/constants/exam-routes"
import type {
  ExamPercentiles,
  MyExamHistoryPage,
} from "@/features/analytics/dal"
import { canReadResults, isOpen } from "@/lib/exam-phase"
import { formatDayMonth } from "@/lib/format"
import {
  AFTER_PARAM,
  BEFORE_PARAM,
  EXAM_HISTORY_PAGE_SIZE,
} from "@/lib/progression"
import { formatScore, isPassing, scoreTextClass } from "@/lib/score"
import { cn } from "@/lib/utils"

/**
 * Toutes les participations soumises, 10 par page. Un score retenu se lit
 * « À la clôture », sans verdict, percentile ni lien vers les résultats.
 * `copyOf` (vue admin d'un étudiant) mène chaque ligne, ouverte comprise, à
 * sa copie admin : le miroir porte sur les chiffres, pas sur les outils.
 */
export const ExamHistory = ({
  history,
  percentiles,
  isAdmin,
  now,
  copyOf,
}: {
  history: MyExamHistoryPage
  percentiles: ExamPercentiles
  isAdmin: boolean
  now: number
  copyOf?: string
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const goTo = (
    param: typeof AFTER_PARAM | typeof BEFORE_PARAM,
    cursor: string,
  ) => {
    const params = new URLSearchParams(searchParams)
    params.delete(AFTER_PARAM)
    params.delete(BEFORE_PARAM)
    params.set(param, cursor)
    startTransition(() => {
      router.push(`${pathname}?${params}`, { scroll: false })
    })
  }

  if (history.total === 0) {
    return (
      <div className="border-line border-t px-5 md:px-6">
        <EmptyState
          size="compact"
          icons={[GraduationCap]}
          title="Aucun examen blanc complété"
          description="Chaque examen blanc soumis s'ajoute à cet historique."
        />
      </div>
    )
  }

  return (
    <PendingRegion isPending={isPending}>
      <Table className="border-line border-t">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5 md:pl-6">Date</TableHead>
            <TableHead>Examen</TableHead>
            <TableHead className="text-right">Questions</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead>Verdict</TableHead>
            <TableHead>Percentile</TableHead>
            <TableHead className="pr-5 md:pr-6">
              <span className="sr-only">Action</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.items.map((p) => {
            const withheld = p.score === null
            const percentile = withheld ? null : (percentiles[p.examId] ?? null)
            const readable =
              !withheld &&
              canReadResults(p, isAdmin ? { role: "admin" } : null, now)
            // Le classement n'existe qu'à la clôture ; un admin lit plus tôt sa correction.
            const resultsHref = isOpen(p, now)
              ? studentExamResultsHref(p.examId)
              : studentExamRankingHref(p.examId)
            return (
              <TableRow key={p.examId} data-testid="exam-history-row">
                <TableCell className="text-ink-3 pl-5 font-mono whitespace-nowrap md:pl-6">
                  {formatDayMonth(p.completedAt)}
                </TableCell>
                <TableCell className="text-ink min-w-48 font-medium">
                  {p.title}
                </TableCell>
                <TableCell className="text-ink-2 text-right font-mono">
                  {p.questionCount}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right whitespace-nowrap",
                    withheld
                      ? "text-ink-3"
                      : cn("font-mono font-medium", scoreTextClass(p.score)),
                  )}
                  title={withheld ? SCORE_WITHHELD_MESSAGE : undefined}
                >
                  {withheld ? "À la clôture" : formatScore(p.score)}
                </TableCell>
                <TableCell>
                  {p.score === null ? (
                    <span className="text-ink-3">—</span>
                  ) : isPassing(p.score) ? (
                    <StatusPill tone="success">Réussi</StatusPill>
                  ) : (
                    <StatusPill tone="danger">À améliorer</StatusPill>
                  )}
                </TableCell>
                <TableCell
                  data-testid="exam-history-percentile"
                  className="text-ink-2 whitespace-nowrap"
                >
                  {percentile === null ? (
                    <span className="text-ink-3">—</span>
                  ) : (
                    <>
                      mieux que{" "}
                      <span className="font-mono">{percentile}&nbsp;%</span>
                    </>
                  )}
                </TableCell>
                <TableCell className="pr-5 text-right md:pr-6">
                  {copyOf ? (
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="max-md:h-11"
                    >
                      <Link
                        href={examCopyHref(p.examId, copyOf)}
                        prefetch={false}
                      >
                        Voir la copie
                        <span className="sr-only"> : {p.title}</span>
                        <LinkPendingIndicator />
                      </Link>
                    </Button>
                  ) : (
                    readable && (
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="max-md:h-11"
                      >
                        <Link href={resultsHref} prefetch={false}>
                          Résultats
                          <span className="sr-only"> : {p.title}</span>
                          <LinkPendingIndicator />
                        </Link>
                      </Button>
                    )
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {history.total > EXAM_HISTORY_PAGE_SIZE && (
        <KeysetPagination
          firstIndex={history.firstIndex}
          count={history.items.length}
          pageSize={EXAM_HISTORY_PAGE_SIZE}
          total={history.total}
          noun={{ one: "examen", many: "examens" }}
          isPending={isPending}
          onPrevious={
            history.prevCursor
              ? () => goTo(BEFORE_PARAM, history.prevCursor!)
              : undefined
          }
          onNext={
            history.nextCursor
              ? () => goTo(AFTER_PARAM, history.nextCursor!)
              : undefined
          }
        />
      )}
    </PendingRegion>
  )
}
