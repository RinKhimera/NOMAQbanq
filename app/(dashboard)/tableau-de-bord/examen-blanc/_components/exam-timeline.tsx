"use client"

import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Hourglass,
  TimerOff,
} from "lucide-react"
import Link from "next/link"
import { type ReactNode, memo, useState } from "react"
import { StatusPill } from "@/components/shared/status-pill"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { studentExamRankingHref } from "@/constants/exam-routes"
import type { ExamListItem } from "@/features/exams/dal"
import { toAppZoneCalendarDay } from "@/lib/app-zone"
import { VISIBLE_MONTHS, groupByMonth, pastScoreState } from "@/lib/exam-list"
import {
  formatCountdown,
  formatDateTime,
  formatDayMonth,
  formatDeadline,
  formatMonthYear,
  formatShortDuration,
} from "@/lib/format"
import { formatScore, scoreTextClass, scoreTone } from "@/lib/score"
import { TONE_COLOR } from "@/lib/tone"
import { TOUCH_TARGET } from "@/lib/touch-target"
import { cn } from "@/lib/utils"
import { InviteTag, SuspendedTag } from "./open-exam-card"

const HOUR_MS = 60 * 60 * 1000

const Section = ({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: ReactNode
}) => (
  <section className="flex flex-col gap-3">
    <div className="flex items-baseline gap-2">
      <h2 className="type-h4 text-ink">{title}</h2>
      <span className="text-ink-3 font-mono text-sm">{count}</span>
    </div>
    {children}
  </section>
)

/** Jour sur mois, en bloc : repère de date d'une ligne. */
const DateBlock = ({ at }: { at: number }) => {
  const [day, month] = formatDayMonth(at).split(" ")
  return (
    <div className="border-line bg-surface-2 flex flex-col items-center rounded-md border py-1.5">
      <span className="text-ink font-serif text-xl leading-tight font-semibold">
        {day.padStart(2, "0")}
      </span>
      <span className="type-label">{month.replace(".", "")}</span>
    </div>
  )
}

const Row = ({
  exam,
  date,
  meta,
  tags,
  score,
  action,
}: {
  exam: ExamListItem
  date: number
  meta: string
  tags?: ReactNode
  score: ReactNode
  action?: ReactNode
}) => (
  <li
    data-testid={`exam-row-${exam.id}`}
    className="border-line grid grid-cols-[3.25rem_minmax(0,1fr)_minmax(0,220px)_7.5rem] items-center gap-4 border-t px-4 py-3 first:border-t-0 max-md:grid-cols-[3rem_minmax(0,1fr)] max-md:gap-x-3 max-md:gap-y-2"
  >
    <DateBlock at={date} />
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-ink text-base leading-snug font-medium text-pretty wrap-anywhere">
        {exam.title}
      </span>
      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
        <span className="text-ink-3 font-mono text-xs">{meta}</span>
        {exam.audienceType === "restricted" && <InviteTag />}
        {tags}
      </span>
    </div>
    <div className="flex items-center gap-2.5 max-md:col-start-2">{score}</div>
    <div className="flex justify-end max-md:col-start-2 max-md:justify-start max-md:empty:hidden">
      {action}
    </div>
  </li>
)

const List = ({ children }: { children: ReactNode }) => (
  <ul className="bg-surface border-line rounded-lg border">{children}</ul>
)

const examMeta = (exam: ExamListItem) =>
  `${exam.questionCount} questions · ${formatShortDuration(exam.completionTime * 1000)}`

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

type UpcomingProps = { exams: ExamListItem[]; now: number }

/** Lignes « À venir » : bloc date d'ouverture, fenêtre, « Ouvre dans … » sous l'heure. */
export const UpcomingExams = ({ exams, now }: UpcomingProps) => {
  if (exams.length === 0) return null
  return (
    <Section title="À venir" count={exams.length}>
      <List>
        {exams.map((exam) => {
          const opensIn = exam.startDate - now
          return (
            <Row
              key={exam.id}
              exam={exam}
              date={exam.startDate}
              meta={`Ouverture le ${formatDateTime(exam.startDate)} · fermeture le ${formatDeadline(exam.endDate)}`}
              score={
                exam.isActive ? (
                  <StatusPill tone="info">
                    {opensIn < HOUR_MS
                      ? `Ouvre dans ${formatCountdown(opensIn)}`
                      : "À venir"}
                  </StatusPill>
                ) : (
                  <SuspendedTag />
                )
              }
            />
          )
        })}
      </List>
    </Section>
  )
}

