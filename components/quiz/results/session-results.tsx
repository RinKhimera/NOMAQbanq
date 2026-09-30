"use client"

import { ArrowLeft, Hourglass } from "lucide-react"
import Link from "next/link"
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
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
import type { SessionKind } from "@/components/quiz/session/types"
import { ScoreRing } from "@/components/shared/score-ring"
import { StatusPill } from "@/components/shared/status-pill"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { SegmentedControl } from "@/components/ui/segmented-control"
import type { QuestionExplanationView } from "@/features/exams/dal"
import {
  type AnswerOutcome,
  PASS_THRESHOLD,
  type ScoreTone,
  classify,
  formatPercentile,
  formatScore,
  isPassing,
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
  kind: SessionKind
  /**
   * Score enregistré en base, ou `null` quand la page le retient : un score
   * retenu ne doit pas transiter dans le payload client, même caché.
   * Les compteurs sont dérivés de `questions` + `answers`.
   */
  score: number | null
  questions: QuizQuestion[]
  /** Sparse-safe: absence of a key == unanswered; entry with no/empty selected == unanswered */
  answers: AnswersMap
  /** Questions marquées pendant la tentative : filtre « Marquées ». */
  flaggedIds?: readonly string[]
  loadExplanations?: (ids: string[]) => Promise<QuestionExplanationView[]>
  participant?: SessionResultsParticipant
  /** `false` : la page affiche son propre bilan (évaluation gratuite). */
  summary?: boolean
  /** Libellé mono au-dessus du titre (« Série terminée · mode tuteur »). */
  eyebrow?: ReactNode
  /** Actions sous le titre (« Nouvelle série », « Ma progression »). */
  actions?: ReactNode
  /** Percentile d'examen ; `null`/absent = non disponible, rien n'est affiché. */
  percentile?: number | null
  /** À qui s'adresse le percentile : l'étudiant lui-même, ou un admin qui le consulte. */
  percentileSubject?: "self" | "participant"
  backHref?: string
  backLabel?: string
}

const SCORE_LABEL: Record<SessionKind, Record<ScoreTone, string>> = {
  training: {
    success: "Excellent !",
    warning: "Bien joué !",
    danger: "Continuez à pratiquer",
  },
  exam: { success: "Réussi", warning: "Réussi", danger: "À améliorer" },
}

type Filter = "all" | "errors" | "flagged"

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

const plural = (n: number, word: string) => `${word}${n > 1 ? "s" : ""}`

/** Verdict de la tentative en une phrase : le titre de la page de résultats. */
const headline = (
  kind: SessionKind,
  scoreWithheld: boolean,
  score: number,
  correct: number,
  gradable: number,
): string => {
  if (scoreWithheld) return "Score retenu jusqu'à la clôture de l'examen blanc."
  if (kind === "exam") return isPassing(score) ? "Réussi." : "Non réussi."
  const verdict = isPassing(score) ? "Bien joué !" : "Continuez à pratiquer."
  return `${verdict} ${correct} ${plural(correct, "bonne")} ${plural(correct, "réponse")} sur ${gradable}.`
}

type DomainResult = {
  domain: string
  percent: number
  correct: number
  total: number
}

/**
 * Score par domaine, au plancher, sur les questions corrigeables (une clé
 * retenue n'entre pas ; une question sans réponse compte fausse, comme dans le
 * score de clôture). Un domaine sans question corrigeable n'apparaît pas.
 */
export const resultsByDomain = (
  questions: readonly Pick<QuizQuestion, "_id" | "domain" | "keyWithheld">[],
  answers: AnswersMap,
): DomainResult[] => {
  const acc = new Map<string, { correct: number; total: number }>()
  for (const q of questions) {
    const outcome = classify(q, answers[q._id])
    if (outcome === "withheld") continue
    const entry = acc.get(q.domain) ?? { correct: 0, total: 0 }
    entry.total++
    if (outcome === "correct") entry.correct++
    acc.set(q.domain, entry)
  }
  return [...acc]
    .map(([domain, { correct, total }]) => ({
      domain,
      correct,
      total,
      percent: Math.floor((correct / total) * 100),
    }))
    .toSorted(
      (a, b) => b.percent - a.percent || a.domain.localeCompare(b.domain, "fr"),
    )
}

type StatRowProps = {
  testId: string
  value: number
  label: string
  tone: Tone
  title?: string
}

const StatRow = ({ testId, value, label, tone, title }: StatRowProps) => (
  <div
    className="border-line flex items-baseline justify-between gap-3 border-t px-4.5 py-3 first:border-t-0 max-sm:first:border-t"
    title={title}
  >
    <span className="text-ink-3 text-sm">{label}</span>
    <span
      data-testid={testId}
      className={cn(
        "font-mono text-sm tabular-nums",
        // Seul l'avertissement colore le chiffre ; les autres tons restent
        // à l'encre, la couleur est portée par le point à gauche.
        tone === "warning" ? TONE_TEXT.warning : "text-ink",
      )}
    >
      {value}
    </span>
  </div>
)

