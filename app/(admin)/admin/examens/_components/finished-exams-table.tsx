"use client"

import { ChevronDown } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import ExamStatusBadge from "@/components/admin/exam-status-badge"
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table/data-table"
import { LinkPendingIndicator } from "@/components/shared/link-pending-indicator"
import { Button } from "@/components/ui/button"
import { examHref } from "@/constants/exam-routes"
import { shortWindow } from "@/lib/exam-readiness"
import { NBSP } from "@/lib/format"
import { PASS_THRESHOLD, formatScore, scoreTextClass } from "@/lib/score"
import { TOUCH_TARGET } from "@/lib/touch-target"
import { cn } from "@/lib/utils"
import { ExamTitleLink } from "./exam-title-link"
import type { OverviewExam } from "./exams-overview-model"
import { RECENT_FINISHED, passRateLabel } from "./exams-overview-model"

const PASS_LABEL = `Réussite ≥ ${PASS_THRESHOLD}${NBSP}%`

const LeaderboardLink = ({ exam }: { exam: OverviewExam }) => (
  <Button asChild size="sm" variant="ghost" className={TOUCH_TARGET}>
    <Link
      href={examHref(exam.id)}
      prefetch={false}
      aria-label={`Classement de ${exam.title}`}
      data-testid={`btn-leaderboard-${exam.id}`}
    >
      Classement
      <LinkPendingIndicator className="inline-flex" />
    </Link>
  </Button>
)

const Average = ({ value }: { value: number | null }) => (
  <span className={cn("font-mono", scoreTextClass(value))}>
    {formatScore(value)}
  </span>
)

const columns: DataTableColumn<OverviewExam>[] = [
  {
    id: "title",
    label: "Examen",
    cell: (e) => (
      <ExamTitleLink id={e.id} className="font-medium">
        {e.title}
      </ExamTitleLink>
    ),
  },
  {
    id: "window",
    label: "Fenêtre",
    cell: (e) => shortWindow(e),
    cellClassName: "text-ink-2 whitespace-nowrap",
  },
  {
    id: "participants",
    label: "Participants",
    className: "text-right",
    cellClassName: "font-mono",
    cell: (e) => e.figures.submitted,
  },
  {
    id: "average",
    label: "Moyenne",
    className: "text-right",
    cell: (e) => <Average value={e.figures.average} />,
  },
  {
    id: "passRate",
    label: PASS_LABEL,
    className: "text-right whitespace-nowrap",
    cellClassName: "font-mono",
    cell: (e) => passRateLabel(e.figures),
  },
  {
    id: "status",
    label: "Statut",
    cell: (e) => <ExamStatusBadge status={e.phase} />,
  },
]

const StackedRow = ({ exam }: { exam: OverviewExam }) => (
  <li className="border-line flex flex-col gap-2 border-t px-4 py-3 first:border-t-0">
    <div className="flex items-start justify-between gap-3">
      <ExamTitleLink id={exam.id} className="text-sm font-medium">
        {exam.title}
      </ExamTitleLink>
      <ExamStatusBadge status={exam.phase} />
    </div>
    <dl className="text-ink-3 grid grid-cols-3 gap-2 text-xs">
      <div className="flex flex-col">
        <dt>Participants</dt>
        <dd className="text-ink font-mono">{exam.figures.submitted}</dd>
      </div>
      <div className="flex flex-col">
        <dt>Moyenne</dt>
        <dd>
          <Average value={exam.figures.average} />
        </dd>
      </div>
      <div className="flex flex-col">
        <dt>{PASS_LABEL}</dt>
        <dd className="text-ink font-mono">{passRateLabel(exam.figures)}</dd>
      </div>
    </dl>
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-3 font-mono text-xs">{shortWindow(exam)}</span>
      <LeaderboardLink exam={exam} />
    </div>
  </li>
)

export const FinishedExamsTable = ({
  exams,
}: {
  exams: readonly OverviewExam[]
}) => {
  const [showAll, setShowAll] = useState(false)
  const rows = showAll ? [...exams] : exams.slice(0, RECENT_FINISHED)

  return (
    <div className="flex flex-col gap-3">
      <div
        className="bg-surface border-line shadow-1 overflow-hidden rounded-lg border"
        data-testid="finished-exams"
      >
        <div className="max-lg:hidden">
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(e) => e.id}
            action={{
              label: "Classement",
              cell: (e) => <LeaderboardLink exam={e} />,
            }}
            className="rounded-none border-0"
          />
        </div>
        <ul className="lg:hidden">
          {rows.map((exam) => (
            <StackedRow key={exam.id} exam={exam} />
          ))}
        </ul>
      </div>
      {!showAll && exams.length > RECENT_FINISHED && (
        <div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={TOUCH_TARGET}
            onClick={() => setShowAll(true)}
            data-testid="btn-show-all-finished"
          >
            Afficher les {exams.length} examens terminés
            <ChevronDown aria-hidden />
          </Button>
        </div>
      )}
    </div>
  )
}
