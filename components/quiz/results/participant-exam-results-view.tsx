"use client"

import {
  CircleCheckBig,
  CircleX,
  Clock,
  Target,
  TrendingUp,
  Trophy,
  User,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { QuestionCard } from "@/components/quiz/question-card"
import { ResultsQuestionNavigator } from "@/components/quiz/results"
import { SessionToolbar } from "@/components/quiz/session/session-toolbar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { loadExamQuestionExplanations } from "@/features/exams/actions"
import type {
  ExamParticipantUser,
  ExamQuestionView,
} from "@/features/exams/dal"
import { useIsVisible } from "@/hooks/use-is-visible"
import { cn, getInitials } from "@/lib/utils"

export interface ParticipantResultAnswer {
  questionId: string
  selectedAnswer: string | null
  isCorrect: boolean | null
}

interface ParticipantExamResultsViewProps {
  examTitle: string
  /** Questions en forme « pont » (avec `correctAnswer`). */
  questions: ExamQuestionView[]
  answers: ParticipantResultAnswer[]
  score: number
  backHref: string
  backLabel: string
  backIcon: ReactNode
  /** Présent ⇒ vue admin : carte d'identité du participant + encart admin. */
  participantUser?: ExamParticipantUser
}

const PASS_THRESHOLD = 60

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-green-600 dark:text-green-400"
  if (score >= PASS_THRESHOLD) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

const getScoreBgColor = (score: number) => {
  if (score >= 80)
    return "from-green-500/20 to-emerald-500/20 dark:from-green-500/10 dark:to-emerald-500/10"
  if (score >= PASS_THRESHOLD)
    return "from-amber-500/20 to-orange-500/20 dark:from-amber-500/10 dark:to-orange-500/10"
  return "from-red-500/20 to-rose-500/20 dark:from-red-500/10 dark:to-rose-500/10"
}

export function ParticipantExamResultsView({
  examTitle,
  questions,
  answers,
  score,
  backHref,
  backLabel,
  backIcon,
  participantUser,
}: ParticipantExamResultsViewProps) {
  const { ref: desktopNavRef, isVisible: isDesktopNavVisible } = useIsVisible()
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
    new Set([0]),
  )
  const [showOnlyIncorrect, setShowOnlyIncorrect] = useState(false)

  // Lazy-load des explications : on ne charge que les questions nouvellement
  // dépliées (via Server Action), accumulées dans une map. `loadedIds` évite de
  // re-fetcher ; le setState est asynchrone (dans `.then`) donc hors du piège
  // `react-hooks/set-state-in-effect`.
  const [explanationsMap, setExplanationsMap] = useState<
    Map<string, { explanation: string; references?: string[] }>
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
    const toLoad = expandedQuestionIds.filter(
      (id) => !loadedIds.current.has(id),
    )
    if (toLoad.length === 0) return
    let active = true
    loadExamQuestionExplanations(toLoad).then((rows) => {
      if (!active) return
      setExplanationsMap((prev) => {
        const next = new Map(prev)
        for (const row of rows) {
          next.set(row.questionId, {
            explanation: row.explanation,
            references: row.references,
          })
        }
        return next
      })
      for (const id of toLoad) loadedIds.current.add(id)
    })
    return () => {
      active = false
    }
  }, [expandedQuestionIds])

  const results = useMemo(() => {
    const answersMap = new Map(answers.map((a) => [a.questionId, a] as const))
    let correct = 0
    let incorrect = 0
    let unanswered = 0

    const questionResults = questions.map((question) => {
      const userAnswerData = answersMap.get(question._id)
      const userAnswer = userAnswerData?.selectedAnswer ?? null
      const isCorrect = userAnswerData?.isCorrect ?? false
      const isAnswered = userAnswer !== null

      if (isAnswered) {
        if (isCorrect) correct++
        else incorrect++
      } else {
        unanswered++
      }

      return { question, userAnswer, isCorrect, isAnswered }
    })

    return {
      correct,
      incorrect,
      unanswered,
      totalQuestions: questions.length,
      scorePercentage: score,
      isPassing: score >= PASS_THRESHOLD,
      questionResults,
    }
  }, [questions, answers, score])

  const navigatorResults = useMemo(
    () =>
      results.questionResults.map((r) => ({
        isCorrect: r.isCorrect,
        isAnswered: r.isAnswered,
      })),
    [results],
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
    setExpandedQuestions(
      new Set(results.questionResults.map((_, index) => index)),
    )

  const collapseAll = () => setExpandedQuestions(new Set())

  const scrollToQuestion = (index: number) => {
    setExpandedQuestions((prev) => new Set(prev).add(index))
    setTimeout(() => {
      document
        .getElementById(`question-${index}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 100)
  }

  const filteredResults = showOnlyIncorrect
    ? results.questionResults.filter((r) => !r.isCorrect)
    : results.questionResults

  // Index stable (évite le O(n²) `indexOf` dans le `.map`).
  const resultIndexMap = useMemo(
    () => new Map(results.questionResults.map((r, i) => [r, i])),
    [results],
  )

  const initials = getInitials(participantUser?.name)

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/80 backdrop-blur-xl dark:border-gray-700/50 dark:bg-gray-900/80">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br shadow-lg",
                  results.isPassing
                    ? "from-green-500 to-emerald-600"
                    : "from-amber-500 to-orange-600",
                )}
              >
                {results.isPassing ? (
                  <Trophy className="h-6 w-6 text-white" />
                ) : (
                  <Target className="h-6 w-6 text-white" />
                )}
              </motion.div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Résultats de l&apos;examen
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {examTitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" asChild>
                <Link href={backHref} className="flex items-center gap-2">
                  {backIcon}
                  <span className="hidden sm:inline">{backLabel}</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          {/* Left column - Results & Questions */}
          <div className="space-y-8">
            {/* Participant Info Card (vue admin) */}
            {participantUser && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-lg dark:border-gray-700/50 dark:bg-gray-800"
              >
                <Avatar className="h-14 w-14">
                  <AvatarImage
                    src={participantUser.image || undefined}
                    alt={participantUser.name || "Avatar"}
                  />
                  <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Résultats de {participantUser.name}
                    </h2>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {participantUser.username
                      ? `@${participantUser.username} · `
                      : ""}
                    {participantUser.email}
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

            {/* Score Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-2xl border border-gray-200/80 bg-linear-to-br p-6 shadow-lg dark:border-gray-700/50",
                getScoreBgColor(results.scorePercentage),
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
                        getScoreColor(results.scorePercentage),
                      )}
                    >
                      {results.scorePercentage}%
                    </motion.span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">
                    {results.correct} sur {results.totalQuestions} questions
                    réussies
                  </p>
                  <div className="mt-3">
                    <Badge
                      data-testid="score-badge"
                      className={cn(
                        "px-4 py-1 text-sm font-semibold",
                        results.isPassing
                          ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
                      )}
                    >
                      {results.isPassing ? "Réussi" : "À améliorer"}
                    </Badge>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-4 md:gap-6">
                  <div className="flex flex-col items-center rounded-xl bg-white/60 px-4 py-3 dark:bg-gray-800/60">
                    <div className="flex items-center gap-2">
                      <CircleCheckBig className="h-5 w-5 text-green-500" />
                      <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {results.correct}
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
                        {results.incorrect}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Incorrectes
                    </span>
                  </div>

                  {results.unanswered > 0 && (
                    <div className="flex flex-col items-center rounded-xl bg-white/60 px-4 py-3 dark:bg-gray-800/60">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-gray-500" />
                        <span className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                          {results.unanswered}
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
                    Seuil de réussite: 60%
                  </span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${results.scorePercentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full",
                      results.scorePercentage >= 80
                        ? "bg-linear-to-r from-green-500 to-emerald-500"
                        : results.scorePercentage >= PASS_THRESHOLD
                          ? "bg-linear-to-r from-amber-500 to-orange-500"
                          : "bg-linear-to-r from-red-500 to-rose-500",
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
                  data-testid="btn-filter-incorrect"
                  variant={showOnlyIncorrect ? "default" : "outline"}
                  onClick={() => setShowOnlyIncorrect(!showOnlyIncorrect)}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <CircleX className="h-4 w-4" />
                  Voir uniquement les erreurs
                  {showOnlyIncorrect && (
                    <Badge
                      variant="secondary"
                      className="ml-1 bg-white/20 text-white"
                    >
                      {results.incorrect}
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

            {/* Questions List */}
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredResults.map((result, index) => {
                  const originalIndex = resultIndexMap.get(result) ?? index
                  return (
                    <motion.div
                      key={result.question._id}
                      id={`question-${originalIndex}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <QuestionCard
                        variant="review"
                        question={result.question as never}
                        lazyExplanation={
                          explanationsMap.get(result.question._id)?.explanation
                        }
                        lazyReferences={
                          explanationsMap.get(result.question._id)?.references
                        }
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

          {/* Right column - Navigation Sidebar (desktop) */}
          <div className="hidden lg:block">
            <div ref={desktopNavRef} className="h-1" />
            <div className="sticky top-24 space-y-4">
              <ResultsQuestionNavigator
                questionResults={navigatorResults}
                onNavigateToQuestion={scrollToQuestion}
                variant="desktop"
                accentColor="blue"
                showTips={!participantUser}
              />

              {participantUser && (
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
                    {participantUser.name || "ce participant"}. Utilisez cette
                    vue pour analyser les performances.
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating toolbar: scroll-to-top + nav FAB */}
      <SessionToolbar
        showScrollTop={true}
        showNavFab={!isDesktopNavVisible}
        navFab={
          <ResultsQuestionNavigator
            questionResults={navigatorResults}
            onNavigateToQuestion={scrollToQuestion}
            variant="mobile"
            accentColor="blue"
          />
        }
      />
    </div>
  )
}
