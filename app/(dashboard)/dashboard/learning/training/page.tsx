"use client"

import { useQuery } from "convex/react"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calculator as CalculatorIcon,
  CheckCircle,
  Home,
  RefreshCw,
  Target,
  Trophy,
  X,
  XCircle,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { Calculator } from "@/components/quiz/calculator"
import { QuestionCard } from "@/components/quiz/question-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { api } from "@/convex/_generated/api"
import { Doc } from "@/convex/_generated/dataModel"
import { CalculatorProvider } from "@/hooks/useCalculator"
import { cn } from "@/lib/utils"

const TrainingContent = () => {
  const router = useRouter()
  const searchParams = useSearchParams()

  const domain = searchParams.get("domain") || "all"
  const count = parseInt(searchParams.get("count") || "10")

  const [questions, setQuestions] = useState<Doc<"questions">[]>([])
  const [prevRandomQuestions, setPrevRandomQuestions] = useState<
    Doc<"questions">[] | undefined
  >(undefined)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState<string | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [answeredQuestions, setAnsweredQuestions] = useState<
    Map<number, { answer: string; isCorrect: boolean }>
  >(new Map())
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [showExitDialog, setShowExitDialog] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [showReviewMode, setShowReviewMode] = useState(false)
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
    new Set(),
  )
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)

  const randomQuestions = useQuery(
    api.questions.getRandomLearningBankQuestions,
    {
      count,
      domain: domain === "all" ? undefined : domain,
    },
  )

  if (
    randomQuestions &&
    randomQuestions.length > 0 &&
    randomQuestions !== prevRandomQuestions &&
    questions.length === 0
  ) {
    setPrevRandomQuestions(randomQuestions)
    setQuestions(randomQuestions)
  }

  const currentQuestion = questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100
  const isLastQuestion = currentQuestionIndex === questions.length - 1

  const handleAnswerSelect = (answerIndex: number) => {
    if (showFeedback || !currentQuestion) return
    const selectedOption = currentQuestion.options[answerIndex]
    setUserAnswer(selectedOption)
  }

  const handleAnswerSubmit = () => {
    if (!userAnswer || !currentQuestion) return

    const isCorrect = userAnswer === currentQuestion.correctAnswer
    if (isCorrect) {
      setCorrectAnswers((prev) => prev + 1)
    }

    setAnsweredQuestions((prev) => {
      const newMap = new Map(prev)
      newMap.set(currentQuestionIndex, { answer: userAnswer, isCorrect })
      return newMap
    })
    setShowFeedback(true)
  }

  const handleNextQuestion = () => {
    if (isLastQuestion) {
      setShowCompleteDialog(true)
    } else {
      setCurrentQuestionIndex((prev) => prev + 1)
      setUserAnswer(null)
      setShowFeedback(false)
      // Scroll to top of the page
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
      const previousAnswer = answeredQuestions.get(currentQuestionIndex - 1)
      if (previousAnswer) {
        setUserAnswer(previousAnswer.answer)
        setShowFeedback(true)
      } else {
        setUserAnswer(null)
        setShowFeedback(false)
      }
      // Scroll to top of the page
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const handleExit = () => {
    router.push("/dashboard/learning")
  }

  const handleRestart = () => {
    window.location.reload()
  }

  const handleViewReview = () => {
    setShowCompleteDialog(false)
    setShowReviewMode(true)
    // Expand all questions for review
    setExpandedQuestions(new Set(questions.map((_, i) => i)))
  }

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

  if (!questions || questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Chargement des questions d&apos;entraînement...
          </p>
        </motion.div>
      </div>
    )
  }

  const isCorrect = userAnswer === currentQuestion?.correctAnswer
  const scorePercentage =
    questions.length > 0
      ? Math.round((correctAnswers / questions.length) * 100)
      : 0

  // Review mode - show all questions with answers
  if (showReviewMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
        {/* Header */}
        <div className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/80 backdrop-blur-xl dark:border-gray-700/50 dark:bg-gray-900/80">
          <div className="mx-auto max-w-5xl px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg"
                >
                  <BookOpen className="h-5 w-5 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    Révision de l&apos;entraînement
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {correctAnswers} / {questions.length} bonnes réponses (
                    {scorePercentage}%)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleRestart}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Recommencer
                </Button>
                <Button
                  onClick={handleExit}
                  className="flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Terminer
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Questions review list */}
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="space-y-4">
            {questions.map((question, index) => {
              const answerData = answeredQuestions.get(index)
              return (
                <QuestionCard
                  key={question._id}
                  variant="review"
                  question={question}
                  questionNumber={index + 1}
                  userAnswer={answerData?.answer ?? null}
                  isExpanded={expandedQuestions.has(index)}
                  onToggleExpand={() => toggleQuestionExpand(index)}
                />
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Interactive training mode
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/80 backdrop-blur-xl dark:border-gray-700/50 dark:bg-gray-900/80">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg"
              >
                <Target className="h-5 w-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Entraînement
                </h1>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                  >
                    Question {currentQuestionIndex + 1} / {questions.length}
                  </Badge>
                  {domain !== "all" && (
                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                      {domain}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Score indicator */}
              <div className="hidden items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm sm:flex dark:border-gray-700 dark:bg-gray-800">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {correctAnswers}/{answeredQuestions.size}
                </span>
              </div>

              <Button
                variant="outline"
                onClick={() => setShowExitDialog(true)}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Quitter</span>
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Progression
              </span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {answeredQuestions.size} / {questions.length} répondues
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Question Card */}
            <QuestionCard
              variant="exam"
              question={currentQuestion}
              questionNumber={currentQuestionIndex + 1}
              selectedAnswer={userAnswer}
              onAnswerSelect={handleAnswerSelect}
              disabled={showFeedback}
              showImage={true}
              showCorrectAnswer={false}
            />

            {/* Submit button */}
            {!showFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 flex justify-center"
              >
                <Button
                  onClick={handleAnswerSubmit}
                  disabled={!userAnswer}
                  size="lg"
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:opacity-50"
                >
                  Valider ma réponse
                </Button>
              </motion.div>
            )}

            {/* Feedback section */}
            <AnimatePresence>
              {showFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mt-6"
                >
                  {/* Result banner */}
                  <div
                    className={cn(
                      "mb-6 rounded-2xl border-2 p-6",
                      isCorrect
                        ? "border-green-200 bg-green-50/80 dark:border-green-800 dark:bg-green-900/20"
                        : "border-red-200 bg-red-50/80 dark:border-red-800 dark:bg-red-900/20",
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-full",
                          isCorrect
                            ? "bg-green-100 dark:bg-green-900/50"
                            : "bg-red-100 dark:bg-red-900/50",
                        )}
                      >
                        {isCorrect ? (
                          <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                        ) : (
                          <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div>
                        <h3
                          className={cn(
                            "text-xl font-bold",
                            isCorrect
                              ? "text-green-700 dark:text-green-300"
                              : "text-red-700 dark:text-red-300",
                          )}
                        >
                          {isCorrect ? "Bonne réponse !" : "Réponse incorrecte"}
                        </h3>
                        {!isCorrect && (
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            La bonne réponse était :{" "}
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              {currentQuestion?.correctAnswer}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="space-y-4">
                    <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-5 dark:border-blue-800 dark:bg-blue-900/20">
                      <div className="mb-3 flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                          Explication
                        </h4>
                      </div>
                      <p className="leading-relaxed whitespace-pre-line text-blue-800 dark:text-blue-200">
                        {currentQuestion?.explanation}
                      </p>
                    </div>

                    {/* Objectif CMC */}
                    <div className="rounded-xl border border-purple-200 bg-purple-50/80 p-5 dark:border-purple-800 dark:bg-purple-900/20">
                      <div className="mb-3 flex items-center gap-2">
                        <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        <h4 className="font-semibold text-purple-900 dark:text-purple-100">
                          Objectif CMC
                        </h4>
                      </div>
                      <p className="leading-relaxed text-purple-800 dark:text-purple-200">
                        {currentQuestion?.objectifCMC}
                      </p>
                    </div>

                    {/* References */}
                    {currentQuestion?.references &&
                      currentQuestion.references.length > 0 && (
                        <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-5 dark:border-gray-700 dark:bg-gray-800/50">
                          <h4 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">
                            Références
                          </h4>
                          <div className="space-y-2">
                            {currentQuestion.references.map((ref, index) => (
                              <div
                                key={index}
                                className="border-l-2 border-blue-400 pl-3 text-sm leading-relaxed text-gray-700 dark:border-blue-500 dark:text-gray-300"
                              >
                                <span className="mr-2 font-semibold text-blue-600 dark:text-blue-400">
                                  {index + 1}.
                                </span>
                                {ref}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Navigation */}
                  <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6 dark:border-gray-700">
                    <Button
                      variant="outline"
                      onClick={handlePreviousQuestion}
                      disabled={currentQuestionIndex === 0}
                      className="flex items-center gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Précédent
                    </Button>

                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {answeredQuestions.size > 0 && (
                        <span className="font-medium">
                          Score actuel:{" "}
                          <span
                            className={cn(
                              correctAnswers / answeredQuestions.size >= 0.6
                                ? "text-green-600 dark:text-green-400"
                                : "text-amber-600 dark:text-amber-400",
                            )}
                          >
                            {Math.round(
                              (correctAnswers / answeredQuestions.size) * 100,
                            )}
                            %
                          </span>
                        </span>
                      )}
                    </div>

                    <Button
                      onClick={handleNextQuestion}
                      className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    >
                      {isLastQuestion ? "Terminer" : "Suivant"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Exit Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-red-500" />
              Quitter l&apos;entraînement ?
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir quitter votre session d&apos;entraînement
              ? Votre progression ne sera pas sauvegardée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowExitDialog(false)}>
              Continuer
            </Button>
            <Button
              onClick={handleExit}
              className="bg-red-600 hover:bg-red-700"
            >
              Quitter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completion Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <Trophy className="h-8 w-8 text-amber-500" />
              </motion.div>
            </DialogTitle>
            <div className="space-y-4 pt-4 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  "text-5xl font-bold",
                  scorePercentage >= 80
                    ? "text-green-600"
                    : scorePercentage >= 60
                      ? "text-amber-600"
                      : "text-red-600",
                )}
              >
                {scorePercentage}%
              </motion.div>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                {correctAnswers} / {questions.length} bonnes réponses
              </p>

              <div
                className={cn(
                  "rounded-xl p-4",
                  scorePercentage >= 80
                    ? "bg-green-50 dark:bg-green-900/20"
                    : scorePercentage >= 60
                      ? "bg-amber-50 dark:bg-amber-900/20"
                      : "bg-red-50 dark:bg-red-900/20",
                )}
              >
                <p
                  className={cn(
                    "text-sm font-medium",
                    scorePercentage >= 80
                      ? "text-green-700 dark:text-green-300"
                      : scorePercentage >= 60
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-red-700 dark:text-red-300",
                  )}
                >
                  {scorePercentage >= 80
                    ? "Excellent ! Vous maîtrisez bien ce sujet."
                    : scorePercentage >= 60
                      ? "Bien ! Continuez à vous entraîner."
                      : "Vous devez approfondir vos connaissances."}
                </p>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleRestart}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Recommencer
            </Button>
            <Button
              variant="outline"
              onClick={handleViewReview}
              className="flex items-center gap-2"
            >
              <BookOpen className="h-4 w-4" />
              Voir la révision
            </Button>
            <Button onClick={handleExit} className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Terminer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calculator Dialog */}
      <Calculator
        isOpen={isCalculatorOpen}
        onOpenChange={setIsCalculatorOpen}
      />

      {/* Floating Calculator Button */}
      <div className="fixed right-4 bottom-6 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <Button
            size="lg"
            onClick={() => setIsCalculatorOpen(true)}
            className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-600 to-violet-600 shadow-lg hover:from-purple-700 hover:to-violet-700 dark:from-purple-500 dark:to-violet-500 dark:hover:from-purple-400 dark:hover:to-violet-400"
            aria-label="Ouvrir la calculatrice"
          >
            <CalculatorIcon className="h-5 w-5" />
          </Button>
        </motion.div>
      </div>
    </div>
  )
}

const TrainingPage = () => {
  return (
    <CalculatorProvider>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
              <p className="text-gray-600 dark:text-gray-400">
                Chargement des questions d&apos;entraînement...
              </p>
            </div>
          </div>
        }
      >
        <TrainingContent />
      </Suspense>
    </CalculatorProvider>
  )
}

export default TrainingPage
