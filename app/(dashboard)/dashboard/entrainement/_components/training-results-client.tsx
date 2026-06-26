"use client"

import {
  ArrowLeft,
  CircleCheckBig,
  CircleX,
  Clock,
  Funnel,
  Plus,
  Target,
  Trophy,
} from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { QuestionCard } from "@/components/quiz/question-card"
import { ResultsQuestionNavigator } from "@/components/quiz/results"
import { SessionToolbar } from "@/components/quiz/session/session-toolbar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { TrainingResultsView } from "@/features/training/dal"
import { useIsVisible } from "@/hooks/use-is-visible"
import { cn } from "@/lib/utils"

type ResultsData = Exclude<NonNullable<TrainingResultsView>, { error: string }>

export function TrainingResultsClient({ results }: { results: ResultsData }) {
  const { ref: desktopNavRef, isVisible: isDesktopNavVisible } = useIsVisible()
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(
    new Set(),
  )
  const [showErrorsOnly, setShowErrorsOnly] = useState(false)

  const { session, questions, answers } = results

  // Stats
  const stats = useMemo(() => {
    const correctCount = Object.values(answers).filter(
      (a) => a.isCorrect,
    ).length
    const incorrectCount = Object.values(answers).filter(
      (a) => !a.isCorrect,
    ).length
    const unansweredCount = questions.length - Object.keys(answers).length

    return {
      score: session.score,
      correctCount,
      incorrectCount,
      unansweredCount,
      totalQuestions: session.questionCount,
    }
  }, [session, questions, answers])

  // Filtered questions
  const filteredQuestions = useMemo(() => {
    if (showErrorsOnly) {
      return questions.filter((q) => {
        const answer = answers[q._id]
        return !answer || !answer.isCorrect
      })
    }
    return questions
  }, [questions, answers, showErrorsOnly])

  const questionIndexMap = useMemo(
    () => new Map(questions.map((q, i) => [q._id, i])),
    [questions],
  )

  const questionResults = useMemo(
    () =>
      questions.map((q) => {
        const answer = answers[q._id]
        return {
          isCorrect: answer?.isCorrect ?? false,
          isAnswered: !!answer,
        }
      }),
    [questions, answers],
  )

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestions((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(questionId)) newSet.delete(questionId)
      else newSet.add(questionId)
      return newSet
    })
  }

  const expandAll = () => {
    setExpandedQuestions(new Set(questions.map((q) => q._id)))
  }

  const collapseAll = () => {
    setExpandedQuestions(new Set())
  }

  const scrollToQuestion = useCallback(
    (index: number) => {
      const questionId = questions[index]?._id
      if (!questionId) return

      if (!expandedQuestions.has(questionId)) {
        setExpandedQuestions((prev) => new Set([...prev, questionId]))
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const element = document.getElementById(`question-${index + 1}`)
          element?.scrollIntoView({ behavior: "smooth", block: "start" })
        })
      })
    },
    [questions, expandedQuestions],
  )

  const scoreColor =
    stats.score >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : stats.score >= 60
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400"

  const scoreBgGradient =
    stats.score >= 80
      ? "from-emerald-500/20 to-teal-500/20"
      : stats.score >= 60
        ? "from-amber-500/20 to-yellow-500/20"
        : "from-red-500/20 to-rose-500/20"

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200/60 bg-white/80 backdrop-blur-xl dark:border-gray-700/60 dark:bg-gray-900/80">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl shadow-md",
                  stats.score >= 60
                    ? "bg-linear-to-br from-emerald-500 to-teal-600"
                    : "bg-linear-to-br from-amber-500 to-orange-600",
                )}
              >
                {stats.score >= 60 ? (
                  <Trophy className="h-5 w-5 text-white" />
                ) : (
                  <Target className="h-5 w-5 text-white" />
                )}
              </div>
              <div>
                <h1 className="font-display text-lg font-bold text-gray-900 dark:text-white">
                  Résultats
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Session d&apos;entraînement
                </p>
              </div>
            </div>

            <Link href="/dashboard/entrainement">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Retour</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Main content */}
          <div className="space-y-8">
            {/* Score card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className={cn(
                "overflow-hidden rounded-2xl border border-gray-200/60 bg-linear-to-br p-8 shadow-lg backdrop-blur-sm dark:border-gray-700/60",
                scoreBgGradient,
              )}
            >
              <div className="flex flex-col items-center text-center sm:flex-row sm:text-left">
                {/* Score */}
                <div className="mb-6 sm:mr-8 sm:mb-0">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 10, delay: 0.2 }}
                    className={cn(
                      "font-display text-7xl font-black",
                      scoreColor,
                    )}
                  >
                    {stats.score}%
                  </motion.div>
                  <p className="mt-1 text-gray-600 dark:text-gray-400">
                    {stats.score >= 80
                      ? "Excellent !"
                      : stats.score >= 60
                        ? "Bien joué !"
                        : "Continuez à pratiquer"}
                  </p>
                </div>

                {/* Stats grid */}
                <div className="flex flex-1 flex-wrap justify-center gap-6 sm:justify-end">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                      <CircleCheckBig className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stats.correctCount}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Correctes
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
                      <CircleX className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stats.incorrectCount}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Incorrectes
                      </div>
                    </div>
                  </div>

                  {stats.unansweredCount > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
                        <Clock className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {stats.unansweredCount}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Sans réponse
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Progression
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    Seuil de réussite : 60%
                  </span>
                </div>
                <div className="relative">
                  <Progress
                    value={stats.score}
                    className={cn(
                      "h-3",
                      stats.score >= 60
                        ? "[&>div]:bg-emerald-500"
                        : "[&>div]:bg-red-500",
                    )}
                  />
                  <div
                    className="absolute top-0 h-3 w-0.5 bg-gray-400"
                    style={{ left: "60%" }}
                  />
                </div>
              </div>
            </motion.div>

            {/* Questions review */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="font-display text-xl font-bold text-gray-900 dark:text-white">
                  Révision des questions
                </h2>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="btn-filter-errors"
                    onClick={() => setShowErrorsOnly(!showErrorsOnly)}
                    className={cn(
                      showErrorsOnly &&
                        "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300",
                    )}
                  >
                    <Funnel className="mr-2 h-4 w-4" />
                    {showErrorsOnly
                      ? "Voir toutes"
                      : `Erreurs (${stats.incorrectCount + stats.unansweredCount})`}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="btn-expand-all"
                    onClick={expandAll}
                  >
                    Tout ouvrir
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="btn-collapse-all"
                    onClick={collapseAll}
                  >
                    Tout fermer
                  </Button>
                </div>
              </div>

              {/* Questions list */}
              <div className="space-y-4">
                {filteredQuestions.map((question, index) => {
                  const answer = answers[question._id]
                  const userAnswer = answer?.selectedAnswer ?? null
                  const isExpanded = expandedQuestions.has(question._id)
                  const originalIndex =
                    questionIndexMap.get(question._id) ?? index

                  return (
                    <motion.div
                      key={question._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <QuestionCard
                        question={question as never}
                        variant="review"
                        questionNumber={originalIndex + 1}
                        userAnswer={userAnswer}
                        isExpanded={isExpanded}
                        onToggleExpand={() => toggleQuestion(question._id)}
                      />
                    </motion.div>
                  )
                })}
              </div>

              {/* New session button */}
              <div className="pt-4">
                <Link href="/dashboard/entrainement">
                  <Button
                    size="lg"
                    className="w-full gap-2 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                  >
                    <Plus className="h-5 w-5" />
                    Nouvelle session
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Sidebar - Navigation grid (desktop) */}
          <div className="hidden lg:block">
            <div ref={desktopNavRef} className="h-1" />
            <ResultsQuestionNavigator
              questionResults={questionResults}
              onNavigateToQuestion={scrollToQuestion}
              variant="desktop"
              accentColor="emerald"
            />
          </div>
        </div>
      </div>

      {/* Floating toolbar: scroll-to-top + nav FAB */}
      <SessionToolbar
        showScrollTop={true}
        showNavFab={!isDesktopNavVisible}
        navFab={
          <ResultsQuestionNavigator
            questionResults={questionResults}
            onNavigateToQuestion={scrollToQuestion}
            variant="mobile"
            accentColor="emerald"
          />
        }
      />
    </div>
  )
}