type PastProps = {
  exams: ExamListItem[]
}

/**
 * Lignes « Terminés » groupées par mois de fermeture ; les mois anciens
 * repliés. Mémoïsé : la page se rend à la seconde pour les décomptes, ces
 * lignes n'en dépendent pas.
 */
export const PastExams = memo(function PastExams({ exams }: PastProps) {
  const [showAll, setShowAll] = useState(false)
  if (exams.length === 0) return null

  const months = groupByMonth(exams, (d) => toAppZoneCalendarDay(d).slice(0, 7))
  const shown = showAll ? months : months.slice(0, VISIBLE_MONTHS)
  const hidden = months.slice(VISIBLE_MONTHS)
  const hiddenCount = hidden.reduce((n, m) => n + m.items.length, 0)

  return (
    <Section title="Terminés" count={exams.length}>
      <List>
        {shown.map((month) => (
          <li key={month.key} className="border-line border-t first:border-t-0">
            <p className="type-label bg-surface-2 border-line border-b px-4 pt-2.5 pb-2 first:rounded-t-lg">
              {capitalize(formatMonthYear(month.items[0].endDate))}
            </p>
            <ul>
              {month.items.map((exam) => (
                <PastRow key={exam.id} exam={exam} />
              ))}
            </ul>
          </li>
        ))}
        {hidden.length > 0 && (
          <li className="border-line border-t p-1.5">
            <Button
              variant="ghost"
              onClick={() => setShowAll((v) => !v)}
              className="w-full max-md:h-11"
              aria-expanded={showAll}
            >
              {showAll ? (
                <ChevronUp aria-hidden />
              ) : (
                <ChevronDown aria-hidden />
              )}
              {showAll ? (
                `Afficher seulement les ${VISIBLE_MONTHS} derniers mois`
              ) : (
                <>
                  Afficher les mois précédents
                  <span className="text-ink-3 font-mono text-xs max-sm:hidden">
                    ({hidden.length} mois · {hiddenCount} examen
                    {hiddenCount > 1 ? "s" : ""})
                  </span>
                </>
              )}
            </Button>
          </li>
        )}
      </List>
    </Section>
  )
})

const PastRow = ({ exam }: { exam: ExamListItem }) => {
  const p = exam.userParticipation
  const state = pastScoreState(p)
  const hasResults = state.kind === "score" || state.kind === "withheld"

  let score: ReactNode
  switch (state.kind) {
    case "score":
      score = (
        <>
          <Progress
            value={state.score}
            indicatorColor={TONE_COLOR[scoreTone(state.score)]}
            className="h-1.5 min-w-15 flex-1"
            aria-label={`Score : ${state.score} %`}
          />
          <span
            data-testid="exam-score"
            className={cn(
              "w-11 text-right font-mono text-sm tabular-nums",
              scoreTextClass(state.score),
            )}
          >
            {formatScore(state.score)}
          </span>
        </>
      )
      break
    case "withheld": {
      const message = p?.withheldBy
        ? `Publié à la fermeture de ${p.withheldBy}.`
        : "Publié à la fermeture de l'examen blanc encore ouvert."
      score = (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              data-testid="exam-score-withheld"
              aria-label={`Score retenu. ${message}`}
              className="text-ink-2 focus-ring inline-flex cursor-help items-center gap-1.5 rounded-xs text-sm"
            >
              <Hourglass aria-hidden className="size-3.5" />
              Score retenu
            </span>
          </TooltipTrigger>
          <TooltipContent>{message}</TooltipContent>
        </Tooltip>
      )
      break
    }
    case "closing":
      score = (
        <span className="text-ink-2 text-sm">
          Résultats en cours de publication
        </span>
      )
      break
    default:
      score = <span className="text-ink-3 text-sm">Non passé</span>
  }

  return (
    <Row
      exam={exam}
      date={exam.endDate}
      meta={examMeta(exam)}
      tags={
        p?.status === "auto_submitted" && (
          <span className="text-ink-3 inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
            <TimerOff aria-hidden className="size-3.5" />
            Soumis automatiquement
          </span>
        )
      }
      score={score}
      action={
        hasResults && (
          <Button asChild size="sm" variant="ghost" className={TOUCH_TARGET}>
            <Link href={studentExamRankingHref(exam.id)}>
              Résultats
              <span className="sr-only"> : {exam.title}</span>
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        )
      }
    />
  )
}
