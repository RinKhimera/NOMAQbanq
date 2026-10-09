"use client"

import { ArrowRight, Lock, Mail, Play } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { StatusPill } from "@/components/shared/status-pill"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { ExamListItem } from "@/features/exams/dal"
import { pauseRemainingMs } from "@/lib/attempt-clock"
import {
  type OpenExamState,
  budgetExhausted,
  shownRemainingMs,
} from "@/lib/exam-list"
import {
  formatCountdown,
  formatDateTime,
  formatDayMonth,
  formatDeadline,
  formatMediumDate,
  formatShortDuration,
} from "@/lib/format"
import { TONE_COLOR, type Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

const DAY_MS = 24 * 60 * 60 * 1000

const BADGE: Record<OpenExamState, { tone: Tone; label: string }> = {
  eligible: { tone: "success", label: "Ouvert maintenant" },
  locked: { tone: "success", label: "Ouvert maintenant" },
  started: { tone: "warning", label: "En cours" },
  paused: { tone: "neutral", label: "En pause" },
  elapsed: { tone: "danger", label: "Temps écoulé" },
  suspended: { tone: "danger", label: "Suspendu" },
  submitted: { tone: "neutral", label: "Soumis" },
}

/** Examen suspendu (`CONTEXT.md`) : visible, mais personne ne le commence. */
export const SuspendedTag = () => (
  <StatusPill tone={BADGE.suspended.tone}>{BADGE.suspended.label}</StatusPill>
)

/** Repère d'un examen sur invitation (passable sans abonnement). */
export const InviteTag = () => (
  <span className="text-ink-3 inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
    <Mail aria-hidden className="size-3.5" />
    Sur invitation
  </span>
)

/** « 25 sept. → 28 sept. 2026 » */
export const examWindow = (exam: Pick<ExamListItem, "startDate" | "endDate">) =>
  `${formatDayMonth(exam.startDate)} → ${formatMediumDate(exam.endDate)}`

const Big = ({
  children,
  warning,
}: {
  children: ReactNode
  warning?: boolean
}) => (
  <span
    className={cn(
      "font-serif text-[2rem] leading-tight font-semibold tabular-nums",
      warning ? "text-warning-ink" : "text-ink",
    )}
  >
    {children}
  </span>
)

const Sub = ({
  children,
  warning,
}: {
  children: ReactNode
  warning?: boolean
}) => (
  <p
    className={cn(
      "text-sm leading-snug text-pretty",
      warning ? "text-warning-ink" : "text-ink-3",
    )}
  >
    {children}
  </p>
)

const Answered = ({
  answered,
  total,
  tone,
}: {
  answered: number
  total: number
  tone: "warning" | "neutral"
}) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex justify-between text-sm">
      <span className="text-ink-2">Répondues</span>
      <span className="text-ink font-mono whitespace-nowrap tabular-nums">
        {answered} / {total}
      </span>
    </div>
    <Progress
      value={total > 0 ? (answered / total) * 100 : 0}
      indicatorColor={TONE_COLOR[tone]}
      className="h-1.5"
      aria-label="Questions répondues"
    />
  </div>
)

type OpenExamCardProps = {
  exam: ExamListItem
  state: Exclude<OpenExamState, "submitted">
  now: number
  /** Plusieurs examens ouverts : cartes côte à côte, sans description. */
  compact: boolean
  onStart: (exam: ExamListItem) => void
}

