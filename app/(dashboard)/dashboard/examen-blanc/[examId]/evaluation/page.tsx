"use client"

import { useMutation, useQuery } from "convex/react"
import {
  AlertTriangle,
  CheckCircle,
  Coffee,
  FileText,
  Flag,
  Lock,
  ShieldAlert,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Calculator } from "@/components/quiz/calculator"
import { LabValues } from "@/components/quiz/lab-values"
import { PauseApproachingAlert } from "@/components/quiz/pause-approaching-alert"
import { PauseDialog } from "@/components/quiz/pause-dialog"
import { QuestionCard } from "@/components/quiz/question-card"
import { SessionHeader } from "@/components/quiz/session/session-header"
import { QuestionNavigator } from "@/components/quiz/session/question-navigator"
import { SessionToolbar } from "@/components/quiz/session/session-toolbar"
import { FinishDialog } from "@/components/quiz/session/finish-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { CalculatorProvider } from "@/hooks/useCalculator"
import {
  PausePhase,
  isQuestionAccessible,
  shouldTriggerPause,
  isTimeRunningOut as checkTimeRunningOut,
  isTimeCritical as checkTimeCritical,
} from "@/lib/exam-timer"
import {
  saveAnswersToStorage,
  loadAnswersFromStorage,
  clearAnswersFromStorage,
} from "@/lib/exam-storage"

