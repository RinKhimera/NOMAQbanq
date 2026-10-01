"use client"

import {
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Info,
  TextCursorInput,
  TriangleAlert,
} from "lucide-react"
import Link from "next/link"
import { type ReactNode, useState } from "react"
import ExamStatusBadge from "@/components/admin/exam-status-badge"
import { QuestionCard } from "@/components/quiz/question-card"
import { optionLetter } from "@/components/quiz/question-card/answer-option"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { QuestionAnswerBreakdown } from "@/features/analytics/dal"
import type { QuestionDetail, QuestionExamUse } from "@/features/questions/dal"
import type { KeyReview } from "@/features/questions/key-review"
import type { FormatIssue } from "@/features/questions/normalization"
import { cdnUrl } from "@/lib/cdn"
import { phaseOf } from "@/lib/exam-phase"
import { formatDayMonth, formatLongDate, formatMediumDate } from "@/lib/format"
import { TONE_COLOR, type Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"
import {
  QUESTION_SUCCESS_MIN_ANSWERS,
  answersLabel,
  isSignificant,
  percent,
} from "./labels"

export type QuestionFile = {
  question: QuestionDetail
  breakdown: QuestionAnswerBreakdown
  review: KeyReview
  exams: QuestionExamUse[]
  /** Motifs de mise en forme relevés sur l'explication et les références. */
  formatIssues: FormatIssue[]
}

const EXAMS_SHOWN = 5

/** L'option actuelle la plus choisie hors clé (index dans les options). */
export const topWrongOption = (breakdown: QuestionAnswerBreakdown) => {
  let top = -1
  breakdown.options.forEach((o, i) => {
    if (!o.isKey && (top < 0 || o.count > breakdown.options[top].count)) top = i
  })
  return top
}

const Section = ({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}) => (
  <section className="bg-surface border-line flex min-w-0 flex-col gap-3 rounded-lg border p-5 max-md:p-4">
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="type-label">{title}</h2>
      {aside && <span className="text-ink-3 font-mono text-xs">{aside}</span>}
    </div>
    {children}
  </section>
)

const Note = ({ children }: { children: ReactNode }) => (
  <p className="text-ink-3 flex items-start gap-1.5 text-xs leading-normal">
    <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
    <span>{children}</span>
  </p>
)

export const KeyToVerifyAlert = ({
  file,
  action,
}: {
  file: QuestionFile
  action?: ReactNode
}) => {
  const { breakdown, review } = file
  const top = topWrongOption(breakdown)
  const key = breakdown.options.findIndex((o) => o.isKey)
  if (top < 0 || key < 0) return null
  const n = breakdown.answerCount
  const lapsed = review.lapsedConfirmation
  return (
    <Alert variant="warning" data-testid="key-to-verify-alert">
      <TriangleAlert aria-hidden />
      <AlertTitle>Clé à vérifier</AlertTitle>
      <AlertDescription className="flex flex-wrap items-end justify-between gap-3">
        <span className="text-ink-2 max-w-2xl">
          L&apos;option {optionLetter(top)} est plus choisie que la clé{" "}
          {optionLetter(key)} : {percent(breakdown.options[top].count, n)} %
          contre {percent(breakdown.options[key].count, n)} %, sur{" "}
          {answersLabel(n)}.
          {lapsed && (
            <span className="mt-1 block">
              Confirmée le {formatLongDate(lapsed.at)} sur{" "}
              {answersLabel(lapsed.answerCount)} ; {answersLabel(n)}{" "}
              aujourd&apos;hui, l&apos;écart persiste.
            </span>
          )}
        </span>
        {action}
      </AlertDescription>
    </Alert>
  )
}

const KeyConfirmed = ({
  confirmation,
}: {
  confirmation: NonNullable<KeyReview["confirmation"]>
}) => (
  <div
    data-testid="key-confirmed"
    className="bg-surface border-line flex items-start gap-2.5 rounded-lg border p-4"
  >
    <BadgeCheck aria-hidden className="text-ink-3 mt-0.5 size-4 shrink-0" />
    <div className="flex min-w-0 flex-col gap-1.5 text-sm">
      <span className="text-ink font-medium">
        Clé confirmée le {formatLongDate(confirmation.at)}
        {confirmation.byName ? ` par ${confirmation.byName}` : ""}, sur{" "}
        {answersLabel(confirmation.answerCount)} · À revoir quand le nombre de
        réponses aura doublé.
      </span>
      {confirmation.note && (
        <span className="text-ink-2 leading-normal whitespace-pre-line">
          {confirmation.note}
        </span>
      )}
    </div>
  </div>
)

const AnswerDistribution = ({ file }: { file: QuestionFile }) => {
  const { breakdown, review } = file
  const n = breakdown.answerCount
  const significant = isSignificant(n)
  const top = review.toVerify ? topWrongOption(breakdown) : -1
  const row = (
    key: string,
    letter: string,
    text: string,
    count: number,
    tone: Tone,
    former = false,
  ) => (
    <div
      key={key}
      data-testid={former ? "answer-share-former" : "answer-share"}
      className="grid grid-cols-[16px_minmax(0,1fr)_48px] items-start gap-3"
    >
      <span
        className={cn(
          "font-mono text-xs font-semibold",
          tone === "success" && significant ? "text-success-ink" : "text-ink-3",
        )}
      >
        {letter}
      </span>
      <span className="flex min-w-0 flex-col gap-1.5">
        <span
          className={cn(
            "text-sm leading-snug wrap-anywhere",
            former ? "text-ink-3 italic" : "text-ink",
          )}
        >
          {text}
        </span>
        <Progress
          value={percent(count, n)}
          aria-label={`${text} : ${percent(count, n)} %`}
          indicatorColor={significant ? TONE_COLOR[tone] : TONE_COLOR.neutral}
          className="h-1"
        />
      </span>
      <span
        className={cn(
          "text-right font-mono text-xs leading-tight",
          significant ? "text-ink" : "text-ink-3",
        )}
      >
        {percent(count, n)} %<br />
        <span className="text-ink-3">{count}</span>
      </span>
    </div>
  )
  return (
    <Section
      title="Répartition des réponses"
      aside={
        significant ? answersLabel(n) : `Non significatif : ${answersLabel(n)}`
      }
    >
      {n === 0 ? (
        <p className="text-ink-3 text-sm">
          Aucune réponse pour l&apos;instant.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {breakdown.options.map((o, i) =>
            row(
              String(i),
              optionLetter(i),
              o.option,
              o.count,
              o.isKey ? "success" : i === top ? "warning" : "neutral",
            ),
          )}
          {breakdown.formerWording.count > 0 &&
            row(
              "former",
              "—",
              "Formulation antérieure",
              breakdown.formerWording.count,
              "neutral",
              true,
            )}
        </div>
      )}
      {breakdown.formerWording.count > 0 && (
        <Note>
          {answersLabel(breakdown.formerWording.count)} portent sur un choix
          reformulé depuis ; elles ne comptent pour aucune option actuelle.
        </Note>
      )}
      {!significant && n > 0 && (
        <Note>
          Sous {QUESTION_SUCCESS_MIN_ANSWERS} réponses, le taux de réussite
          n&apos;est pas calculé.
        </Note>
      )}
    </Section>
  )
}

const examWindow = (e: QuestionExamUse) =>
  `${formatDayMonth(e.startDate)} → ${formatMediumDate(e.endDate)}`

const ExamsUsing = ({
  exams,
  now,
  links,
}: {
  exams: QuestionExamUse[]
  now: number
  links: boolean
}) => {
  const [all, setAll] = useState(false)
  const shown = all ? exams : exams.slice(0, EXAMS_SHOWN)
  return (
    <Section title="Examens qui l'utilisent" aside={exams.length}>
      {exams.length === 0 ? (
        <p className="text-ink-3 text-sm">
          Aucun examen n&apos;utilise cette question.
        </p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((e) => {
            const label = (
              <span className="flex min-w-0 flex-col gap-px">
                <span className="text-ink text-sm font-medium">{e.title}</span>
                <span className="text-ink-3 font-mono text-xs">
                  {examWindow(e)}
                </span>
              </span>
            )
            return (
              <li
                key={e.id}
                className="border-line flex items-center justify-between gap-3 border-t py-2.5 first:border-t-0 first:pt-0"
              >
                {links ? (
                  <Link
                    href={`/admin/examens/${e.id}`}
                    prefetch={false}
                    className="focus-ring rounded-xs hover:underline hover:underline-offset-3"
                  >
                    {label}
                  </Link>
                ) : (
                  label
                )}
                <ExamStatusBadge status={phaseOf(e, now)} />
              </li>
            )
          })}
        </ul>
      )}
      {exams.length > EXAMS_SHOWN && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={() => setAll(!all)}
        >
          {all ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
          {all
            ? `Afficher les ${EXAMS_SHOWN} premiers`
            : `Afficher les ${exams.length} examens`}
        </Button>
      )}
    </Section>
  )
}

