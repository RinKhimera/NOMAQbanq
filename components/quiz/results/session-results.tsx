"use client"

import {
  CircleCheck,
  CircleMinus,
  CircleX,
  Funnel,
  Hourglass,
  Target,
  Trophy,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { toast } from "sonner"
import { correctionCells } from "@/components/quiz/navigator/cells"
import {
  NavigatorPanel,
  NavigatorSheet,
} from "@/components/quiz/navigator/question-navigator"
import { QuestionCard } from "@/components/quiz/question-card"
import {
  type AnswersMap,
  KEY_WITHHELD_MESSAGE,
  type QuizQuestion,
  SCORE_WITHHELD_MESSAGE,
} from "@/components/quiz/runner/types"
import { StatusPill } from "@/components/shared/status-pill"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Button } from "@/components/ui/button"
import type { QuestionExplanationView } from "@/features/exams/dal"
import {
  PASS_THRESHOLD,
  type ScoreTone,
  classify,
  formatPercentile,
  formatScore,
  isPassing,
  scoreTextClass,
  scoreTone,
  summarize,
} from "@/lib/score"
import { TONE_COLOR, TONE_TEXT, type Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

export interface SessionResultsParticipant {
  name: string
  email: string
  image: string | null
}

export interface SessionResultsProps {
  kind: "training" | "exam"
  /**
   * Score enregistré en base, ou `null` quand la page le retient : un score
   * retenu ne doit pas transiter dans le payload client, même caché.
   * Les compteurs sont dérivés de `questions` + `answers`.
   */
  score: number | null
  questions: QuizQuestion[]
  /** Sparse-safe: absence of a key == unanswered; entry with no/empty selected == unanswered */
  answers: AnswersMap
  loadExplanations?: (ids: string[]) => Promise<QuestionExplanationView[]>
  participant?: SessionResultsParticipant
}

const SCORE_LABEL: Record<"training" | "exam", Record<ScoreTone, string>> = {
  training: {
    success: "Excellent !",
    warning: "Bien joué !",
    danger: "Continuez à pratiquer",
  },
  exam: { success: "Réussi", warning: "Réussi", danger: "À améliorer" },
}

const KEEP_IN_VIEW_MS = 5000
const USER_SCROLL_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"]

/**
 * Garde `target` en haut de l'écran tant que la liste change de taille (une
 * explication chargée au-dessus la pousserait hors de l'écran), jusqu'au
 * premier geste de l'utilisateur. L'ancrage natif du défilement ne suffit pas :
 * il est absent de Safari. Renvoie la fonction d'arrêt.
 */
function keepInView(target: HTMLElement, list: HTMLElement): () => void {
  const anchoredTop = target.getBoundingClientRect().top
  const observer = new ResizeObserver(() => {
    if (Math.abs(target.getBoundingClientRect().top - anchoredTop) > 1) {
      target.scrollIntoView({ behavior: "instant", block: "start" })
    }
  })
  const stop = () => {
    observer.disconnect()
    clearTimeout(timeout)
    for (const type of USER_SCROLL_EVENTS) {
      window.removeEventListener(type, stop)
    }
  }
  const timeout = setTimeout(stop, KEEP_IN_VIEW_MS)
  observer.observe(list)
  for (const type of USER_SCROLL_EVENTS) {
    window.addEventListener(type, stop, { passive: true })
  }
  return stop
}

type StatProps = {
  testId: string
  value: number
  label: string
  tone: Tone
  Icon: typeof CircleX
  title?: string
}

const Stat = ({ testId, value, label, tone, Icon, title }: StatProps) => (
  <div className="bg-surface flex flex-col gap-1 px-4 py-3" title={title}>
    <span className="flex items-center gap-2">
      <Icon aria-hidden className={cn("size-4", TONE_TEXT[tone])} />
      <span
        data-testid={testId}
        className="text-ink font-mono text-xl tabular-nums"
      >
        {value}
      </span>
    </span>
    <span className="text-ink-3 text-xs">{label}</span>
  </div>
)

/**
 * Résultats d'une tentative — examen (étudiant et admin) et série.
 *
 * Sparse-answer compat: treats BOTH "no key in answers" AND "entry with
 * no/empty selected" as "non répondu" — une participation dont seules les
 * questions répondues ont une ligne `examAnswers` doit rendre correctement.
 */
export function SessionResults({
  kind,
  score,
  questions,
  answers,
  loadExplanations,
  participant,
}: SessionResultsProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
    new Set([0]),
  )
  const [showErrorsOnly, setShowErrorsOnly] = useState(false)

  // Explications chargées à la demande : seules les questions nouvellement
  // dépliées partent au serveur.
  const [explanationsMap, setExplanationsMap] = useState<
    Map<
      string,
      {
        explanation: string
        references?: string[]
        explanationImages?: {
          url: string
          storagePath: string
          order: number
        }[]
      }
    >
  >(new Map())
  const loadedIds = useRef<Set<string>>(new Set())

  // Une question à clé retenue n'a pas d'explication à charger : le serveur la
  // refuserait de toute façon.
  const expandedQuestionIds = useMemo(
    () =>
      [...expandedQuestions]
        .map((index) => questions[index])
        .filter((q) => q !== undefined && !q.keyWithheld)
        .map((q) => q._id),
    [expandedQuestions, questions],
  )

  useEffect(() => {
    if (!loadExplanations) return
    const toLoad = expandedQuestionIds.filter(
      (id) => !loadedIds.current.has(id),
    )
    if (toLoad.length === 0) return
    let active = true
    loadExplanations(toLoad)
      .then((rows) => {
        if (!active) return
        setExplanationsMap((prev) => {
          const next = new Map(prev)
          for (const row of rows) {
            next.set(row.questionId, {
              explanation: row.explanation,
              references: row.references,
              explanationImages: row.explanationImages,
            })
          }
          return next
        })
        for (const id of toLoad) loadedIds.current.add(id)
      })
      .catch(() => {
        // loadedIds non marqué : re-déplier la question retente le chargement
        if (!active) return
        toast.error("Explications indisponibles. Vérifiez votre réseau.")
      })
    return () => {
      active = false
    }
  }, [expandedQuestionIds, loadExplanations])

  // Une réponse dont la clé est retenue (examen ouvert) n'est ni juste ni
  // fausse : elle sort des compteurs et du filtre « Erreurs » (`classify`).
  const questionResults = useMemo(
    () =>
      questions.map((q) => {
        const outcome = classify(q, answers[q._id])
        return {
          question: q,
          isError: outcome === "incorrect" || outcome === "unanswered",
          userAnswer: outcome === "unanswered" ? null : answers[q._id].selected,
          userVerdict:
            outcome === "unanswered" ? undefined : answers[q._id].isCorrect,
        }
      }),
    [questions, answers],
  )

  const summary = useMemo(
    () => summarize(questions, answers),
    [questions, answers],
  )
  const cells = useMemo(
    () => correctionCells(questions, answers),
    [questions, answers],
  )

  const resultIndexMap = useMemo(
    () => new Map(questionResults.map((r, i) => [r, i])),
    [questionResults],
  )

  const filteredResults = showErrorsOnly
    ? questionResults.filter((r) => r.isError)
    : questionResults

  const toggleQuestionExpand = (index: number) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const expandAll = () =>
    setExpandedQuestions(new Set(questionResults.map((_, i) => i)))

  const collapseAll = () => setExpandedQuestions(new Set())

  const questionListRef = useRef<HTMLDivElement>(null)
  const stopKeepInView = useRef<(() => void) | null>(null)
  useEffect(() => () => stopKeepInView.current?.(), [])

  const scrollToQuestion = useCallback(
    (index: number) => {
      // Rendu synchrone : la carte doit exister (filtre levé) avant de défiler.
      flushSync(() => {
        setExpandedQuestions((prev) => new Set(prev).add(index))
        if (!questionResults[index]?.isError) setShowErrorsOnly(false)
      })
      const target = document.getElementById(`sr-question-${index}`)
      const list = questionListRef.current
      if (!target || !list) return
      // Saut instantané : un défilement doux fige sa destination au départ,
      // qu'une explication chargée au-dessus en cours de route rend fausse.
      target.scrollIntoView({ behavior: "instant", block: "start" })
      target.focus({ preventScroll: true })
      stopKeepInView.current?.()
      stopKeepInView.current = keepInView(target, list)
    },
    [questionResults],
  )

  // Même prédicat que les pages : la parité corps/en-tête est structurelle.
  const scoreWithheld = score === null || summary.scoreWithheld
  const shownScore = score ?? 0
  const tone = scoreTone(shownScore)
  const errorCount = summary.incorrect + summary.unanswered

  const navigator = {
    cells,
    columns: questions.length > 20 ? 8 : 5,
    kind: "correction",
    onSelect: scrollToQuestion,
  } as const

  return (
    <div className="flex items-start gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {participant && (
          <div className="bg-surface border-line flex items-center gap-4 rounded-lg border p-4">
            <UserAvatar
              name={participant.name}
              image={participant.image}
              className="size-12"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-ink truncate text-base font-semibold">
                Résultats de {participant.name}
              </h2>
              <p className="text-ink-3 truncate text-sm">{participant.email}</p>
            </div>
            <StatusPill tone="neutral">Participant</StatusPill>
          </div>
        )}

        <section className="bg-surface border-line shadow-1 rounded-lg border p-5 sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2">
              {scoreWithheld ? (
                <span
                  data-testid="score-withheld"
                  title={KEY_WITHHELD_MESSAGE}
                  className="text-warning-ink flex items-center gap-2 text-lg font-semibold"
                >
                  <Hourglass className="size-5 shrink-0" aria-hidden />
                  {SCORE_WITHHELD_MESSAGE}
                </span>
              ) : (
                <span
                  data-testid="score-percentage"
                  className={cn(
                    "font-serif text-5xl font-semibold tabular-nums",
                    scoreTextClass(shownScore),
                  )}
                >
                  {formatScore(shownScore)}
                </span>
              )}
              <p className="text-ink-2 text-sm">
                {summary.correct} sur {questions.length - summary.withheld}{" "}
                questions réussies
              </p>
              {!scoreWithheld && (
                <StatusPill
                  data-testid="score-badge"
                  tone={isPassing(shownScore) ? "success" : "warning"}
                >
                  {SCORE_LABEL[kind][tone]}
                </StatusPill>
              )}
            </div>

            <div className="bg-line border-line grid grid-cols-2 gap-px overflow-hidden rounded-md border sm:flex">
              <Stat
                testId="stat-correct"
                value={summary.correct}
                label="Correctes"
                tone="success"
                Icon={CircleCheck}
              />
              <Stat
                testId="stat-incorrect"
                value={summary.incorrect}
                label="Incorrectes"
                tone="danger"
                Icon={CircleX}
              />
              {summary.withheld > 0 && (
                <Stat
                  testId="stat-withheld"
                  value={summary.withheld}
                  label="Différées"
                  tone="warning"
                  Icon={Hourglass}
                  title={KEY_WITHHELD_MESSAGE}
                />
              )}
              {summary.unanswered > 0 && (
                <Stat
                  testId="stat-unanswered"
                  value={summary.unanswered}
                  label="Sans réponse"
                  tone="neutral"
                  Icon={CircleMinus}
                />
              )}
            </div>
          </div>

          {/* Barre de score : sa largeur EST le score, retenue avec lui. */}
          {!scoreWithheld && (
            <div data-testid="score-progress" className="mt-6">
              <div className="text-ink-3 mb-2 flex items-center justify-between text-xs">
                <span>Progression</span>
                <span>Seuil de réussite : {formatScore(PASS_THRESHOLD)}</span>
              </div>
              <div className="bg-surface-2 relative h-2 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${shownScore}%`,
                    background: TONE_COLOR[tone],
                  }}
                />
                <div
                  className="bg-ink-3 absolute top-0 h-full w-0.5"
                  style={{ left: `${PASS_THRESHOLD}%` }}
                />
              </div>
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            data-testid="btn-filter-errors"
            variant={showErrorsOnly ? "default" : "outline"}
            onClick={() => setShowErrorsOnly(!showErrorsOnly)}
            aria-pressed={showErrorsOnly}
            size="sm"
            className="max-md:h-11"
          >
            <Funnel aria-hidden />
            {showErrorsOnly ? "Voir toutes" : `Erreurs (${errorCount})`}
          </Button>
          <NavigatorSheet
            {...navigator}
            handsOffFocus
            triggerClassName="lg:hidden"
          />
          <div className="ml-auto flex items-center gap-2">
            <Button
              data-testid="btn-expand-all"
              variant="ghost"
              size="sm"
              onClick={expandAll}
              className="max-md:h-11"
            >
              Tout déplier
            </Button>
            <Button
              data-testid="btn-collapse-all"
              variant="ghost"
              size="sm"
              onClick={collapseAll}
              className="max-md:h-11"
            >
              Tout replier
            </Button>
          </div>
        </div>

        <div ref={questionListRef} className="flex flex-col gap-4">
          {filteredResults.map((result, index) => {
            const originalIndex = resultIndexMap.get(result) ?? index
            const expl = explanationsMap.get(result.question._id)

            return (
              <div
                key={result.question._id}
                id={`sr-question-${originalIndex}`}
                tabIndex={-1}
                className="scroll-mt-[calc(var(--shell-offset,0px)+6rem)] rounded-lg outline-none"
              >
                <QuestionCard
                  variant="review"
                  question={result.question}
                  lazyExplanation={
                    expl?.explanation ?? result.question.explanation
                  }
                  lazyReferences={
                    expl?.references ?? result.question.references
                  }
                  lazyExplanationImages={
                    expl?.explanationImages ??
                    result.question.explanationImages ??
                    []
                  }
                  questionNumber={originalIndex + 1}
                  userAnswer={result.userAnswer}
                  userVerdict={result.userVerdict}
                  isExpanded={expandedQuestions.has(originalIndex)}
                  onToggleExpand={() => toggleQuestionExpand(originalIndex)}
                />
              </div>
            )
          })}
        </div>
      </div>

      <aside className="bg-surface border-line sticky top-[calc(var(--shell-offset,0px)+6rem)] hidden w-75 shrink-0 rounded-lg border p-5 lg:block">
        <NavigatorPanel {...navigator} title="Navigation" />
      </aside>
    </div>
  )
}

