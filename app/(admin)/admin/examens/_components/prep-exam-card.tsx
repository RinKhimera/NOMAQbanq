import { Check, CircleAlert, ListChecks, Pencil } from "lucide-react"
import Link from "next/link"
import ExamStatusBadge from "@/components/admin/exam-status-badge"
import { LinkPendingIndicator } from "@/components/shared/link-pending-indicator"
import { StatusPill } from "@/components/shared/status-pill"
import { Button } from "@/components/ui/button"
import {
  calendarDaysUntil,
  examReadiness,
  isLateToOpen,
  readinessSummary,
} from "@/lib/exam-readiness"
import { formatDayMonth } from "@/lib/format"
import { TONE_COLOR } from "@/lib/tone"
import { TOUCH_TARGET } from "@/lib/touch-target"
import { cn } from "@/lib/utils"
import { examEditHref } from "./exam-routes"
import { ExamTitleLink } from "./exam-title-link"
import type { OverviewExam } from "./exams-overview-model"
import { inDaysLabel } from "./exams-overview-model"

const OpeningLine = ({ exam, now }: { exam: OverviewExam; now: number }) => {
  if (exam.startDate === null) return null
  if (isLateToOpen(exam, now)) {
    return (
      <span className="text-danger-ink font-mono text-xs">
        devait ouvrir le {formatDayMonth(exam.startDate)}
      </span>
    )
  }
  const days = calendarDaysUntil(exam.startDate, now)
  return (
    <span className="text-ink-3 font-mono text-xs">
      {days <= 0 ? "ouvre aujourd'hui" : `ouvre ${inDaysLabel(days)}`} ·{" "}
      {formatDayMonth(exam.startDate)}
    </span>
  )
}

export const PrepExamCard = ({
  exam,
  now,
}: {
  exam: OverviewExam
  now: number
}) => {
  const checks = examReadiness(
    { ...exam, audienceSize: exam.figures.eligible },
    now,
  )
  const summary = readinessSummary(checks)
  const blocking = checks.some((c) => !c.ok && c.tone === "danger")
  const inPreparation = exam.phase === "preparation"
  const ActionIcon = inPreparation ? ListChecks : Pencil

  return (
    <article
      aria-label={exam.title}
      data-testid={`prep-exam-card-${exam.id}`}
      data-blocking={blocking || undefined}
      className={cn(
        "bg-surface shadow-1 flex flex-col gap-3.5 rounded-lg border p-5",
        blocking ? "border-danger-line" : "border-line",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <ExamTitleLink
            id={exam.id}
            className="self-start text-base font-semibold"
          >
            {exam.title}
          </ExamTitleLink>
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <ExamStatusBadge status={exam.phase} />
            <OpeningLine exam={exam} now={now} />
          </span>
        </div>
        <StatusPill
          tone={summary.tone}
          data-testid="readiness-summary"
          className="mt-0.5"
        >
          <span
            aria-hidden
            className="size-1.5 rounded-full"
            style={{ backgroundColor: TONE_COLOR[summary.tone] }}
          />
          {summary.label}
        </StatusPill>
      </div>

      <ul className="flex flex-col">
        {checks.map((check) => (
          <li
            key={check.key}
            data-testid={`readiness-${check.key}`}
            data-ok={check.ok}
            className="border-line grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5 border-t py-2 text-sm first:border-t-0"
          >
            {check.ok ? (
              <Check
                className="size-3.75"
                style={{ color: TONE_COLOR.success }}
                aria-label="Vérifié"
              />
            ) : (
              <CircleAlert
                className="size-3.75"
                style={{ color: TONE_COLOR[check.tone] }}
                aria-label={check.tone === "danger" ? "Bloquant" : "À vérifier"}
              />
            )}
            <span className="text-ink-2">{check.label}</span>
            <span className="text-ink text-right font-mono">{check.value}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-wrap gap-2">
        <Button
          asChild
          size="sm"
          variant={inPreparation ? "default" : "outline"}
          className={TOUCH_TARGET}
        >
          <Link
            href={examEditHref(exam.id)}
            prefetch={false}
            data-testid={inPreparation ? "btn-finalize-exam" : "btn-edit-exam"}
          >
            <ActionIcon aria-hidden />
            {inPreparation ? "Finaliser" : "Modifier"}
            <LinkPendingIndicator className="inline-flex" />
          </Link>
        </Button>
      </div>
    </article>
  )
}
