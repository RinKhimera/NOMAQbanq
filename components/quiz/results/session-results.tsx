"use client"

import {
  CircleCheckBig,
  CircleX,
  Clock,
  Funnel,
  Hourglass,
  Target,
  TrendingUp,
  Trophy,
  User,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { toast } from "sonner"
import { QuestionCard } from "@/components/quiz/question-card"
import { ResultsQuestionNavigator } from "@/components/quiz/results"
import {
  type AnswersMap,
  KEY_WITHHELD_MESSAGE,
  type QuizQuestion,
  SCORE_WITHHELD_MESSAGE,
} from "@/components/quiz/runner/types"
import { SessionToolbar } from "@/components/quiz/session/session-toolbar"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { QuestionExplanationView } from "@/features/exams/dal"
import { useIsVisible } from "@/hooks/use-is-visible"
import { classify, formatPercentile, summarize } from "@/lib/score"
import { cn } from "@/lib/utils"

// ============================================
// Types
// ============================================

export interface SessionResultsParticipant {
  name: string
  email: string
  image: string | null
}

export interface SessionResultsProps {
  accent: "blue" | "emerald"
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

// ============================================
// Helpers
// ============================================

const PASS_THRESHOLD = 60

const getScoreColor = (score: number, accent: "blue" | "emerald") => {
  if (score >= 80) {
    return accent === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-green-600 dark:text-green-400"
  }
  if (score >= PASS_THRESHOLD) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

const getScoreBgGradient = (score: number, accent: "blue" | "emerald") => {
  if (score >= 80) {
    return accent === "emerald"
      ? "from-emerald-500/20 to-teal-500/20 dark:from-emerald-500/10 dark:to-teal-500/10"
      : "from-green-500/20 to-emerald-500/20 dark:from-green-500/10 dark:to-emerald-500/10"
  }
  if (score >= PASS_THRESHOLD)
    return "from-amber-500/20 to-orange-500/20 dark:from-amber-500/10 dark:to-orange-500/10"
  return "from-red-500/20 to-rose-500/20 dark:from-red-500/10 dark:to-rose-500/10"
}

const getScoreProgressColor = (score: number, accent: "blue" | "emerald") => {
  if (score >= 80)
    return accent === "emerald"
      ? "bg-linear-to-r from-emerald-500 to-teal-500"
      : "bg-linear-to-r from-green-500 to-emerald-500"
  if (score >= PASS_THRESHOLD)
    return "bg-linear-to-r from-amber-500 to-orange-500"
  return "bg-linear-to-r from-red-500 to-rose-500"
}

const getScoreLabel = (score: number, accent: "blue" | "emerald") => {
  if (score >= 80) return accent === "emerald" ? "Excellent !" : "Réussi"
  if (score >= PASS_THRESHOLD)
    return accent === "emerald" ? "Bien joué !" : "Réussi"
  return accent === "emerald" ? "Continuez à pratiquer" : "À améliorer"
}

const KEEP_IN_VIEW_MS = 5000
const USER_SCROLL_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"]

/**
 * Garde `target` en haut de l'écran tant que la liste change de taille (une
 * explication chargée au-dessus la pousserait hors de l'écran), jusqu'au
 * premier geste de l'utilisateur. L'ancrage natif du défilement ne suffit pas :
 * absent de Safari, et suspendu par les transforms des animations Motion.
 * Renvoie la fonction d'arrêt.
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

// ============================================
// Component
// ============================================

/**
 * Unified results view — used by exam (student + admin) and training results.
 *
 * Sparse-answer compat: treats BOTH "no key in answers" AND "entry with
 * no/empty selected" as "non répondu" — une participation dont seules les
 * questions répondues ont une ligne `examAnswers` doit rendre correctement.
 */
export function SessionResults({
  accent,
  score,
  questions,
  answers,
  loadExplanations,
  participant,
}: SessionResultsProps) {
  const { ref: desktopNavRef, isVisible: isDesktopNavVisible } = useIsVisible()

  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
    new Set([0]),
  )
  const [showErrorsOnly, setShowErrorsOnly] = useState(false)

  // Lazy-load explanations: only load newly-expanded questions.
  // explanationsMap: questionId -> { explanation, references, explanationImages }
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
          isAnswered: outcome !== "unanswered",
          isWithheld: outcome === "withheld",
          isCorrect: outcome === "correct",
          isError: outcome === "incorrect" || outcome === "unanswered",
          userAnswer: outcome === "unanswered" ? null : answers[q._id].selected,
        }
      }),
    [questions, answers],
  )

  const summary = useMemo(
    () => summarize(questions, answers),
    [questions, answers],
  )

  const navigatorResults = useMemo(
    () =>
      questionResults.map((r) => ({
        isCorrect: r.isCorrect,
        isAnswered: r.isAnswered,
        isWithheld: r.isWithheld,
      })),
    [questionResults],
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
      stopKeepInView.current?.()
      stopKeepInView.current = keepInView(target, list)
    },
    [questionResults],
  )

  // Même prédicat que les pages : la parité corps/en-tête est structurelle.
  const scoreWithheld = score === null || summary.scoreWithheld
  const shownScore = score ?? 0
  const isPassing = shownScore >= PASS_THRESHOLD

  const accentNavColor = accent

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
      {/* Main content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          {/* Left column */}
          <div className="space-y-8">
            {/* Participant card (admin view) */}
            {participant && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-lg dark:border-gray-700/50 dark:bg-gray-800"
              >
                <UserAvatar
                  name={participant.name}
                  image={participant.image}
                  className="h-14 w-14"
                  fallbackClassName="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Résultats de {participant.name}
                    </h2>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {participant.email}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  Participant
                </Badge>
              </motion.div>
            )}

            {/* Score card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-2xl border border-gray-200/80 bg-linear-to-br p-6 shadow-lg dark:border-gray-700/50",
                // La couleur de la carte suit la tranche du score : elle est
                // neutralisée avec lui, sinon elle trahit la même information.
                scoreWithheld
                  ? "from-amber-500/10 to-orange-500/10 dark:from-amber-500/5 dark:to-orange-500/5"
                  : getScoreBgGradient(shownScore, accent),
              )}
            >
              <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
                {/* Score */}
                <div className="text-center md:text-left">
                  <div className="mb-2 flex items-center justify-center gap-3 md:justify-start">
                    {scoreWithheld ? (
                      <motion.span
                        data-testid="score-withheld"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        title={KEY_WITHHELD_MESSAGE}
                        className="flex items-center gap-2 text-xl font-semibold text-amber-700 dark:text-amber-300"
                      >
                        <Hourglass className="h-5 w-5 shrink-0" aria-hidden />
                        {SCORE_WITHHELD_MESSAGE}
                      </motion.span>
                    ) : (
                      <motion.span
                        data-testid="score-percentage"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 200,
                          damping: 15,
                        }}
                        className={cn(
                          "text-6xl font-bold",
                          getScoreColor(shownScore, accent),
                        )}
                      >
                        {shownScore}%
                      </motion.span>
                    )}
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">
                    {summary.correct} sur {questions.length - summary.withheld}{" "}
                    questions réussies
                  </p>
                  {!scoreWithheld && (
                    <div className="mt-3">
                      <Badge
                        data-testid="score-badge"
                        className={cn(
                          "px-4 py-1 text-sm font-semibold",
                          isPassing
                            ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
                        )}
                      >
                        {getScoreLabel(shownScore, accent)}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex gap-4 md:gap-6">
                  <div className="flex flex-col items-center rounded-xl bg-white/60 px-4 py-3 dark:bg-gray-800/60">
                    <div className="flex items-center gap-2">
                      <CircleCheckBig className="h-5 w-5 text-green-500" />
                      <span
                        data-testid="stat-correct"
                        className="text-2xl font-bold text-green-600 dark:text-green-400"
                      >
                        {summary.correct}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Correctes
                    </span>
                  </div>

                  <div className="flex flex-col items-center rounded-xl bg-white/60 px-4 py-3 dark:bg-gray-800/60">
                    <div className="flex items-center gap-2">
                      <CircleX className="h-5 w-5 text-red-500" />
                      <span
                        data-testid="stat-incorrect"
                        className="text-2xl font-bold text-red-600 dark:text-red-400"
                      >
                        {summary.incorrect}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Incorrectes
                    </span>
                  </div>

                  {summary.withheld > 0 && (
                    <div
                      className="flex flex-col items-center rounded-xl bg-white/60 px-4 py-3 dark:bg-gray-800/60"
                      title={KEY_WITHHELD_MESSAGE}
                    >
                      <div className="flex items-center gap-2">
                        <Hourglass className="h-5 w-5 text-amber-500" />
                        <span
                          data-testid="stat-withheld"
                          className="text-2xl font-bold text-amber-600 dark:text-amber-400"
                        >
                          {summary.withheld}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Différées
                      </span>
                    </div>
                  )}

                  {summary.unanswered > 0 && (
                    <div className="flex flex-col items-center rounded-xl bg-white/60 px-4 py-3 dark:bg-gray-800/60">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-gray-500" />
                        <span
                          data-testid="stat-unanswered"
                          className="text-2xl font-bold text-gray-600 dark:text-gray-400"
                        >
                          {summary.unanswered}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Sans réponse
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar : sa largeur EST le score, retenue avec lui. */}
              {!scoreWithheld && (
                <div data-testid="score-progress" className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Progression
                    </span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Seuil de réussite : 60%
                    </span>
                  </div>
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${shownScore}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={cn(
                        "h-full rounded-full",
                        getScoreProgressColor(shownScore, accent),
                      )}
                    />
                    {/* 60% marker */}
                    <div
                      className="absolute top-0 h-full w-0.5 bg-gray-900/30 dark:bg-white/30"
                      style={{ left: "60%" }}
                    />
                  </div>
                </div>
              )}
            </motion.div>

            {/* Filter & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Button
                  data-testid="btn-filter-errors"
                  variant={showErrorsOnly ? "default" : "outline"}
                  onClick={() => setShowErrorsOnly(!showErrorsOnly)}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <Funnel className="h-4 w-4" />
                  {showErrorsOnly
                    ? "Voir toutes"
                    : `Erreurs (${summary.incorrect + summary.unanswered})`}
                  {showErrorsOnly && (
                    <Badge
                      variant="secondary"
                      className="ml-1 bg-white/20 text-white"
                    >
                      {summary.incorrect + summary.unanswered}
                    </Badge>
                  )}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  data-testid="btn-expand-all"
                  variant="outline"
                  size="sm"
                  onClick={expandAll}
                >
                  Tout déplier
                </Button>
                <Button
                  data-testid="btn-collapse-all"
                  variant="outline"
                  size="sm"
                  onClick={collapseAll}
                >
                  Tout replier
                </Button>
              </div>
            </div>

            {/* Questions list */}
            <div ref={questionListRef} className="space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredResults.map((result, index) => {
                  const originalIndex = resultIndexMap.get(result) ?? index
                  const expl = explanationsMap.get(result.question._id)

                  // For questions that already have embedded explanation (training),
                  // use them directly; otherwise use lazy-loaded ones.
                  const lazyExplanation =
                    expl?.explanation ?? result.question.explanation
                  const lazyReferences =
                    expl?.references ?? result.question.references
                  const lazyExplanationImages =
                    expl?.explanationImages ??
                    result.question.explanationImages ??
                    []

                  return (
                    <motion.div
                      key={result.question._id}
                      id={`sr-question-${originalIndex}`}
                      className="scroll-mt-28"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      // Délai plafonné : une carte lointaine doit être visible
                      // dès qu'on y navigue (≈ 11 s sur une correction de 230
                      // questions sans plafond).
                      transition={{ delay: Math.min(index, 10) * 0.05 }}
                    >
                      <QuestionCard
                        variant="review"
                        question={result.question}
                        lazyExplanation={lazyExplanation}
                        lazyReferences={lazyReferences}
                        lazyExplanationImages={lazyExplanationImages}
                        questionNumber={originalIndex + 1}
                        userAnswer={result.userAnswer}
                        isExpanded={expandedQuestions.has(originalIndex)}
                        onToggleExpand={() =>
                          toggleQuestionExpand(originalIndex)
                        }
                      />
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Right column - Navigation (desktop) */}
          <div className="hidden lg:block">
            <div ref={desktopNavRef} className="h-1" />
            <div className="sticky top-24 space-y-4">
              <ResultsQuestionNavigator
                questionResults={navigatorResults}
                onNavigateToQuestion={scrollToQuestion}
                variant="desktop"
                accentColor={accentNavColor}
                showTips={!participant}
              />

              {participant && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                      Vue administrateur
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-purple-800 dark:text-purple-200">
                    Vous consultez les résultats de{" "}
                    {participant.name || "ce participant"}. Utilisez cette vue
                    pour analyser les performances.
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating toolbar */}
      <SessionToolbar
        showScrollTop={true}
        showNavFab={!isDesktopNavVisible}
        navFab={
          <ResultsQuestionNavigator
            questionResults={navigatorResults}
            onNavigateToQuestion={scrollToQuestion}
            variant="mobile"
            accentColor={accentNavColor}
          />
        }
      />
    </div>
  )
}

// ============================================
// Header (exported separately — used by pages)
// ============================================

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

const SCORE_STATUS_STYLES: Record<
  ScoreStatus,
  { gradient: string; Icon: typeof Trophy }
> = {
  passing: { gradient: "from-green-500 to-emerald-600", Icon: Trophy },
  failing: { gradient: "from-amber-500 to-orange-600", Icon: Target },
  withheld: { gradient: "from-slate-400 to-slate-500", Icon: Hourglass },
}

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
  else if (score >= PASS_THRESHOLD) status = "passing"
  const { gradient, Icon } = SCORE_STATUS_STYLES[status]
  return (
    <div className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/80 backdrop-blur-xl dark:border-gray-700/50 dark:bg-gray-900/80">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div
              data-testid="score-status"
              data-status={status}
              title={status === "withheld" ? KEY_WITHHELD_MESSAGE : undefined}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br shadow-lg",
                gradient,
              )}
            >
              <Icon className="h-6 w-6 text-white" />
            </motion.div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {subtitle}
                </p>
              )}
              {percentile != null && (
                <p
                  data-testid="exam-percentile"
                  className="text-sm font-medium text-blue-600 dark:text-blue-400"
                >
                  {formatPercentile(percentile, percentileSubject)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" asChild>
              <a href={backHref} className="flex items-center gap-2">
                {backIcon}
                <span className="hidden sm:inline">{backLabel}</span>
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