interface SessionResultsHeaderProps {
  title: string
  subtitle?: string
  /** `null` = score retenu (même valeur que celle passée au corps). */
  score: number | null
  /** Percentile d'examen ; `null`/absent = non disponible, rien n'est affiché. */
  percentile?: number | null
  /** À qui s'adresse le percentile : l'étudiant lui-même, ou un admin qui le consulte. */
  percentileSubject?: "self" | "participant"
  backHref: string
  backLabel: string
  backIcon: React.ReactNode
}

type ScoreStatus = "passing" | "failing" | "withheld"

const SCORE_STATUS: Record<
  ScoreStatus,
  { tone: Tone; Icon: typeof Trophy; label: string }
> = {
  passing: { tone: "success", Icon: Trophy, label: "Réussi" },
  failing: { tone: "warning", Icon: Target, label: "Non réussi" },
  withheld: { tone: "neutral", Icon: Hourglass, label: "Score retenu" },
}

/** En-tête des résultats, collant sous les barres de la coquille. */
export function SessionResultsHeader({
  title,
  subtitle,
  score,
  percentile,
  percentileSubject = "self",
  backHref,
  backLabel,
  backIcon,
}: SessionResultsHeaderProps) {
  // Réussi/échoué est un bit du score : retenu avec lui.
  let status: ScoreStatus = "failing"
  if (score === null) status = "withheld"
  else if (isPassing(score)) status = "passing"
  const { tone, Icon, label } = SCORE_STATUS[status]

  return (
    <div className="bg-background border-line sticky top-(--shell-offset,0px) z-10 -mx-4 -mt-6 border-b px-4 py-4 sm:-mx-6 sm:px-6 md:-mt-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            data-testid="score-status"
            data-status={status}
            title={status === "withheld" ? KEY_WITHHELD_MESSAGE : label}
            className={cn("shrink-0", TONE_TEXT[tone])}
          >
            <Icon aria-hidden className="size-6" />
            <span className="sr-only">{label}</span>
          </span>
          <div className="min-w-0">
            <h1 className="text-ink truncate font-serif text-2xl font-semibold">
              {title}
            </h1>
            {subtitle && <p className="text-ink-3 text-sm">{subtitle}</p>}
            {percentile != null && (
              <p
                data-testid="exam-percentile"
                className="text-accent-ink text-sm font-medium"
              >
                {formatPercentile(percentile, percentileSubject)}
              </p>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          asChild
          className="max-md:h-11 max-sm:w-11 max-sm:px-0"
        >
          <a href={backHref}>
            {backIcon}
            <span className="max-sm:sr-only">{backLabel}</span>
          </a>
        </Button>
      </div>
    </div>
  )
}