/** Examen ouvert, mis en avant : fenêtre, chiffres, et l'action de son état. */
export const OpenExamCard = ({
  exam,
  state,
  now,
  compact,
  onStart,
}: OpenExamCardProps) => {
  const closeLeft = Math.max(0, exam.endDate - now)
  const closingSoon = closeLeft < DAY_MS
  const p = exam.userParticipation
  const evaluationHref = `/tableau-de-bord/examen-blanc/${exam.id}/evaluation`
  const badge = BADGE[state]
  // Réservé aux abonnés avec une participation dont le temps est écoulé : rien
  // à reprendre, la clôture viendra du cron à la fermeture.
  const lockedAfterBudget =
    state === "locked" && p !== null && budgetExhausted(p, now)

  let side: ReactNode
  if (state === "suspended") {
    side = (
      <div className="flex flex-col gap-0.5">
        <span className="type-label">Suspendu</span>
        <Sub>
          L&apos;examen ne peut pas être commencé pour le moment. Il ferme le{" "}
          {formatDeadline(exam.endDate)}.
        </Sub>
      </div>
    )
  } else if (state === "eligible" || state === "locked") {
    side = (
      <>
        <div className="flex flex-col gap-0.5">
          <span className={cn("type-label", closingSoon && "text-warning-ink")}>
            Fermeture dans
          </span>
          <Big warning={closingSoon}>{formatCountdown(closeLeft)}</Big>
          <Sub>Ferme le {formatDeadline(exam.endDate)}</Sub>
        </div>
        {state === "eligible" ? (
          <Button
            size="lg"
            onClick={() => onStart(exam)}
            className="w-full"
            data-testid="btn-start-exam-card"
          >
            <Play aria-hidden />
            Commencer l&apos;examen
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-ink-2 inline-flex items-center gap-1.5 text-sm">
              <Lock aria-hidden className="size-3.5" />
              Réservé aux abonnés
            </span>
            {lockedAfterBudget && (
              <Sub>
                Temps écoulé : votre participation sera soumise à la fermeture
                de l&apos;examen.
              </Sub>
            )}
            <Button asChild size="lg" variant="outline" className="w-full">
              <Link href="/tarifs">
                {p && !lockedAfterBudget
                  ? "Prolonger l'accès pour reprendre"
                  : p
                    ? "Prolonger l'accès"
                    : "Voir les tarifs"}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        )}
      </>
    )
  } else if (state === "elapsed") {
    side = (
      <>
        <div className="flex flex-col gap-0.5">
          <span className="type-label">Chronomètre</span>
          <Big>Temps écoulé</Big>
          <Sub>Votre participation est en cours de soumission automatique.</Sub>
        </div>
        {p && (
          <Answered
            answered={p.answeredCount}
            total={exam.questionCount}
            tone="neutral"
          />
        )}
        <Button asChild size="lg" className="w-full">
          <Link href={evaluationHref}>
            Voir la soumission
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </>
    )
  } else {
    const timing = p?.timing
    const shown = timing
      ? shownRemainingMs(exam, timing, now)
      : { ms: closeLeft, limitedByClosing: false }
    const pauseLeft =
      state === "paused" && timing?.pauseInProgress
        ? pauseRemainingMs(timing.pauseInProgress, now)
        : 0
    side = (
      <>
        <div className="flex flex-col gap-0.5">
          <span className="type-label">Temps restant</span>
          <Big warning={shown.limitedByClosing}>
            {formatCountdown(shown.ms)}
          </Big>
          {state === "paused" && (
            <Sub>
              Le chronomètre de l&apos;examen est arrêté. Reprise automatique
              dans {Math.max(1, Math.ceil(pauseLeft / 60_000))} min.
            </Sub>
          )}
          {shown.limitedByClosing ? (
            <Sub warning>L&apos;examen ferme avant la fin de votre temps.</Sub>
          ) : (
            state === "started" && <Sub>Le chronomètre continue.</Sub>
          )}
        </div>
        {p && (
          <Answered
            answered={p.answeredCount}
            total={exam.questionCount}
            tone="warning"
          />
        )}
        <Button asChild size="lg" className="w-full">
          <Link href={evaluationHref}>
            <Play aria-hidden />
            Reprendre l&apos;examen
          </Link>
        </Button>
      </>
    )
  }

  return (
    <section
      data-testid={`exam-card-${exam.id}`}
      data-state={state}
      aria-label={`Examen ouvert : ${exam.title}`}
      className={cn(
        "bg-surface border-line-strong border-l-accent rounded-lg border border-l-[3px]",
        compact ? "flex flex-col p-5 md:p-6" : "p-5 md:px-8 md:py-7",
      )}
    >
      <div
        className={cn(
          "grid gap-6 lg:items-end",
          !compact && "lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)] lg:gap-8",
          compact && "flex-1 content-between",
        )}
      >
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={badge.tone}>{badge.label}</StatusPill>
            {exam.audienceType === "restricted" && <InviteTag />}
            <span className="text-ink-3 font-mono text-xs">
              {examWindow(exam)}
            </span>
          </div>
          <h2
            className={cn(
              "text-ink text-pretty wrap-anywhere",
              compact ? "type-h3" : "type-h2",
            )}
          >
            {exam.title}
          </h2>
          {!compact && exam.description && (
            <p className="text-ink-2 max-w-140 text-base leading-relaxed">
              {exam.description}
            </p>
          )}
          <dl className="flex flex-wrap gap-x-7 gap-y-2 pt-1">
            {[
              ["Questions", String(exam.questionCount)],
              ["Durée", formatShortDuration(exam.completionTime * 1000)],
              [
                "Pause",
                exam.enablePause && exam.pauseDurationMinutes
                  ? `${exam.pauseDurationMinutes} min`
                  : "aucune",
              ],
              ["Tentative", "1"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="type-label">{label}</dt>
                <dd className="text-ink font-mono text-base tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div
          className={cn(
            "flex flex-col gap-4",
            compact
              ? "border-line border-t pt-4"
              : "border-line border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8",
          )}
        >
          {side}
        </div>
      </div>
    </section>
  )
}

type SubmittedExamCardProps = {
  exam: ExamListItem
  completedAt: number | null
}

/** Participation soumise à un examen encore ouvert : ni score ni bouton. */
export const SubmittedExamCard = ({
  exam,
  completedAt,
}: SubmittedExamCardProps) => (
  <section
    data-testid={`exam-card-${exam.id}`}
    data-state="submitted"
    aria-label={`Examen soumis : ${exam.title}`}
    className="bg-surface border-line flex flex-col gap-2.5 self-start rounded-lg border p-5 md:p-6"
  >
    <div className="flex flex-wrap items-center gap-2">
      <StatusPill tone="neutral">Soumis</StatusPill>
      {exam.audienceType === "restricted" && <InviteTag />}
      <span className="text-ink-3 font-mono text-xs">{examWindow(exam)}</span>
    </div>
    <h2 className="type-h4 text-ink text-pretty wrap-anywhere">{exam.title}</h2>
    <div className="flex flex-col gap-0.5 text-sm leading-normal">
      {completedAt !== null && (
        <span className="text-ink-2">
          Soumis le{" "}
          <span className="text-ink font-mono">
            {formatDateTime(completedAt)}
          </span>
          .
        </span>
      )}
      <span className="text-ink-3">
        Résultats publiés le {formatDeadline(exam.endDate)}.
      </span>
    </div>
  </section>
)