/**
 * Résultats d'une tentative — examen (étudiant et admin) et série : bilan
 * (anneau, compteurs, verdict), résultats par domaine pour un examen, puis la
 * correction filtrable aux cartes repliables et son navigateur.
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
  flaggedIds,
  loadExplanations,
  participant,
  summary: showSummary = true,
  eyebrow,
  actions,
  percentile,
  percentileSubject = "self",
  backHref,
  backLabel,
}: SessionResultsProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
    new Set([0]),
  )
  const [filter, setFilter] = useState<Filter>("all")

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

  const flagged = useMemo(() => new Set(flaggedIds ?? []), [flaggedIds])

  // Une réponse dont la clé est retenue (examen ouvert) n'est ni juste ni
  // fausse : elle sort des compteurs et du filtre « Incorrectes » (`classify`).
  const questionResults = useMemo(
    () =>
      questions.map((q) => {
        const outcome: AnswerOutcome = classify(q, answers[q._id])
        return {
          question: q,
          isError: outcome === "incorrect" || outcome === "unanswered",
          isFlagged: flagged.has(q._id),
          userAnswer: outcome === "unanswered" ? null : answers[q._id].selected,
          userVerdict:
            outcome === "unanswered" ? undefined : answers[q._id].isCorrect,
        }
      }),
    [questions, answers, flagged],
  )

  const summary = useMemo(
    () => summarize(questions, answers),
    [questions, answers],
  )
  const cells = useMemo(
    () => correctionCells(questions, answers),
    [questions, answers],
  )
  const domains = useMemo(
    () => (kind === "exam" ? resultsByDomain(questions, answers) : []),
    [kind, questions, answers],
  )

  const resultIndexMap = useMemo(
    () => new Map(questionResults.map((r, i) => [r, i])),
    [questionResults],
  )

  const matchesFilter = useCallback(
    (r: (typeof questionResults)[number], f: Filter) =>
      f === "all" || (f === "errors" ? r.isError : r.isFlagged),
    [],
  )
  const filteredResults = questionResults.filter((r) =>
    matchesFilter(r, filter),
  )

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
        const result = questionResults[index]
        if (result && !matchesFilter(result, filter)) setFilter("all")
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
    [questionResults, filter, matchesFilter],
  )

  // Même prédicat que les pages : la parité corps/en-tête est structurelle.
  const scoreWithheld = score === null || summary.scoreWithheld
  const shownScore = score ?? 0
  const tone = scoreTone(shownScore)
  const errorCount = summary.incorrect + summary.unanswered
  const flaggedCount = questionResults.filter((r) => r.isFlagged).length
  const gradable = questions.length - summary.withheld

  const navigator = {
    cells,
    columns: questions.length > 20 ? 8 : 5,
    kind: "correction",
    onSelect: scrollToQuestion,
  } as const

  const stats: StatRowProps[] = [
    {
      testId: "stat-correct",
      value: summary.correct,
      label: "Correctes",
      tone: "success",
    },
    {
      testId: "stat-incorrect",
      value: summary.incorrect,
      label: "Incorrectes",
      tone: "danger",
    },
    {
      testId: "stat-unanswered",
      value: summary.unanswered,
      label: "Non répondues",
      tone: "neutral",
    },
    ...(summary.withheld > 0
      ? [
          {
            testId: "stat-withheld",
            value: summary.withheld,
            label: "Différées",
            tone: "warning" as const,
            title: KEY_WITHHELD_MESSAGE,
          },
        ]
      : []),
  ]

  const status = scoreWithheld
    ? "withheld"
    : isPassing(shownScore)
      ? "passing"
      : "failing"

  return (
    <div className="flex flex-col gap-5">
      {backHref && (
        <div>
          <Button asChild variant="ghost" size="sm" className="max-md:h-11">
            <Link href={backHref}>
              <ArrowLeft aria-hidden />
              {backLabel ?? "Retour"}
            </Link>
          </Button>
        </div>
      )}

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

      {showSummary && (
        <section
          aria-label="Bilan"
          className="flex flex-wrap items-center justify-between gap-5"
        >
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              {eyebrow && <p className="type-label">{eyebrow}</p>}
              <span
                data-testid="score-status"
                data-status={status}
                title={scoreWithheld ? KEY_WITHHELD_MESSAGE : undefined}
              >
                {scoreWithheld ? (
                  <StatusPill tone="neutral" icon={Hourglass}>
                    Score retenu
                  </StatusPill>
                ) : (
                  <StatusPill
                    data-testid="score-badge"
                    tone={isPassing(shownScore) ? "success" : "warning"}
                  >
                    {SCORE_LABEL[kind][tone]}
                  </StatusPill>
                )}
              </span>
            </div>
            <h1 className="type-h2 text-ink">
              {headline(
                kind,
                scoreWithheld,
                shownScore,
                summary.correct,
                gradable,
              )}
            </h1>
            {percentile != null && !scoreWithheld && (
              <p
                data-testid="exam-percentile"
                className="text-accent-ink text-sm font-medium"
              >
                {formatPercentile(percentile, percentileSubject)}
              </p>
            )}
            {actions && (
              <div className="flex flex-wrap gap-2 pt-1.5 max-md:*:flex-1">
                {actions}
              </div>
            )}
          </div>

          <div
            className="border-line bg-surface grid min-w-0 flex-[1_1_360px] grid-cols-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border max-sm:grid-cols-1"
            style={{ ["--rows" as string]: stats.length }}
          >
            <div className="border-line row-span-(--rows) flex flex-col items-center justify-center gap-2 border-r p-5 max-sm:row-span-1 max-sm:border-r-0">
              <ScoreRing
                value={scoreWithheld ? null : shownScore}
                label="Score"
                size={116}
                strokeWidth={9}
                valueTestId={scoreWithheld ? undefined : "score-percentage"}
              />
              {scoreWithheld && (
                <p
                  data-testid="score-withheld"
                  className="text-warning-ink max-w-40 text-center text-xs leading-snug"
                >
                  {SCORE_WITHHELD_MESSAGE}
                </p>
              )}
            </div>
            {stats.map((stat) => (
              <StatRow key={stat.testId} {...stat} />
            ))}
          </div>
        </section>
      )}

      {showSummary && domains.length > 0 && (
        <section className="bg-surface border-line shadow-1 flex flex-col gap-4 rounded-lg border p-5 md:p-6">
          <div className="flex flex-col gap-1">
            <p className="type-label">Par domaine</p>
            <h2 className="type-h4 text-ink">Résultats de cet examen</h2>
            <p className="text-ink-3 text-sm">
              Seuil de réussite : {formatScore(PASS_THRESHOLD)}.
            </p>
          </div>
          <ul className="flex flex-col gap-3.5">
            {domains.map((d) => (
              <li
                key={d.domain}
                data-testid="domain-result"
                className="grid grid-cols-[minmax(0,170px)_minmax(0,1fr)_3rem] items-center gap-4 max-md:grid-cols-[minmax(0,1fr)_2.75rem] max-md:gap-x-2.5 max-md:gap-y-1.5"
              >
                <span className="text-ink truncate text-sm">{d.domain}</span>
                <Progress
                  value={d.percent}
                  indicatorColor={TONE_COLOR[scoreTone(d.percent)]}
                  className="h-1.5 max-md:col-span-full max-md:row-start-2"
                  aria-label={`${d.domain} : ${d.correct} sur ${d.total}`}
                />
                <span className="text-ink-2 text-right font-mono text-sm tabular-nums">
                  {formatScore(d.percent)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-surface border-line shadow-1 flex flex-col gap-4 rounded-lg border p-5 md:p-6">
        <div className="flex flex-col gap-1">
          <p className="type-label">Correction</p>
          <h2 className="type-h4 text-ink">Revoir vos réponses</h2>
        </div>

        <div className="flex items-start gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl<Filter>
                label="Filtrer la correction"
                value={filter}
                onValueChange={setFilter}
                options={[
                  {
                    value: "all",
                    label: "Toutes",
                    count: questions.length,
                    testId: "results-filter-all",
                  },
                  {
                    value: "errors",
                    label: "Incorrectes",
                    count: errorCount,
                    testId: "btn-filter-errors",
                  },
                  {
                    value: "flagged",
                    label: "Marquées",
                    count: flaggedCount,
                    testId: "results-filter-flagged",
                  },
                ]}
                className="max-md:h-11"
              />
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
                    className="scroll-mt-[calc(var(--shell-offset,0px)+1rem)] rounded-lg outline-none"
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
                      isFlagged={result.isFlagged}
                      isExpanded={expandedQuestions.has(originalIndex)}
                      onToggleExpand={() => toggleQuestionExpand(originalIndex)}
                    />
                  </div>
                )
              })}
              {filteredResults.length === 0 && (
                <p className="text-ink-3 py-6 text-sm">
                  Aucune question dans ce filtre.
                </p>
              )}
            </div>
          </div>

          <aside className="bg-surface-2 border-line sticky top-[calc(var(--shell-offset,0px)+1rem)] hidden w-75 shrink-0 rounded-lg border p-5 lg:block">
            <NavigatorPanel {...navigator} title="Navigation" />
          </aside>
        </div>
      </section>
    </div>
  )
}
