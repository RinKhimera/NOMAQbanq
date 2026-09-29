import { GraduationCap } from "lucide-react"
import Link from "next/link"
import { SCORE_WITHHELD_MESSAGE } from "@/components/quiz/runner/types"
import { LinkPendingIndicator } from "@/components/shared/link-pending-indicator"
import { StatusPill } from "@/components/shared/status-pill"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  ExamPercentiles,
  RecentParticipation,
} from "@/features/analytics/dal"
import { canReadResults } from "@/lib/exam-phase"
import { formatDayMonth } from "@/lib/format"
import {
  formatPercentile,
  formatScore,
  isPassing,
  scoreTextClass,
} from "@/lib/score"
import { cn } from "@/lib/utils"

const Verdict = ({ score }: { score: number | null }) => {
  if (score === null)
    return (
      <StatusPill tone="neutral" title={SCORE_WITHHELD_MESSAGE}>
        À la clôture
      </StatusPill>
    )
  return isPassing(score) ? (
    <StatusPill tone="success">Réussi</StatusPill>
  ) : (
    <StatusPill tone="danger">À améliorer</StatusPill>
  )
}

type RecentExamsTableProps = {
  participations: RecentParticipation[]
  percentiles: ExamPercentiles
  isAdmin: boolean
  now: number
}

/** Cinq dernières participations soumises ; « Revoir » une fois l'examen clos. */
export const RecentExamsTable = ({
  participations,
  percentiles,
  isAdmin,
  now,
}: RecentExamsTableProps) => {
  if (participations.length === 0) {
    return (
      <div className="border-line border-t px-5 md:px-6">
        <EmptyState
          size="compact"
          icons={[GraduationCap]}
          title="Aucun examen blanc complété"
          description="Vos résultats apparaîtront ici après chaque examen blanc."
        >
          <Button asChild variant="outline" className="max-md:h-11">
            <Link href="/tableau-de-bord/examen-blanc" prefetch={false}>
              Voir les examens blancs
              <LinkPendingIndicator className="ml-2" />
            </Link>
          </Button>
        </EmptyState>
      </div>
    )
  }

  return (
    <Table className="border-line border-t">
      <TableHeader>
        <TableRow>
          <TableHead className="pl-5 md:pl-6">Date</TableHead>
          <TableHead>Examen</TableHead>
          <TableHead className="text-right">Questions</TableHead>
          <TableHead className="text-right">Score</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead className="pr-5 md:pr-6">
            <span className="sr-only">Action</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {participations.map((p) => {
          const percentile = percentiles[p.examId] ?? null
          const readable = canReadResults(
            p,
            isAdmin ? { role: "admin" } : null,
            now,
          )
          return (
            <TableRow key={p.examId}>
              <TableCell className="text-ink-3 pl-5 font-mono whitespace-nowrap md:pl-6">
                {formatDayMonth(p.completedAt)}
              </TableCell>
              <TableCell className="min-w-48">
                <p className="text-ink font-medium">{p.title}</p>
                {percentile !== null && (
                  <p
                    data-testid="exam-percentile"
                    className="text-ink-3 text-xs"
                  >
                    {formatPercentile(percentile)}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-ink-2 text-right font-mono">
                {p.questionCount}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-mono font-medium",
                  scoreTextClass(p.score),
                )}
              >
                {formatScore(p.score)}
              </TableCell>
              <TableCell>
                <Verdict score={p.score} />
              </TableCell>
              <TableCell className="pr-5 text-right md:pr-6">
                {readable && (
                  <Button
                    asChild
                    size="sm"
                    variant="ghost"
                    className="max-md:h-11"
                  >
                    <Link
                      href={`/tableau-de-bord/examen-blanc/${p.examId}/resultats`}
                      prefetch={false}
                    >
                      Revoir
                      <span className="sr-only"> : {p.title}</span>
                      <LinkPendingIndicator />
                    </Link>
                  </Button>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