/**
 * Contenu du détail d'une question : alertes, question corrigée telle que
 * l'étudiant la voit, répartition des réponses, examens qui l'utilisent,
 * signalements. Rendu par la page de détail et par un aperçu en Dialog
 * (sans actions ; `examLinks={false}` pour ne pas quitter un formulaire).
 */
export const QuestionDetailContent = ({
  file,
  now,
  confirmKeyAction,
  editHref,
  examLinks = true,
}: {
  file: QuestionFile
  now: number
  /** Bouton « Confirmer la clé » de l'alerte ; absent dans un aperçu. */
  confirmKeyAction?: ReactNode
  /** « Modifier » de l'alerte de mise en forme ; absent dans un aperçu. */
  editHref?: string
  examLinks?: boolean
}) => {
  const { question: q, review, formatIssues } = file
  const hasAlerts =
    review.toVerify || review.confirmation !== null || formatIssues.length > 0
  return (
    <>
      {hasAlerts && (
        <div className="flex flex-col gap-3">
          {review.toVerify && (
            <KeyToVerifyAlert file={file} action={confirmKeyAction} />
          )}
          {review.confirmation && (
            <KeyConfirmed confirmation={review.confirmation} />
          )}
          {formatIssues.length > 0 && (
            <Alert data-testid="format-issues-alert">
              <TextCursorInput aria-hidden />
              <AlertTitle>Mise en forme à vérifier</AlertTitle>
              <AlertDescription className="flex flex-wrap items-end justify-between gap-3">
                <span className="text-ink-2">
                  {[...new Set(formatIssues.map((i) => i.message))].join(" · ")}
                </span>
                {editHref && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={editHref}>Modifier</Link>
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <QuestionCard
          variant="exam"
          showCorrectAnswer
          revealExplanationImages
          question={{
            _id: q.id,
            question: q.question,
            options: q.options,
            domain: q.domain,
            objectifCMC: q.objectifCMC,
            images: q.images.map((img) => ({
              url: cdnUrl(img.storagePath),
              storagePath: img.storagePath,
              order: img.position,
            })),
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            references: q.references ?? [],
            explanationImages: q.explanationImages.map((img) => ({
              url: cdnUrl(img.storagePath),
              storagePath: img.storagePath,
              order: img.position,
            })),
          }}
        />
        <div className="flex min-w-0 flex-col gap-4">
          <AnswerDistribution file={file} />
          <ExamsUsing exams={file.exams} now={now} links={examLinks} />
          <Section title="Signalements">
            <p className="text-ink-3 text-sm">Aucun signalement</p>
          </Section>
        </div>
      </div>
    </>
  )
}
