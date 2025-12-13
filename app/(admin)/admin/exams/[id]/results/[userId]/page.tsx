"use client"

import { useQuery } from "convex/react"
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  List,
  Target,
  TrendingUp,
  Trophy,
  User,
  XCircle,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { notFound, useParams } from "next/navigation"
import { useMemo, useState } from "react"
import { QuestionCard } from "@/components/quiz/question-card"
import { QuestionNavigationButtons } from "@/components/quiz/question-navigation-buttons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import { Doc, Id } from "@/convex/_generated/dataModel"
import { cn, getInitials } from "@/lib/utils"

type Question = Doc<"questions">

interface QuestionResult {
  question: Question
  userAnswer: string | null
  isCorrect: boolean
  isAnswered: boolean
}

interface ExamResults {
  correct: number
  incorrect: number
  unanswered: number
  totalQuestions: number
  scorePercentage: number
  isPassing: boolean
  questionResults: QuestionResult[]
}

const AdminParticipantResultsPage = () => {
  const params = useParams()
  const examId = params.id as Id<"exams">
  const userId = params.userId as Id<"users">

  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
    new Set([0]),
  )
  const [showOnlyIncorrect, setShowOnlyIncorrect] = useState(false)

  // Query avec la nouvelle fonction qui vérifie les permissions admin
  const participantResults = useQuery(api.exams.getParticipantExamResults, {
    examId,
    userId,
  })

  // Calculate results
  const results = useMemo((): ExamResults | null => {
    if (!participantResults || "error" in participantResults) return null

    const questions = participantResults.questions.filter(
      (q): q is Question => q !== null,
    )
    let correct = 0
    let incorrect = 0
    let unanswered = 0

    const questionResults: QuestionResult[] = questions.map(
      (question, index) => {
        const userAnswerData = participantResults.participant.answers[index]
        const userAnswer = userAnswerData?.selectedAnswer || null
        const isCorrect = userAnswerData?.isCorrect || false
        const isAnswered = userAnswer !== null

        if (isAnswered) {
          if (isCorrect) correct++
          else incorrect++
        } else {
          unanswered++
        }

        return { question, userAnswer, isCorrect, isAnswered }
      },
    )

    const totalQuestions = questions.length
    const scorePercentage = participantResults.participant.score
    const isPassing = scorePercentage >= 60

    return {
      correct,
      incorrect,
      unanswered,
      totalQuestions,
      scorePercentage,
      isPassing,
      questionResults,
    }
  }, [participantResults])

  const toggleQuestionExpand = (index: number) => {
    setExpandedQuestions((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const expandAll = () => {
    if (!results) return
    setExpandedQuestions(
      new Set(results.questionResults.map((_, index) => index)),
    )
  }

  const collapseAll = () => {
    setExpandedQuestions(new Set())
  }

  const scrollToQuestion = (index: number) => {
    // First expand the question, then scroll to it
    setExpandedQuestions((prev) => new Set(prev).add(index))

    // Use setTimeout to ensure the DOM has updated after expansion
    setTimeout(() => {
      const element = document.getElementById(`question-${index + 1}`)
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }, 100)
  }

  // Loading state
  if (participantResults === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Chargement des résultats...
          </p>
        </motion.div>
      </div>
    )
  }

  // No results found or access denied - show 404
  if (participantResults === null) {
    notFound()
  }

  // Check for error states (admin-only information)
  if ("error" in participantResults) {
    const participantUser = participantResults.participantUser
    const initials = getInitials(participantUser?.name)

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
        {/* Header */}
        <div className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/80 backdrop-blur-xl dark:border-gray-700/50 dark:bg-gray-900/80">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg"
                >
                  <Clock className="h-6 w-6 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    Résultats non disponibles
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {participantResults.exam.title}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" asChild>
                  <Link
                    href={`/admin/exams/${examId}`}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      Retour au classement
                    </span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="mx-auto max-w-4xl px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Participant Info Card */}
            {participantUser && (
              <div className="flex items-center gap-4 rounded-2xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/50 dark:bg-gray-800">
                <Avatar className="h-16 w-16">
                  <AvatarImage
                    src={participantUser.image || undefined}
                    alt={participantUser.name || "Avatar"}
                  />
                  <AvatarFallback className="bg-blue-100 text-xl text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {participantUser.name}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    @{participantUser.username} · {participantUser.email}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  Participant
                </Badge>
              </div>
            )}

            {/* Error Message Card */}
            <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50 p-8 shadow-lg dark:border-amber-700/50 dark:from-amber-900/20 dark:to-orange-900/20">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50">
                  {participantResults.error === "NO_PARTICIPATION" ? (
                    <User className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 text-lg font-semibold text-amber-900 dark:text-amber-100">
                    {participantResults.error === "NO_PARTICIPATION"
                      ? "Aucune participation"
                      : "Examen en cours"}
                  </h3>
                  <p className="text-amber-800 dark:text-amber-200">
                    {participantResults.message}
                  </p>
                  {participantResults.error === "NOT_COMPLETED" &&
                    "status" in participantResults && (
                      <div className="mt-4">
                        <Badge
                          variant="outline"
                          className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-200"
                        >
                          Statut: {participantResults.status}
                        </Badge>
                      </div>
                    )}
                </div>
              </div>
            </div>

            {/* Info Card */}
            <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/50 dark:bg-gray-800">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <Trophy className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Que faire ?
              </h3>
              <ul className="space-y-3 text-gray-600 dark:text-gray-400">
                <li className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                  <span>
                    Retournez au classement pour voir les autres participants
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                  <span>
                    Les résultats seront disponibles une fois que le participant
                    aura terminé l&apos;examen
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                  <span>
                    Vérifiez la liste des participants pour voir qui a déjà
                    complété l&apos;examen
                  </span>
                </li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // Normal results display - participant has completed
  if (!results) {
    notFound()
  }

  const filteredResults = showOnlyIncorrect
    ? results.questionResults.filter((r) => !r.isCorrect)
    : results.questionResults

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400"
    if (score >= 60) return "text-amber-600 dark:text-amber-400"
    return "text-red-600 dark:text-red-400"
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 80)
      return "from-green-500/20 to-emerald-500/20 dark:from-green-500/10 dark:to-emerald-500/10"
    if (score >= 60)
      return "from-amber-500/20 to-orange-500/20 dark:from-amber-500/10 dark:to-orange-500/10"
    return "from-red-500/20 to-rose-500/20 dark:from-red-500/10 dark:to-rose-500/10"
  }

  const participantUser = participantResults.participantUser
  const initials = getInitials(participantUser?.name)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/80 backdrop-blur-xl dark:border-gray-700/50 dark:bg-gray-900/80">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
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
                  {participantResults.exam.title}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" asChild>
                <Link
                  href={`/admin/exams/${examId}`}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Retour au classement</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 xl:grid-cols-[1fr_280px]">
          {/* Left column - Results & Questions */}
          <div className="space-y-8">
            {/* Participant Info Card */}
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
                    @{participantUser.username} · {participantUser.email}
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
                "rounded-2xl border border-gray-200/80 bg-gradient-to-br p-6 shadow-lg dark:border-gray-700/50",
                getScoreBgColor(results.scorePercentage),
              )}
            >
              <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
                {/* Score */}
                <div className="text-center md:text-left">
                  <div className="mb-2 flex items-center justify-center gap-3 md:justify-start">
                    <motion.span
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
                      <CheckCircle className="h-5 w-5 text-green-500" />
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
                      <XCircle className="h-5 w-5 text-red-500" />
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
                        ? "bg-gradient-to-r from-green-500 to-emerald-500"
                        : results.scorePercentage >= 60
                          ? "bg-gradient-to-r from-amber-500 to-orange-500"
                          : "bg-gradient-to-r from-red-500 to-rose-500",
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
                  variant={showOnlyIncorrect ? "default" : "outline"}
                  onClick={() => setShowOnlyIncorrect(!showOnlyIncorrect)}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <XCircle className="h-4 w-4" />
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
                  const originalIndex = results.questionResults.indexOf(result)
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
                        question={result.question}
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

          {/* Right column - Navigation Sidebar */}
          <div className="hidden xl:block">
            <div className="sticky top-24">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="mb-4 flex items-center gap-2">
                  <List className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Navigation
                  </h3>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {results.questionResults.map((result, index) => (
                    <button
                      key={index}
                      onClick={() => scrollToQuestion(index)}
                      className={cn(
                        "flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-sm font-medium transition-all hover:scale-105",
                        result.isCorrect
                          ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                          : !result.isAnswered
                            ? "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                            : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50",
                      )}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>

                <div className="mt-6 space-y-3 border-t border-gray-200 pt-6 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Correct ({results.correct})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Incorrect ({results.incorrect})
                    </span>
                  </div>
                  {results.unanswered > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Sans réponse ({results.unanswered})
                      </span>
                    </div>
                  )}
                </div>

                {/* Admin info section */}
                <div className="mt-6 rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
                  <div className="mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                      Vue administrateur
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-purple-800 dark:text-purple-200">
                    Vous consultez les résultats de{" "}
                    {participantUser?.name || "ce participant"}. Utilisez cette
                    vue pour analyser les performances.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation - Floating draggable buttons */}
      <QuestionNavigationButtons
        questionResults={results.questionResults}
        onNavigateToQuestion={scrollToQuestion}
      />
    </div>
  )
}

export default AdminParticipantResultsPage
