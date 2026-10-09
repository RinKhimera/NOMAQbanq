import ExamStatusBadge from "@/components/admin/exam-status-badge"
import { countLabel } from "@/components/admin/question-detail/labels"
import { Progress } from "@/components/ui/progress"
import { calendarDaysUntil, shortWindow } from "@/lib/exam-readiness"
import { NBSP, formatClockTime, formatDayMonth } from "@/lib/format"
import { TONE_COLOR } from "@/lib/tone"
import { cn } from "@/lib/utils"
import { ExamTitleLink } from "./exam-title-link"
import type { OverviewExam } from "./exams-overview-model"
import { inDaysLabel, submittedPercent } from "./exams-overview-model"

const openParticipationsSentence = (n: number) => {
  if (n === 0) return "Aucune participation encore ouverte."
  return n === 1
    ? "participation encore ouverte sera soumise automatiquement à la fermeture."
    : "participations encore ouvertes seront soumises automatiquement à la fermeture."
}

export const LiveExamCard = ({
  exam,
  now,
}: {
  exam: OverviewExam
  now: number
}) => {
  const { figures } = exam
  const percent = submittedPercent(figures)
  const cells = [
    { label: "Ont commencé", value: figures.started },
    { label: "Soumis", value: figures.submitted },
    { label: "En cours", value: figures.inProgress },
  ]

  const suspended = exam.phase === "suspended"

  return (
    <section
      aria-label={exam.title}
      data-testid={`live-exam-card-${exam.id}`}
      className={cn(
        "bg-surface shadow-1 relative flex flex-col gap-4 overflow-hidden rounded-lg border p-4.5 md:p-6",
        suspended ? "border-danger-line" : "border-success-line",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-0.75",
          suspended ? "bg-danger" : "bg-success",
        )}
      />
      <div className="text-ink-3 flex flex-wrap items-center gap-2 font-mono text-xs">
        <ExamStatusBadge status={exam.phase} />
        <span className="whitespace-nowrap">{shortWindow(exam)}</span>
        {exam.endDate !== null && (
          <span className="whitespace-nowrap">
            · ferme le {formatDayMonth(exam.endDate)} à{" "}
            {formatClockTime(exam.endDate)},{" "}
            {inDaysLabel(calendarDaysUntil(exam.endDate, now))}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 items-end gap-6 lg:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,110px))]">
        <div className="col-span-3 flex min-w-0 flex-col gap-1.5 lg:col-span-1">
          <ExamTitleLink id={exam.id} className="type-h3 self-start">
            {exam.title}
          </ExamTitleLink>
          <p className="text-ink-2 text-sm" data-testid="live-exam-open-count">
            {figures.inProgress > 0 && (
              <span className="text-ink font-mono">{figures.inProgress} </span>
            )}
            {openParticipationsSentence(figures.inProgress)}
          </p>
        </div>
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={
              i === 0
                ? "border-line flex flex-col gap-0.5 max-lg:border-l-0 lg:border-l lg:pl-4"
                : "border-line flex flex-col gap-0.5 border-l pl-4"
            }
          >
            <span className="type-label">{cell.label}</span>
            <span className="text-ink font-serif text-[28px] leading-[1.1] font-semibold">
              {cell.value}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <Progress
          value={percent}
          indicatorColor={TONE_COLOR.success}
          aria-label={`${percent}${NBSP}% des participations commencées soumises`}
          className="h-1.5"
        />
        <span className="text-ink-3 font-mono text-xs">
          {percent}
          {NBSP}% soumis ·{" "}
          {countLabel(figures.eligible, "éligible", "éligibles")}
        </span>
      </div>
    </section>
  )
}