const AssessmentPage = () => {
  const params = useParams()
  const router = useRouter()
  const examId = params.examId as Id<"exams">

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(
    new Set()
  )
  const [serverStartTime, setServerStartTime] = useState<number | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [showWarningDialog, setShowWarningDialog] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)
  const [isLabValuesOpen, setIsLabValuesOpen] = useState(false)
  const hasCompletedRef = useRef(false)
  const correctAnswersRef = useRef<Record<string, string>>({})

  // Pause-related state
  const [pausePhase, setPausePhase] = useState<PausePhase | undefined>(
    undefined
  )
  const [pauseStartedAt, setPauseStartedAt] = useState<number | undefined>(
    undefined
  )
  const [totalPauseDurationMs, setTotalPauseDurationMs] = useState<number>(0)
  const [showPauseDialog, setShowPauseDialog] = useState(false)
  const [showEarlyPauseDialog, setShowEarlyPauseDialog] = useState(false)
  const [isResuming, setIsResuming] = useState(false)
  const pauseTriggeredRef = useRef(false)

  const examWithQuestions = useQuery(api.exams.getExamWithQuestions, { examId })
  const examSession = useQuery(api.exams.getExamSession, { examId })
  const pauseStatus = useQuery(api.exams.getPauseStatus, { examId })
  const startExam = useMutation(api.exams.startExam)
  const submitAnswers = useMutation(api.exams.submitExamAnswers)
  const startPauseMutation = useMutation(api.exams.startPause)
  const resumeFromPauseMutation = useMutation(api.exams.resumeFromPause)

  // Stocker les réponses correctes dès le chargement des questions
  useEffect(() => {
    if (!examWithQuestions) return

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

  // Restaurer les réponses depuis localStorage (si disponibles)
  useEffect(() => {
    const savedAnswers = loadAnswersFromStorage(examId)
    if (savedAnswers && Object.keys(savedAnswers).length > 0) {
      setAnswers(savedAnswers)
      toast.info("Réponses précédentes restaurées")
    }
  }, [examId])

  // Sync pause state from server
  useEffect(() => {
    if (!examSession) return

    setPausePhase(examSession.pausePhase as PausePhase | undefined)
    setPauseStartedAt(examSession.pauseStartedAt)

    if (examSession.totalPauseDurationMs) {
      setTotalPauseDurationMs(examSession.totalPauseDurationMs)
    }

    if (
      examSession.pausePhase === "during_pause" &&
      examSession.pauseStartedAt
    ) {
      setShowPauseDialog(true)
    }
  }, [examSession])

  // Initialiser ou reprendre la session
  useEffect(() => {
    if (!examWithQuestions || !examSession) return
    if (isSubmitting || hasCompletedRef.current) return

    const initializeSession = () => {
      // Vérifier si l'examen a déjà été soumis (completed ou auto_submitted)
      if (
        examSession.status === "completed" ||
        examSession.status === "auto_submitted"
      ) {
        toast.info("Cet examen a déjà été soumis")
        clearAnswersFromStorage(examId)
        router.push("/dashboard/examen-blanc")
        return
      }

      if (examSession.status === "in_progress" && examSession.startedAt) {
        setServerStartTime(examSession.startedAt)

        const now = Date.now()
        let elapsedTime = now - examSession.startedAt

        // Soustraire la durée de pause du temps écoulé
        if (examSession.totalPauseDurationMs) {
          elapsedTime = elapsedTime - examSession.totalPauseDurationMs
        }

        const totalTime = examWithQuestions.completionTime * 1000
        const remaining = Math.max(0, totalTime - elapsedTime)

        // Si le temps est épuisé, soumettre automatiquement les réponses du localStorage
        if (remaining <= 0) {
          // Charger les réponses depuis localStorage
          const savedAnswers = loadAnswersFromStorage(examId)
          const hasAnswers = savedAnswers && Object.keys(savedAnswers).length > 0

          // Préparer les réponses correctes
          const correctAnswersMap: Record<string, string> = {}
          examWithQuestions.questions.forEach((question) => {
            if (question) {
              correctAnswersMap[question._id] = question.correctAnswer
            }
          })

          const formattedAnswers = hasAnswers
            ? Object.entries(savedAnswers).map(([questionId, selectedAnswer]) => ({
                questionId: questionId as Id<"questions">,
                selectedAnswer,
              }))
            : [] // Pas de réponses = tableau vide = score 0

          // Soumettre automatiquement (même sans réponses pour fermer la session)
          setIsSubmitting(true)
          submitAnswers({
            examId,
            answers: formattedAnswers,
            correctAnswers: correctAnswersMap,
            isAutoSubmit: true,
          })
            .then(() => {
              hasCompletedRef.current = true
              clearAnswersFromStorage(examId)
              if (hasAnswers) {
                toast.success("Temps écoulé ! Vos réponses ont été enregistrées automatiquement.")
              } else {
                toast.warning("Session expirée. Aucune réponse n'a été trouvée.")
              }
              router.push("/dashboard/examen-blanc")
            })
            .catch((error) => {
              console.error("Erreur auto-submit:", error)
              clearAnswersFromStorage(examId)
              toast.error("Le temps est écoulé. Redirection...")
              router.push("/dashboard/examen-blanc")
            })
            .finally(() => {
              setIsSubmitting(false)
            })
          return
        }

        setTimeRemaining(remaining)

        if (examSession.pausePhase) {
          setPausePhase(examSession.pausePhase as PausePhase)
          if (examSession.pauseStartedAt) {
            setPauseStartedAt(examSession.pauseStartedAt)
          }
          if (examSession.pausePhase === "during_pause") {
            setShowPauseDialog(true)
          }
        }

        toast.info("Session reprise - Le timer continue")
        setShowWarningDialog(false)
        return
      }
    }

    initializeSession()
  }, [examWithQuestions, examSession, router, isSubmitting, examId, submitAnswers])

  // Handle starting the pause
  const handleStartPause = useCallback(
    async (manualTrigger: boolean = false) => {
      try {
        const result = await startPauseMutation({ examId, manualTrigger })
        setPausePhase("during_pause")
        setPauseStartedAt(result.pauseStartedAt)
        setShowPauseDialog(true)
        setShowEarlyPauseDialog(false)
        toast.info("⏸️ Pause - Prenez une pause bien méritée !", {
          duration: 5000,
        })
      } catch (error) {
        console.error("Error starting pause:", error)
        toast.error("Erreur lors du démarrage de la pause")
      }
    },
    [examId, startPauseMutation]
  )

  const handleEarlyPauseClick = () => {
    setShowEarlyPauseDialog(true)
  }

  const handleConfirmEarlyPause = () => {
    handleStartPause(true)
  }

  // Auto-trigger pause at midpoint
  useEffect(() => {
    if (!serverStartTime || !examWithQuestions || !pauseStatus?.enablePause)
      return
    if (pausePhase !== "before_pause" || pauseTriggeredRef.current) return
    if (showPauseDialog || isSubmitting) return

    const checkPauseTrigger = () => {
      if (
        shouldTriggerPause(serverStartTime, examWithQuestions.completionTime)
      ) {
        pauseTriggeredRef.current = true
        handleStartPause(false)
      }
    }

    checkPauseTrigger()
    const timer = setInterval(checkPauseTrigger, 1000)

    return () => clearInterval(timer)
  }, [
    serverStartTime,
    examWithQuestions,
    pauseStatus,
    pausePhase,
    showPauseDialog,
    isSubmitting,
    handleStartPause,
  ])

  // Handle resuming from pause
  const handleResumePause = useCallback(async () => {
    setIsResuming(true)
    try {
      const result = await resumeFromPauseMutation({ examId })
      setPausePhase("after_pause")
      setShowPauseDialog(false)

      if (result.totalPauseDurationMs) {
        setTotalPauseDurationMs(result.totalPauseDurationMs)
      }

      if (result.isPauseCutShort) {
        toast.success(
          "Pause écourtée - Toutes les questions sont maintenant déverrouillées !"
        )
      } else {
        toast.success("Pause terminée - Continuez l'examen !")
      }

      const totalQuestions = examWithQuestions?.questions.length || 0
      const midpoint = Math.floor(totalQuestions / 2)
      setCurrentQuestionIndex(midpoint)
    } catch (error) {
      toast.error("Erreur lors de la reprise de l'examen")
      console.error(error)
    } finally {
      setIsResuming(false)
    }
  }, [examId, resumeFromPauseMutation, examWithQuestions])

  // Start exam
  const handleStartExam = async () => {
    try {
      const result = await startExam({ examId })
      setServerStartTime(result.startedAt)

      if (result.pausePhase) {
        setPausePhase(result.pausePhase as PausePhase)
      }

      if (examWithQuestions) {
        setTimeRemaining(examWithQuestions.completionTime * 1000)
      }

      setShowWarningDialog(false)
      toast.success("Examen démarré - Bonne chance !")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors du démarrage de l'examen"
      )
      router.push("/dashboard/examen-blanc")
    }
  }

  // Auto-submit when time runs out
  const handleAutoSubmit = useCallback(async () => {
    if (isSubmitting || hasCompletedRef.current) return

    setIsSubmitting(true)
    try {
      const formattedAnswers = Object.entries(answers).map(
        ([questionId, selectedAnswer]) => ({
          questionId: questionId as Id<"questions">,
          selectedAnswer,
        })
      )

      await submitAnswers({
        examId,
        answers: formattedAnswers,
        correctAnswers: correctAnswersRef.current,
        isAutoSubmit: true,
      })

      hasCompletedRef.current = true
      clearAnswersFromStorage(examId)

      toast.success(
        "Temps écoulé ! Vos réponses ont été enregistrées automatiquement."
      )
      router.push("/dashboard/examen-blanc")
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue"
      console.error("Erreur auto-submit:", error)

      // Si l'erreur indique que l'examen est déjà soumis ou temps écoulé, rediriger
      if (
        errorMessage.includes("Temps écoulé") ||
        errorMessage.includes("déjà passé") ||
        errorMessage.includes("plus active")
      ) {
        toast.error("Le temps est écoulé. Redirection...")
        clearAnswersFromStorage(examId)
        router.push("/dashboard/examen-blanc")
      } else {
        toast.error(`Erreur: ${errorMessage}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [answers, examId, submitAnswers, router, isSubmitting])

  // Timer
  useEffect(() => {
    if (!serverStartTime || !examWithQuestions) return
    if (pausePhase === "during_pause") return

    const timer = setInterval(() => {
      const now = Date.now()
      let elapsedTime = now - serverStartTime

      if (pausePhase === "after_pause" && totalPauseDurationMs > 0) {
        elapsedTime = elapsedTime - totalPauseDurationMs
      }

      const totalTime = examWithQuestions.completionTime * 1000
      const remaining = Math.max(0, totalTime - elapsedTime)

      setTimeRemaining(remaining)

      if (remaining <= 0) {
        handleAutoSubmit()
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [
    serverStartTime,
    examWithQuestions,
    handleAutoSubmit,
    pausePhase,
    totalPauseDurationMs,
  ])

  // Detect navigation/refresh
  useEffect(() => {
    if (!serverStartTime) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        toast.warning(
          "Attention ! Changer d'onglet est détecté. Restez sur cette page.",
          { duration: 5000 }
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

  // Answer selection
  const handleAnswerSelect = (answerIndex: number) => {
    if (!currentQuestion) return

    const totalQuestions = examWithQuestions?.questions.length || 0
    const accessCheck = isQuestionAccessible(
      currentQuestionIndex,
      totalQuestions,
      pausePhase
    )
    if (!accessCheck.allowed) {
      toast.error(accessCheck.reason || "Question verrouillée")
      return
    }

    const selectedOption = currentQuestion.options[answerIndex]
    setAnswers((prev) => {
      const newAnswers = { ...prev, [currentQuestion._id]: selectedOption }
      // Sauvegarder dans localStorage pour survivre aux refreshs
      saveAnswersToStorage(examId, newAnswers)
      return newAnswers
    })
  }

  // Flag toggle
  const handleFlagToggle = (questionId: string) => {
    setFlaggedQuestions((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(questionId)) {
        newSet.delete(questionId)
      } else {
        newSet.add(questionId)
      }
      return newSet
    })
  }

  // Navigation with pause restrictions
  const goToQuestion = (index: number) => {
    const totalQuestions = examWithQuestions?.questions.length || 0
    if (index < 0 || index >= totalQuestions) return

    const accessCheck = isQuestionAccessible(index, totalQuestions, pausePhase)
    if (!accessCheck.allowed) {
      toast.error(accessCheck.reason || "Question verrouillée")
      return
    }

    setCurrentQuestionIndex(index)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Check if question is locked
  const isQuestionLocked = (index: number): boolean => {
    const totalQuestions = examWithQuestions?.questions.length || 0
    const accessCheck = isQuestionAccessible(index, totalQuestions, pausePhase)
    return !accessCheck.allowed
  }

  // Calculate pause-related info
  const totalQuestions = examWithQuestions?.questions.length || 0
  const midpoint = Math.floor(totalQuestions / 2)

  const firstWaveQuestionIds =
    examWithQuestions?.questions
      .slice(0, midpoint)
      .filter((q) => q)
      .map((q) => q!._id) || []
  const firstWaveAnsweredCount = firstWaveQuestionIds.filter(
    (id) => answers[id]
  ).length
  const firstWaveRemainingCount = midpoint - firstWaveAnsweredCount

  const canTakeEarlyPause =
    pausePhase === "before_pause" && firstWaveRemainingCount === 0

  // Manual submit
  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const formattedAnswers = Object.entries(answers).map(
        ([questionId, selectedAnswer]) => ({
          questionId: questionId as Id<"questions">,
          selectedAnswer,
          isFlagged: flaggedQuestions.has(questionId),
        })
      )

      await submitAnswers({
        examId,
        answers: formattedAnswers,
        correctAnswers: correctAnswersRef.current,
      })

      hasCompletedRef.current = true
      clearAnswersFromStorage(examId)

      toast.success(
        "Examen terminé ! Vos réponses ont été enregistrées avec succès."
      )
      router.push("/dashboard/examen-blanc")
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur lors de la soumission"

      // Si l'erreur indique que l'examen est déjà soumis, rediriger
      if (
        errorMessage.includes("déjà passé") ||
        errorMessage.includes("plus active")
      ) {
        clearAnswersFromStorage(examId)
        router.push("/dashboard/examen-blanc")
      }

      toast.error(errorMessage)
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
  const answeredCount = Object.keys(answers).length
  const isTimeRunningOut = checkTimeRunningOut(timeRemaining)
  const isTimeCritical = checkTimeCritical(timeRemaining)

  // Convert answers for QuestionNavigator format
  const navigatorAnswers: Record<string, { selectedAnswer: string }> = {}
  Object.entries(answers).forEach(([id, answer]) => {
    navigatorAnswers[id] = { selectedAnswer: answer }
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
      {/* Header */}
      <SessionHeader
        config={{
          mode: "exam",
          showTimer: true,
          timeRemaining,
          isTimeRunningOut,
          isTimeCritical,
          showCalculator: true,
          showLabValues: true,
          showFlagging: true,
          accentColor: "blue",
        }}
        currentIndex={currentQuestionIndex}
        totalQuestions={totalQuestions}
        answeredCount={answeredCount}
        onFinish={() => setShowSubmitDialog(true)}
        title={examWithQuestions.title}
        icon={<FileText className="h-5 w-5 text-white" />}
        backUrl="/dashboard/examen-blanc"
        examActions={{
          onTakePause: pauseStatus?.enablePause && pausePhase === "before_pause" ? handleEarlyPauseClick : undefined,
          canTakePause: pauseStatus?.enablePause && pausePhase === "before_pause",
        }}
      />

      {/* Main content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          {/* Left column - Question */}
          <div className="space-y-6">
            {/* Pause Approaching Alert */}
            {pauseStatus?.enablePause &&
              pausePhase === "before_pause" &&
              firstWaveRemainingCount >= 0 &&
              firstWaveRemainingCount <= 10 && (
                <PauseApproachingAlert
                  questionsRemaining={firstWaveRemainingCount}
                  questionsAnswered={firstWaveAnsweredCount}
                  midpoint={midpoint}
                  totalQuestions={totalQuestions}
                  canTakeEarlyPause={canTakeEarlyPause}
                  onTakeEarlyPause={handleEarlyPauseClick}
                  className="mb-4"
                />
              )}

            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestionIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {currentQuestion && (
                  <QuestionCard
                    variant="exam"
                    question={currentQuestion}
                    questionNumber={currentQuestionIndex + 1}
                    selectedAnswer={answers[currentQuestion._id] || null}
                    onAnswerSelect={handleAnswerSelect}
                    isFlagged={flaggedQuestions.has(currentQuestion._id)}
                    onFlagToggle={() => handleFlagToggle(currentQuestion._id)}
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
                disabled={
                  currentQuestionIndex === 0 ||
                  isQuestionLocked(currentQuestionIndex - 1)
                }
                className="flex items-center gap-2"
              >
                {isQuestionLocked(currentQuestionIndex - 1) ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <span>←</span>
                )}
                Précédent
              </Button>

              <div className="text-sm text-gray-500 dark:text-gray-400">
                {pausePhase === "before_pause" && (
                  <span className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
                    <Coffee className="h-4 w-4" />
                    Partie 1/2
                  </span>
                )}
                {pausePhase === "after_pause" && (
                  <span className="flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    Toutes questions déverrouillées
                  </span>
                )}
              </div>

              {currentQuestionIndex === totalQuestions - 1 ? (
                <Button
                  onClick={() => setShowSubmitDialog(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  <CheckCircle className="h-4 w-4" />
                  Terminer
                </Button>
              ) : (
                <Button
                  onClick={() => goToQuestion(currentQuestionIndex + 1)}
                  disabled={isQuestionLocked(currentQuestionIndex + 1)}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {isQuestionLocked(currentQuestionIndex + 1) ? (
                    <>
                      <Lock className="h-4 w-4" />
                      Verrouillé
                    </>
                  ) : (
                    <>
                      Suivant
                      <span>→</span>
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Mobile buttons */}
            <div className="flex flex-col gap-3 sm:hidden">
              {pauseStatus?.enablePause && pausePhase === "before_pause" && (
                <Button
                  onClick={handleEarlyPauseClick}
                  variant="outline"
                  size="lg"
                  className="w-full border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                >
                  <Coffee className="mr-2 h-4 w-4" />
                  Prendre la pause maintenant
                </Button>
              )}

              {(!pauseStatus?.enablePause || pausePhase === "after_pause") && (
                <Button
                  onClick={() => setShowSubmitDialog(true)}
                  disabled={isSubmitting}
                  size="lg"
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 font-semibold text-white shadow-lg hover:from-green-700 hover:to-emerald-700"
                >
                  <Flag className="mr-2 h-4 w-4" />
                  Terminer l&apos;examen
                </Button>
              )}
            </div>
          </div>

          {/* Right column - Navigation Sidebar */}
          <div className="hidden lg:block">
            <QuestionNavigator
              questions={examWithQuestions.questions.filter((q): q is NonNullable<typeof q> => q !== null)}
              answers={navigatorAnswers}
              flaggedQuestions={flaggedQuestions}
              currentIndex={currentQuestionIndex}
              onNavigate={goToQuestion}
              isQuestionLocked={isQuestionLocked}
              accentColor="blue"
            />
          </div>
        </div>
      </div>

      {/* Mobile question navigator FAB */}
      <div className="fixed bottom-6 left-6 lg:hidden">
        <QuestionNavigator
          questions={examWithQuestions.questions.filter((q): q is NonNullable<typeof q> => q !== null)}
          answers={navigatorAnswers}
          flaggedQuestions={flaggedQuestions}
          currentIndex={currentQuestionIndex}
          onNavigate={goToQuestion}
          variant="mobile"
          isQuestionLocked={isQuestionLocked}
          accentColor="blue"
        />
      </div>

      {/* Floating toolbar */}
      <SessionToolbar
        showCalculator={true}
        onOpenCalculator={() => setIsCalculatorOpen(true)}
        showLabValues={true}
        onOpenLabValues={() => setIsLabValuesOpen(true)}
        showScrollTop={true}
      />

      {/* Calculator Dialog */}
      <Calculator
        isOpen={isCalculatorOpen}
        onOpenChange={setIsCalculatorOpen}
      />

      {/* Lab Values Dialog */}
      <LabValues
        isOpen={isLabValuesOpen}
        onOpenChange={setIsLabValuesOpen}
      />

      {/* Finish Dialog */}
      <FinishDialog
        isOpen={showSubmitDialog}
        onOpenChange={setShowSubmitDialog}
        answeredCount={answeredCount}
        totalQuestions={totalQuestions}
        flaggedCount={flaggedQuestions.size}
        isSubmitting={isSubmitting}
        onConfirm={handleSubmit}
        mode="exam"
        timeRemaining={timeRemaining}
        confirmText="Terminer l'examen"
        cancelText="Continuer l'examen"
      />

      {/* Early Pause Confirmation Dialog */}
      <Dialog
        open={showEarlyPauseDialog}
        onOpenChange={setShowEarlyPauseDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coffee className="h-5 w-5 text-amber-500" />
              Prendre la pause maintenant ?
            </DialogTitle>
            <div className="space-y-3 pt-2">
              <p>
                Vous êtes sur le point de prendre votre pause avant le moment
                prévu.
              </p>

              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Conséquences importantes :
                    </p>
                    <ul className="list-inside list-disc space-y-1 text-amber-700 dark:text-amber-300">
                      <li>Vous ne pourrez pas prendre de seconde pause</li>
                      <li>
                        Les questions de la seconde moitié seront déverrouillées
                        après la pause
                      </li>
                      <li>Le chronomètre reprendra à la fin de votre pause</li>
                    </ul>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400">
                Durée de la pause :{" "}
                <span className="font-semibold">
                  {pauseStatus?.pauseDurationMinutes || 15} minutes
                </span>
              </p>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEarlyPauseDialog(false)}
            >
              Continuer l&apos;examen
            </Button>
            <Button
              onClick={handleConfirmEarlyPause}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Coffee className="mr-2 h-4 w-4" />
              Prendre la pause
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pause Dialog */}
      {pauseStatus && (
        <PauseDialog
          isOpen={showPauseDialog}
          onResume={handleResumePause}
          pauseStartedAt={pauseStartedAt}
          pauseDurationMinutes={pauseStatus.pauseDurationMinutes || 15}
          totalQuestions={examWithQuestions.questions.length}
          midpoint={Math.ceil(examWithQuestions.questions.length / 2)}
          isResuming={isResuming}
        />
      )}

      {/* Warning Dialog at start */}
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
                  Mesures anti-fraude activées
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
                  Informations sur l&apos;examen
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
              onClick={() => router.push("/dashboard/examen-blanc")}
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
