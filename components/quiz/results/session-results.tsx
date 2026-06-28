"use client"

import {
  CircleCheckBig,
  CircleX,
  Clock,
  Funnel,
  Target,
  TrendingUp,
  Trophy,
  User,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { QuestionCard } from "@/components/quiz/question-card"
import { ResultsQuestionNavigator } from "@/components/quiz/results"
import type { AnswersMap, QuizQuestion } from "@/components/quiz/runner/types"
import { SessionToolbar } from "@/components/quiz/session/session-toolbar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { QuestionExplanationView } from "@/features/exams/dal"
import { useIsVisible } from "@/hooks/use-is-visible"
import { cn, getInitials } from "@/lib/utils"

// ============================================
// Types
// ============================================

export interface SessionResultsSummary {
  score: number
  correct: number
  incorrect: number
  unanswered: number
}

export interface SessionResultsParticipant {
  name: string
  email: string
  image: string | null
}

export interface SessionResultsProps {
  accent: "blue" | "emerald"
  summary: SessionResultsSummary
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

// ============================================
// Component
// ============================================

/**
 * Unified results view — used by exam (student + admin) and training results.
 *
 * Sparse-answer compat (C1 Step 1b): treats BOTH "no key in answers" AND
 * "entry with no/empty selected" as "non répondu", so older exam participations
 * (which only had examAnswers rows for answered questions) render correctly.
 */
export function SessionResults({
  accent,
  summary,
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

  const expandedQuestionIds = useMemo(
    () =>
      [...expandedQuestions]
        .map((index) => questions[index]?._id)
        .filter((id): id is string => id !== undefined),
    [expandedQuestions, questions],
  )

  useEffect(() => {
    if (!loadExplanations) return
    const toLoad = expandedQuestionIds.filter(
      (id) => !loadedIds.current.has(id),
    )
    if (toLoad.length === 0) return
    let active = true
    loadExplanations(toLoad).then((rows) => {
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
    return () => {
      active = false
    }
  }, [expandedQuestionIds, loadExplanations])

  // Build question results with sparse-answer compat.
  // "no key" == unanswered; "entry with empty/null selected" == unanswered.
  const questionResults = useMemo(
    () =>
      questions.map((q) => {
        const entry = answers[q._id]
        const hasAnswer =
          entry !== undefined &&
          entry.selected !== undefined &&
          entry.selected !== null &&
          entry.selected !== ""
        const isCorrect = hasAnswer ? (entry.isCorrect ?? false) : false
        return {
          question: q,
          isAnswered: hasAnswer,
          isCorrect,
          userAnswer: hasAnswer ? entry.selected : null,
        }
      }),
    [questions, answers],
  )

  const navigatorResults = useMemo(
    () =>
      questionResults.map((r) => ({
        isCorrect: r.isCorrect,
        isAnswered: r.isAnswered,
      })),
    [questionResults],
  )

  const resultIndexMap = useMemo(
    () => new Map(questionResults.map((r, i) => [r, i])),
    [questionResults],
  )

  const filteredResults = showErrorsOnly
    ? questionResults.filter((r) => !r.isCorrect)
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

  const scrollToQuestion = useCallback((index: number) => {
    setExpandedQuestions((prev) => new Set(prev).add(index))
    setTimeout(() => {
      document
        .getElementById(`sr-question-${index}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 100)
  }, [])

  const isPassing = summary.score >= PASS_THRESHOLD
  const initials = participant ? getInitials(participant.name) : ""

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
                <Avatar className="h-14 w-14">
                  <AvatarImage
                    src={participant.image ?? undefined}
                    alt={participant.name}
                  />
                  <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    {initials}
                  </AvatarFallback>
                </Avatar>
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
                getScoreBgGradient(summary.score, accent),
              )}
            >
              <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
                {/* Score */}
                <div className="text-center md:text-left">
                  <div className="mb-2 flex items-center justify-center gap-3 md:justify-start">
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
                        getScoreColor(summary.score, accent),
                      )}
                    >
                      {summary.score}%
                    </motion.span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">
                    {summary.correct} sur {questions.length} questions réussies
                  </p>
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
                      {getScoreLabel(summary.score, accent)}
                    </Badge>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-4 md:gap-6">
                  <div className="flex flex-col items-center rounded-xl bg-white/60 px-4 py-3 dark:bg-gray-800/60">
                    <div className="flex items-center gap-2">
                      <CircleCheckBig className="h-5 w-5 text-green-500" />
                      <span className="text-2xl font-bold text-green-600 dark:text-green-400">
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
                      <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {summary.incorrect}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Incorrectes
                    </span>
                  </div>

                  {summary.unanswered > 0 && (
                    <div className="flex flex-col items-center rounded-xl bg-white/60 px-4 py-3 dark:bg-gray-800/60">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-gray-500" />
                        <span className="text-2xl font-bold text-gray-600 dark:text-gray-400">
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

              {/* Progress bar */}
              <div className="mt-6">
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
                    animate={{ width: `${summary.score}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full",
                      getScoreProgressColor(summary.score, accent),
                    )}
                  />
                  {/* 60% marker */}
                  <div
                    className="absolute top-0 h-full w-0.5 bg-gray-900/30 dark:bg-white/30"
                    style={{ left: "60%" }}
                  />
                </div>
              </div>
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
                <Button variant="outline" size="sm" onClick={expandAll}>
                  Tout déplier
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAll}>
                  Tout replier
                </Button>
              </div>
            </div>

            {/* Questions list */}
            <div className="space-y-4">
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
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <QuestionCard
                        variant="review"
                        question={result.question as never}
                        lazyExplanation={lazyExplanation}
                        lazyReferences={lazyReferences}
                        questionNumber={originalIndex + 1}
                        userAnswer={result.userAnswer}
                        isExpanded={expandedQuestions.has(originalIndex)}
                        onToggleExpand={() =>
                          toggleQuestionExpand(originalIndex)
                        }
                      />
                      {/* Explanation images (Feature 3 will populate these) */}
                      {lazyExplanationImages.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2 px-4">
                          {lazyExplanationImages.map((img) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={img.storagePath}
                              src={img.url}
                              alt="Image d'explication"
                              className="max-h-48 rounded-lg border border-gray-200 dark:border-gray-700"
                            />
                          ))}
                        </div>
                      )}
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
  score: number
  backHref: string
  backLabel: string
  backIcon: React.ReactNode
}

export function SessionResultsHeader({
  title,
  subtitle,
  score,
  backHref,
  backLabel,
  backIcon,
}: SessionResultsHeaderProps) {
  const isPassing = score >= PASS_THRESHOLD
  return (
    <div className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/80 backdrop-blur-xl dark:border-gray-700/50 dark:bg-gray-900/80">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br shadow-lg",
                isPassing
                  ? "from-green-500 to-emerald-600"
                  : "from-amber-500 to-orange-600",
              )}
            >
              {isPassing ? (
                <Trophy className="h-6 w-6 text-white" />
              ) : (
                <Target className="h-6 w-6 text-white" />
              )}
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
