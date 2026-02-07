"use client"

import { useState, useMemo, useCallback } from "react"
import { useIsVisible } from "@/hooks/use-is-visible"
import { useConvexAuth, useQuery } from "convex/react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { motion } from "motion/react"
import {
  Trophy,
  Target,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Plus,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { api } from "@/convex/_generated/api"
import type { Id, Doc } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { QuestionCard } from "@/components/quiz/question-card"
import { ResultsQuestionNavigator } from "@/components/quiz/results"
import { SessionToolbar } from "@/components/quiz/session/session-toolbar"
import { cn } from "@/lib/utils"

export default function TrainingResultsPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as Id<"trainingParticipations">
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()

  const { ref: desktopNavRef, isVisible: isDesktopNavVisible } = useIsVisible()
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(
    new Set()
  )
  const [showErrorsOnly, setShowErrorsOnly] = useState(false)

  // Skip query until authenticated to avoid race condition on page reload
  const results = useQuery(
    api.training.getTrainingSessionResults,
    isAuthenticated ? { sessionId } : "skip"
  )

  // Type for answers
  type AnswerRecord = Record<
    string,
    { selectedAnswer: string; isCorrect: boolean }
  >

  // Derived data
  const { session, questions, answers } = useMemo(() => {
    if (!results || "error" in results) {
      return {
        session: null,
        questions: [] as Doc<"questions">[],
        answers: {} as AnswerRecord,
      }
    }
    return {
      session: results.session,
      questions: results.questions as Doc<"questions">[],
      answers: results.answers as AnswerRecord,
    }
  }, [results])

  // Stats
  const stats = useMemo(() => {
    if (!session || !questions.length) return null

    const correctCount = Object.values(answers).filter((a) => a.isCorrect).length
    const incorrectCount = Object.values(answers).filter(
      (a) => !a.isCorrect
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
    if (!questions.length) return []

    if (showErrorsOnly) {
      return questions.filter((q) => {
        const answer = answers[q._id.toString()]
        return !answer || !answer.isCorrect
      })
    }

    return questions
  }, [questions, answers, showErrorsOnly])

  // Pre-build index map to avoid O(n²) findIndex inside .map()
  // Not a real perf concern at current training sizes (~50 questions max),
  // but avoids the quadratic pattern for correctness.
  const questionIndexMap = useMemo(
    () => new Map(questions.map((q, i) => [q._id.toString(), i])),
    [questions],
  )

  // Question results for navigator
  const questionResults = useMemo(() => {
    return questions.map((q) => {
      const answer = answers[q._id.toString()]
      return {
        isCorrect: answer?.isCorrect ?? false,
        isAnswered: !!answer,
      }
    })
  }, [questions, answers])

  // Toggle question expansion
  const toggleQuestion = (questionId: string) => {
    setExpandedQuestions((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(questionId)) {
        newSet.delete(questionId)
      } else {
        newSet.add(questionId)
      }
      return newSet
    })
  }

  // Expand/collapse all
  const expandAll = () => {
    setExpandedQuestions(new Set(questions.map((q) => q._id.toString())))
  }

  const collapseAll = () => {
    setExpandedQuestions(new Set())
  }

  // Navigate to question with scroll
  const scrollToQuestion = useCallback(
    (index: number) => {
      const questionId = questions[index]?._id.toString()
      if (!questionId) return

      // Expand the question if needed
      if (!expandedQuestions.has(questionId)) {
        setExpandedQuestions((prev) => new Set([...prev, questionId]))
      }

      // Double requestAnimationFrame ensures DOM is fully updated after React render
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const element = document.getElementById(`question-${index + 1}`)
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        })
      })
    },
    [questions, expandedQuestions]
  )

  // Loading state (auth loading or results loading)
  if (isAuthLoading || !results) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-gray-600 dark:text-gray-400">
            Chargement des résultats...
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if ("error" in results) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-800 dark:bg-amber-900/20">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
          <h1 className="mb-2 font-display text-xl font-bold text-amber-900 dark:text-amber-100">
            Session non terminée
          </h1>
          <p className="mb-6 text-amber-700 dark:text-amber-300">
            Cette session n&apos;est pas encore terminée.
          </p>
          <Button
            onClick={() => router.push(`/dashboard/entrainement/${sessionId}`)}
            className="bg-amber-500 hover:bg-amber-600"
          >
            Retourner à la session
          </Button>
        </div>
      </div>
    )
  }

  if (!stats) return null

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
                    : "bg-linear-to-br from-amber-500 to-orange-600"
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
                scoreBgGradient
              )}
            >
              <div className="flex flex-col items-center text-center sm:flex-row sm:text-left">
                {/* Score */}
                <div className="mb-6 sm:mb-0 sm:mr-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      damping: 10,
                      delay: 0.2,
                    }}
                    className={cn(
                      "font-display text-7xl font-black",
                      scoreColor
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
                      <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
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
                      <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
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
                        : "[&>div]:bg-red-500"
                    )}
                  />
                  {/* 60% threshold marker */}
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
                    onClick={() => setShowErrorsOnly(!showErrorsOnly)}
                    className={cn(
                      showErrorsOnly &&
                        "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
                    )}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    {showErrorsOnly
                      ? "Voir toutes"
                      : `Erreurs (${stats.incorrectCount + stats.unansweredCount})`}
                  </Button>

                  <Button variant="ghost" size="sm" onClick={expandAll}>
                    Tout ouvrir
                  </Button>
                  <Button variant="ghost" size="sm" onClick={collapseAll}>
                    Tout fermer
                  </Button>
                </div>
              </div>

              {/* Questions list */}
              <div className="space-y-4">
                {filteredQuestions.map((question, index) => {
                  const answer = answers[question._id.toString()]
                  const userAnswer = answer?.selectedAnswer ?? null
                  const isExpanded = expandedQuestions.has(
                    question._id.toString()
                  )

                  const originalIndex = questionIndexMap.get(
                    question._id.toString(),
                  ) ?? index

                  return (
                    <motion.div
                      key={question._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <QuestionCard
                        question={question}
                        variant="review"
                        questionNumber={originalIndex + 1}
                        userAnswer={userAnswer}
                        isExpanded={isExpanded}
                        onToggleExpand={() =>
                          toggleQuestion(question._id.toString())
                        }
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
