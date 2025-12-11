"use client"

import { useMutation, useQuery } from "convex/react"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  Flag,
  List,
  ShieldAlert,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Calculator } from "@/components/quiz/calculator"
import { QuestionCard } from "@/components/quiz/question-card"
import { QuestionNavigationButtons } from "@/components/quiz/question-navigation-buttons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { CalculatorProvider } from "@/hooks/useCalculator"
import { cn } from "@/lib/utils"

const AssessmentPage = () => {
  const params = useParams()
  const router = useRouter()
  const examId = params.examId as Id<"exams">

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [serverStartTime, setServerStartTime] = useState<number | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [showWarningDialog, setShowWarningDialog] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)
  const hasCompletedRef = useRef(false)
  const correctAnswersRef = useRef<Record<string, string>>({})

  const examWithQuestions = useQuery(api.exams.getExamWithQuestions, { examId })
  const examSession = useQuery(api.exams.getExamSession, { examId })
  const startExam = useMutation(api.exams.startExam)
  const submitAnswers = useMutation(api.exams.submitExamAnswers)

  // Stocker les réponses correctes dès le chargement des questions
  useEffect(() => {
    if (!examWithQuestions) return

    // Peupler le cache des réponses correctes une seule fois
    if (Object.keys(correctAnswersRef.current).length === 0) {
      const correctAnswersMap: Record<string, string> = {}
      examWithQuestions.questions.forEach((question) => {
        if (question) {
          correctAnswersMap[question._id] = question.correctAnswer
        }
      })
      correctAnswersRef.current = correctAnswersMap
    }
  }, [examWithQuestions])

  // Initialiser ou reprendre la session
  useEffect(() => {
    if (!examWithQuestions || !examSession) return
    if (isSubmitting || hasCompletedRef.current) return

    const initializeSession = async () => {
      // Si session en cours - reprendre le timer
      if (examSession.status === "in_progress" && examSession.startedAt) {
        setServerStartTime(examSession.startedAt)

        // Calculer le temps restant
        const now = Date.now()
        const elapsedTime = now - examSession.startedAt
        const totalTime = examWithQuestions.completionTime * 1000
        const remaining = Math.max(0, totalTime - elapsedTime)
        setTimeRemaining(remaining)

        toast.info("Session reprise - Le timer continue")
        setShowWarningDialog(false)
        return
      }

      // Si session complétée, rediriger
      if (examSession.status === "completed") {
        toast.error("Vous avez déjà passé cet examen")
        router.push("/dashboard/mock-exam")
        return
      }
    }

    initializeSession()
  }, [examWithQuestions, examSession, router, isSubmitting])

  // Démarrer l'examen après acceptation de l'avertissement
  const handleStartExam = async () => {
    try {
      const result = await startExam({ examId })
      setServerStartTime(result.startedAt)

      if (examWithQuestions) {
        setTimeRemaining(examWithQuestions.completionTime * 1000)
      }

      setShowWarningDialog(false)
      toast.success("Examen démarré - Bonne chance !")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors du démarrage de l'examen",
      )
      router.push("/dashboard/mock-exam")
    }
  }

  // Soumission automatique quand le temps est écoulé
  const handleAutoSubmit = useCallback(async () => {
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      const formattedAnswers = Object.entries(answers).map(
        ([questionId, selectedAnswer]) => ({
          questionId: questionId as Id<"questions">,
          selectedAnswer,
        }),
      )

      await submitAnswers({
        examId,
        answers: formattedAnswers,
        correctAnswers: correctAnswersRef.current,
        isAutoSubmit: true,
      })

      hasCompletedRef.current = true

      toast.success(
        "Temps écoulé ! Vos réponses ont été enregistrées automatiquement.",
      )
      router.push("/dashboard/mock-exam")
    } catch (error) {
      toast.error("Erreur lors de la soumission automatique")
      console.error(error)
    }
  }, [answers, examId, submitAnswers, router, isSubmitting])

  // Timer basé sur le serveur
  useEffect(() => {
    if (!serverStartTime || !examWithQuestions) return

    const timer = setInterval(() => {
      const now = Date.now()
      const elapsedTime = now - serverStartTime
      const totalTime = examWithQuestions.completionTime * 1000
      const remaining = Math.max(0, totalTime - elapsedTime)

      setTimeRemaining(remaining)

      if (remaining <= 0) {
        handleAutoSubmit()
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [serverStartTime, examWithQuestions, handleAutoSubmit])

  // Détection de navigation/refresh - Avertissement
  useEffect(() => {
    if (!serverStartTime) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        toast.warning(
          "Attention ! Changer d'onglet est détecté. Restez sur cette page.",
          { duration: 5000 },
        )
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [serverStartTime])

  // Formatage du temps
  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((ms % (1000 * 60)) / 1000)
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  // Gestion des réponses via QuestionCard
  const handleAnswerSelect = (answerIndex: number) => {
    if (!currentQuestion) return
    const selectedOption = currentQuestion.options[answerIndex]
    setAnswers((prev) => ({ ...prev, [currentQuestion._id]: selectedOption }))
  }

  // Navigation
  const goToQuestion = (index: number) => {
    if (index >= 0 && index < (examWithQuestions?.questions.length || 0)) {
      setCurrentQuestionIndex(index)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  // Soumission manuelle
  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const formattedAnswers = Object.entries(answers).map(
        ([questionId, selectedAnswer]) => ({
          questionId: questionId as Id<"questions">,
          selectedAnswer,
        }),
      )

      await submitAnswers({
        examId,
        answers: formattedAnswers,
        correctAnswers: correctAnswersRef.current,
      })

      hasCompletedRef.current = true

      toast.success(
        "Examen terminé ! Vos réponses ont été enregistrées avec succès.",
      )
      router.push("/dashboard/mock-exam")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la soumission",
      )
    } finally {
      setIsSubmitting(false)
      setShowSubmitDialog(false)
    }
  }

  if (!examWithQuestions) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Chargement de l&apos;examen...
          </p>
        </motion.div>
      </div>
    )
  }

  const currentQuestion = examWithQuestions.questions[currentQuestionIndex]
  const progress =
    ((currentQuestionIndex + 1) / examWithQuestions.questions.length) * 100
  const answeredCount = Object.keys(answers).length
  const isTimeRunningOut = timeRemaining < 10 * 60 * 1000 // moins de 10 minutes
  const isTimeCritical = timeRemaining < 5 * 60 * 1000 // moins de 5 minutes

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
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg"
              >
                <Flag className="h-5 w-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 sm:text-xl dark:text-white">
                  {examWithQuestions.title}
                </h1>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                  >
                    Question {currentQuestionIndex + 1} /{" "}
                    {examWithQuestions.questions.length}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Timer */}
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-sm font-semibold shadow-sm transition-colors",
                  isTimeCritical
                    ? "animate-pulse border-2 border-red-400 bg-red-100 text-red-700 dark:border-red-600 dark:bg-red-900/30 dark:text-red-300"
                    : isTimeRunningOut
                      ? "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      : "border border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
                )}
              >
                <Clock
                  className={cn(
                    "h-4 w-4",
                    isTimeCritical
                      ? "text-red-600 dark:text-red-400"
                      : isTimeRunningOut
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-gray-500",
                  )}
                />
                <span>{formatTime(timeRemaining)}</span>
              </div>

              {/* Submit button */}
              <Button
                onClick={() => setShowSubmitDialog(true)}
                disabled={isSubmitting}
                className="hidden bg-gradient-to-r from-green-600 to-emerald-600 font-semibold text-white shadow-lg hover:from-green-700 hover:to-emerald-700 sm:flex"
              >
                <Flag className="mr-2 h-4 w-4" />
                Terminer
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
                {answeredCount} / {examWithQuestions.questions.length} répondues
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          {/* Left column - Question */}
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestionIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Question Card - No feedback in exam mode */}
                {currentQuestion && (
                  <QuestionCard
                    variant="exam"
                    question={currentQuestion}
                    questionNumber={currentQuestionIndex + 1}
                    selectedAnswer={answers[currentQuestion._id] || null}
                    onAnswerSelect={handleAnswerSelect}
                    showImage={true}
                    showCorrectAnswer={false}
                    showDomainBadge={false}
                    showObjectifBadge={false}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between border-t border-gray-200 pt-6 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => goToQuestion(currentQuestionIndex - 1)}
                disabled={currentQuestionIndex === 0}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Précédent
              </Button>

              <div className="text-sm text-gray-500 dark:text-gray-400">
                {answeredCount > 0 && (
                  <span className="font-medium">
                    {answeredCount} question{answeredCount > 1 ? "s" : ""}{" "}
                    répondue{answeredCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <Button
                onClick={() => goToQuestion(currentQuestionIndex + 1)}
                disabled={
                  currentQuestionIndex ===
                  examWithQuestions.questions.length - 1
                }
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                Suivant
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Mobile submit button */}
            <div className="flex justify-center sm:hidden">
              <Button
                onClick={() => setShowSubmitDialog(true)}
                disabled={isSubmitting}
                size="lg"
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 font-semibold text-white shadow-lg hover:from-green-700 hover:to-emerald-700"
              >
                <Flag className="mr-2 h-4 w-4" />
                Terminer l&apos;examen
              </Button>
            </div>
          </div>

          {/* Right column - Navigation Sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-32">
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

                <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-700/50">
                  {examWithQuestions.questions.length > 50 ? (
                    // Dense grid for large number of questions
                    <div className="grid grid-cols-6 gap-1">
                      {examWithQuestions.questions.map((question, index) => {
                        const isAnswered = question
                          ? answers[question._id]
                          : false
                        const isCurrent = index === currentQuestionIndex

                        return (
                          <button
                            key={index}
                            onClick={() => goToQuestion(index)}
                            title={`Question ${index + 1}`}
                            className={cn(
                              "relative flex h-7 w-7 cursor-pointer items-center justify-center rounded text-xs font-medium transition-all hover:scale-110",
                              isCurrent
                                ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-400 dark:ring-offset-gray-800"
                                : isAnswered
                                  ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                                  : "bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-400 dark:hover:bg-gray-500",
                            )}
                          >
                            {index + 1}
                            {isAnswered && !isCurrent && (
                              <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    // Regular grid for smaller number of questions
                    <div className="grid grid-cols-5 gap-2">
                      {examWithQuestions.questions.map((question, index) => {
                        const isAnswered = question
                          ? answers[question._id]
                          : false
                        const isCurrent = index === currentQuestionIndex

                        return (
                          <button
                            key={index}
                            onClick={() => goToQuestion(index)}
                            className={cn(
                              "relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-sm font-medium transition-all hover:scale-105",
                              isCurrent
                                ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-800"
                                : isAnswered
                                  ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600",
                            )}
                          >
                            {index + 1}
                            {isAnswered && !isCurrent && (
                              <CheckCircle className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-white text-green-600 dark:bg-gray-800" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-6 space-y-3 border-t border-gray-200 pt-6 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Répondue ({answeredCount})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-gray-300 dark:bg-gray-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Non répondue (
                      {examWithQuestions.questions.length - answeredCount})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-blue-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Question actuelle
                    </span>
                  </div>
                </div>

                {/* Warning section */}
                <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                  <div className="mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Rappel
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                    Vos réponses ne sont sauvegardées qu&apos;à la soumission
                    finale. Ne rafraîchissez pas la page.
                  </p>
                </div>

                {/* Submit button in sidebar */}
                <Button
                  onClick={() => setShowSubmitDialog(true)}
                  disabled={isSubmitting}
                  className="mt-4 w-full bg-gradient-to-r from-green-600 to-emerald-600 font-semibold text-white shadow-lg hover:from-green-700 hover:to-emerald-700"
                >
                  <Flag className="mr-2 h-4 w-4" />
                  Terminer l&apos;examen
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation - Unified question navigation */}
      <QuestionNavigationButtons
        questionResults={examWithQuestions.questions.map((question) => ({
          isAnswered: question ? !!answers[question._id] : false,
        }))}
        onNavigateToQuestion={goToQuestion}
        variant="exam"
        currentQuestionIndex={currentQuestionIndex}
        showCalculator={true}
        onOpenCalculator={() => setIsCalculatorOpen(true)}
      />

      {/* Calculator Dialog */}
      <Calculator
        isOpen={isCalculatorOpen}
        onOpenChange={setIsCalculatorOpen}
      />

      {/* Dialog de confirmation de soumission */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Terminer l&apos;examen
            </DialogTitle>
            <div className="space-y-3 pt-2">
              <p>Êtes-vous sûr de vouloir terminer l&apos;examen ?</p>

              <div className="space-y-2 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                <div className="flex justify-between text-sm">
                  <span>Questions répondues :</span>
                  <span className="font-medium">
                    {answeredCount} / {examWithQuestions.questions.length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Questions non répondues :</span>
                  <span className="font-medium text-amber-600">
                    {examWithQuestions.questions.length - answeredCount}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Temps restant :</span>
                  <span className="font-medium">
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              </div>

              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Une fois soumis, vous ne pourrez plus modifier vos réponses. Vos
                résultats seront disponibles une fois que tous les candidats
                auront terminé l&apos;examen.
              </p>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSubmitDialog(false)}
              disabled={isSubmitting}
            >
              Continuer l&apos;examen
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? "Soumission..." : "Terminer l'examen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog d'avertissement anti-fraude au démarrage */}
      <Dialog open={showWarningDialog} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-2xl"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              Règles importantes de l&apos;examen
            </DialogTitle>
            <div className="space-y-4 pt-4 text-base">
              <div className="rounded-lg bg-gradient-to-br from-red-50 to-orange-50 p-4 dark:from-red-950/30 dark:to-orange-950/30">
                <h3 className="mb-3 font-semibold text-red-900 dark:text-red-200">
                  🚫 Mesures anti-fraude activées
                </h3>
                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <span>
                      <strong>Session unique :</strong> Une fois démarré, vous
                      ne pouvez pas redémarrer l&apos;examen
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <span>
                      <strong>Timer serveur :</strong> Le temps continue même si
                      vous rafraîchissez la page
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <span>
                      <strong>PAS de sauvegarde automatique :</strong> Vos
                      réponses ne sont enregistrées qu&apos;à la soumission
                      finale
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <span>
                      <strong>Rafraîchir = Perte :</strong> Si vous
                      rafraîchissez la page, vos réponses cochées seront perdues
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <span>
                      <strong>Soumission auto :</strong> L&apos;examen sera
                      automatiquement soumis quand le temps est écoulé
                    </span>
                  </li>
                </ul>
              </div>

              <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                <h3 className="mb-2 font-semibold text-blue-900 dark:text-blue-200">
                  📋 Informations sur l&apos;examen
                </h3>
                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  <p>
                    • <strong>Questions :</strong>{" "}
                    {examWithQuestions?.questions.length || 0}
                  </p>
                  <p>
                    • <strong>Durée :</strong>{" "}
                    {Math.floor((examWithQuestions?.completionTime || 0) / 60)}{" "}
                    minutes
                  </p>
                  <p>
                    • <strong>Tentatives :</strong> 1 seule (impossible de
                    recommencer)
                  </p>
                </div>
              </div>

              <div className="rounded-lg border-2 border-amber-500 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-900/20">
                <p className="text-center font-semibold text-amber-900 dark:text-amber-200">
                  ⚠️ En cliquant sur &quot;Commencer&quot;, vous acceptez ces
                  conditions et démarrez votre session d&apos;examen unique
                </p>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/mock-exam")}
            >
              Annuler
            </Button>
            <Button
              onClick={handleStartExam}
              className="bg-gradient-to-r from-green-600 to-emerald-600 font-semibold text-white hover:from-green-700 hover:to-emerald-700"
            >
              Je comprends - Commencer l&apos;examen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const AssessmentPageWrapper = () => {
  return (
    <CalculatorProvider>
      <AssessmentPage />
    </CalculatorProvider>
  )
}

export default AssessmentPageWrapper
