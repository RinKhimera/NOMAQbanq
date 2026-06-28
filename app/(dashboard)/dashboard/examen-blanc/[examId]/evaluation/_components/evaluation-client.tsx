"use client"

import {
  CircleCheckBig,
  Coffee,
  FileText,
  Flag,
  Lock,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useRouter } from "next/navigation"
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"
import { Calculator } from "@/components/quiz/calculator"
import { LabValues } from "@/components/quiz/lab-values"
import { PauseApproachingAlert } from "@/components/quiz/pause-approaching-alert"
import { PauseDialog } from "@/components/quiz/pause-dialog"
import { QuestionCard } from "@/components/quiz/question-card"
import { FinishDialog } from "@/components/quiz/session/finish-dialog"
import { QuestionNavigator } from "@/components/quiz/session/question-navigator"
import { SessionHeader } from "@/components/quiz/session/session-header"
import { SessionToolbar } from "@/components/quiz/session/session-toolbar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  finalizeExam,
  pauseExam,
  resumeExam,
  saveExamAnswer,
  saveExamFlag,
  startExam,
} from "@/features/exams/actions"
import type { ExamQuestionView, ExamSessionView } from "@/features/exams/dal"
import { useIsVisible } from "@/hooks/use-is-visible"
import { CalculatorProvider } from "@/hooks/useCalculator"
import {
  calculateTimeRemaining,
  isTimeCritical as checkTimeCritical,
  isTimeRunningOut as checkTimeRunningOut,
} from "@/lib/exam-timer"

interface EvaluationExam {
  title: string
  completionTime: number
  enablePause: boolean
  pauseDurationMinutes: number | null
}

interface EvaluationClientProps {
  examId: string
  exam: EvaluationExam
  questions: ExamQuestionView[]
  /** Participation existante (reprise / déjà soumise) ; null = pas encore démarrée. */
  initialSession: ExamSessionView
  /** Horloge serveur au rendu (évite Date.now() dans le rendu — react-hooks/purity). */
  initialNow: number
}

const isInProgress = (s: ExamSessionView): boolean =>
  s?.status === "in_progress" && s.startedAt != null

function AssessmentPage({
  examId,
  exam,
  questions,
  initialSession,
  initialNow,
}: EvaluationClientProps) {
  const router = useRouter()

  const { ref: desktopNavRef, isVisible: isDesktopNavVisible } = useIsVisible()
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  // answers tracks selections client-side; each selection also fires saveExamAnswer.
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(
    new Set(),
  )

  // État initialisé synchroment depuis les props serveur (pas de sync-effect →
  // évite react-hooks/set-state-in-effect). `initialNow` sert d'horloge pure.
  const resuming = isInProgress(initialSession)
  const [serverStartTime, setServerStartTime] = useState<number | null>(
    resuming ? (initialSession?.startedAt ?? null) : null,
  )
  const [timeRemaining, setTimeRemaining] = useState(() => {
    if (resuming && initialSession?.startedAt) {
      const rem =
        calculateTimeRemaining(
          initialSession.startedAt,
          exam.completionTime,
          initialNow,
        ) - (initialSession.totalPauseDurationMs ?? 0)
      return Math.max(0, rem)
    }
    return exam.completionTime * 1000
  })
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [showWarningDialog, setShowWarningDialog] = useState(!initialSession)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)
  const [isLabValuesOpen, setIsLabValuesOpen] = useState(false)
  const hasCompletedRef = useRef(false)
  const didInitRef = useRef(false)

  // Pause state: isPaused = currently paused; hasUsedPause = pause already consumed.
  const [isPaused, setIsPaused] = useState<boolean>(
    initialSession?.isPaused ?? false,
  )
  const [hasUsedPause, setHasUsedPause] = useState<boolean>(
    // totalPauseDurationMs > 0 means the pause has been used and resumed.
    (initialSession?.totalPauseDurationMs ?? 0) > 0,
  )
  const [pauseStartedAt, setPauseStartedAt] = useState<number | undefined>(
    initialSession?.pauseStartedAt ?? undefined,
  )
  const [totalPauseDurationMs, setTotalPauseDurationMs] = useState<number>(
    initialSession?.totalPauseDurationMs ?? 0,
  )
  const [showPauseDialog, setShowPauseDialog] = useState(
    resuming && (initialSession?.isPaused ?? false),
  )
  const [showEarlyPauseDialog, setShowEarlyPauseDialog] = useState(false)
  const [isResuming, setIsResuming] = useState(false)

  const totalQuestions = questions.length
  const pauseDurationMinutes = exam.pauseDurationMinutes ?? 15

  // Auto-submit when time runs out. Uses finalizeExam (server computes score).
  const handleAutoSubmit = useCallback(async () => {
    if (isSubmitting || hasCompletedRef.current) return

    setIsSubmitting(true)
    try {
      const result = await finalizeExam({ examId, isAutoSubmit: true })

      if (result.success) {
        hasCompletedRef.current = true
        toast.success(
          "Temps écoulé ! Vos réponses ont été enregistrées automatiquement.",
        )
        router.push("/dashboard/examen-blanc")
        return
      }

      // Échecs « terminaux » : la session est de toute façon close → on sort.
      if (
        result.error.includes("Temps écoulé") ||
        result.error.includes("déjà passé") ||
        result.error.includes("plus active")
      ) {
        toast.error("Le temps est écoulé. Redirection...")
        router.push("/dashboard/examen-blanc")
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      console.error("Erreur auto-submit:", error)
      toast.error("Le temps est écoulé. Redirection...")
      router.push("/dashboard/examen-blanc")
    } finally {
      setIsSubmitting(false)
    }
  }, [examId, router, isSubmitting])

  // Initialisation au montage : redirection si déjà soumis, auto-submit si le
  // temps est déjà écoulé à la reprise, sinon toast de reprise.
  useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true
    if (!initialSession) return

    if (
      initialSession.status === "completed" ||
      initialSession.status === "auto_submitted"
    ) {
      toast.info("Cet examen a déjà été soumis")
      router.push("/dashboard/examen-blanc")
      return
    }

    if (isInProgress(initialSession) && initialSession.startedAt) {
      const rem =
        calculateTimeRemaining(
          initialSession.startedAt,
          exam.completionTime,
          Date.now(),
        ) - (initialSession.totalPauseDurationMs ?? 0)
      if (rem <= 0) {
        handleAutoSubmit()
        return
      }
      toast.info("Session reprise - Le timer continue")
    }
  }, [initialSession, examId, exam.completionTime, router, handleAutoSubmit])

  // Start exam
  const handleStartExam = async () => {
    try {
      const result = await startExam({ examId })
      if (!result.success) {
        toast.error(result.error)
        router.push("/dashboard/examen-blanc")
        return
      }
      setServerStartTime(result.startedAt)
      setTimeRemaining(exam.completionTime * 1000)
      setShowWarningDialog(false)
      toast.success("Examen démarré - Bonne chance !")
    } catch (error) {
      console.error("Error starting exam:", error)
      toast.error("Erreur lors du démarrage de l'examen")
      router.push("/dashboard/examen-blanc")
    }
  }

  // Handle starting the pause
  const handleStartPause = useCallback(async () => {
    try {
      const result = await pauseExam({ examId })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setIsPaused(true)
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
  }, [examId])

  const handleEarlyPauseClick = () => setShowEarlyPauseDialog(true)
  const handleConfirmEarlyPause = () => handleStartPause()

  // Handle resuming from pause
  const handleResumePause = useCallback(async () => {
    setIsResuming(true)
    try {
      const result = await resumeExam({ examId })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setIsPaused(false)
      setHasUsedPause(true)
      setShowPauseDialog(false)
      setTotalPauseDurationMs(result.totalPauseDurationMs ?? 0)
      toast.success("Pause terminée - Continuez l'examen !")
    } catch (error) {
      console.error("Error resuming from pause:", error)
      toast.error("Erreur lors de la reprise de l'examen")
    } finally {
      setIsResuming(false)
    }
  }, [examId])

  // Timer
  useEffect(() => {
    if (!serverStartTime) return
    if (isPaused) return

    const timer = setInterval(() => {
      const now = Date.now()
      const elapsedTime = now - serverStartTime - totalPauseDurationMs
      const totalTime = exam.completionTime * 1000
      const remaining = Math.max(0, totalTime - elapsedTime)

      setTimeRemaining(remaining)
      if (remaining <= 0) handleAutoSubmit()
    }, 1000)

    return () => clearInterval(timer)
  }, [
    serverStartTime,
    exam.completionTime,
    handleAutoSubmit,
    isPaused,
    totalPauseDurationMs,
  ])

  // Detect navigation/refresh
  useEffect(() => {
    if (!serverStartTime) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
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

  const currentQuestion = questions[currentQuestionIndex]

  // Answer selection — save server-side immediately (anti-cheat: score computed server-side).
  const handleAnswerSelect = useCallback(
    async (answerIndex: number) => {
      if (!currentQuestion) return
      if (isPaused) {
        toast.error("Réponse impossible pendant la pause.")
        return
      }

      const selectedOption = currentQuestion.options[answerIndex]
      // Optimistic update
      startTransition(() =>
        setAnswers((prev) => ({
          ...prev,
          [currentQuestion._id]: selectedOption,
        })),
      )

      const res = await saveExamAnswer({
        examId,
        questionId: currentQuestion._id,
        selectedAnswer: selectedOption,
      })
      if (!res.success) {
        // Roll back optimistic update on failure
        startTransition(() =>
          setAnswers((prev) => {
            const next = { ...prev }
            delete next[currentQuestion._id]
            return next
          }),
        )
        toast.error(res.error ?? "Erreur lors de l'enregistrement")
      }
    },
    [currentQuestion, examId, isPaused],
  )

  // Flag toggle — save server-side
  const handleFlagToggle = useCallback(
    async (questionId: string) => {
      const wasSet = flaggedQuestions.has(questionId)
      const isFlagged = !wasSet
      // Optimistic update
      startTransition(() =>
        setFlaggedQuestions((prev) => {
          const s = new Set(prev)
          if (isFlagged) s.add(questionId)
          else s.delete(questionId)
          return s
        }),
      )
      await saveExamFlag({ examId, questionId, isFlagged })
    },
    [examId, flaggedQuestions],
  )

  // Navigation — all questions accessible except when paused
  const isQuestionLocked = (index: number): boolean => {
    if (!isPaused) return false
    // During pause, all questions are locked
    void index
    return true
  }

  const goToQuestion = (index: number) => {
    if (index < 0 || index >= totalQuestions) return
    if (isQuestionLocked(index)) {
      toast.error("Questions verrouillées pendant la pause")
      return
    }
    setCurrentQuestionIndex(index)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Calculate pause-related info (for UI badges — pause available = not paused and not yet used)
  const pauseAvailable = exam.enablePause && !isPaused && !hasUsedPause

  // Manual submit — finalizeExam (server computes score from saved answers)
  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const result = await finalizeExam({ examId })

      if (result.success) {
        hasCompletedRef.current = true
        toast.success(
          "Examen terminé ! Vos réponses ont été enregistrées avec succès.",
        )
        router.push("/dashboard/examen-blanc")
        return
      }

      if (
        result.error.includes("déjà passé") ||
        result.error.includes("plus active")
      ) {
        router.push("/dashboard/examen-blanc")
      }
      toast.error(result.error)
    } catch (error) {
      console.error("Erreur soumission:", error)
      toast.error("Erreur lors de la soumission")
    } finally {
      setIsSubmitting(false)
      setShowSubmitDialog(false)
    }
  }

  const answeredCount = Object.keys(answers).length
  const isTimeRunningOut = checkTimeRunningOut(timeRemaining)
  const isTimeCritical = checkTimeCritical(timeRemaining)

  // Convert answers for QuestionNavigator format
  const navigatorAnswers: Record<string, { selectedAnswer: string }> = {}
  Object.entries(answers).forEach(([id, answer]) => {
    navigatorAnswers[id] = { selectedAnswer: answer }
  })

  // Session déjà soumise : l'effet d'init redirige — on évite de flasher l'UI
  // d'examen une frame en affichant un écran de redirection.
  const alreadySubmitted =
    initialSession?.status === "completed" ||
    initialSession?.status === "auto_submitted"
  if (alreadySubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Redirection...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
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
        title={exam.title}
        icon={<FileText className="h-5 w-5 text-white" />}
        backUrl="/dashboard/examen-blanc"
        examActions={{
          onTakePause: pauseAvailable ? handleEarlyPauseClick : undefined,
          canTakePause: pauseAvailable,
        }}
      />

      {/* Main content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          {/* Left column - Question */}
          <div className="space-y-6">
            {/* Pause Approaching Alert — shown when pause available and approaching answer count */}
            {pauseAvailable && answeredCount > 0 && (
              <PauseApproachingAlert
                questionsRemaining={Math.max(0, totalQuestions - answeredCount)}
                questionsAnswered={answeredCount}
                midpoint={Math.floor(totalQuestions / 2)}
                totalQuestions={totalQuestions}
                canTakeEarlyPause={pauseAvailable}
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
                    question={currentQuestion as never}
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
                data-testid="btn-previous"
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
                {pauseAvailable && (
                  <span className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
                    <Coffee className="h-4 w-4" />
                    Pause disponible
                  </span>
                )}
                {hasUsedPause && !isPaused && (
                  <span className="flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
                    <CircleCheckBig className="h-4 w-4" />
                    Pause utilisée
                  </span>
                )}
              </div>

              {currentQuestionIndex === totalQuestions - 1 ? (
                <Button
                  onClick={() => setShowSubmitDialog(true)}
                  data-testid="btn-finish"
                  className="flex items-center gap-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  <CircleCheckBig className="h-4 w-4" />
                  Terminer
                </Button>
              ) : (
                <Button
                  onClick={() => goToQuestion(currentQuestionIndex + 1)}
                  disabled={isQuestionLocked(currentQuestionIndex + 1)}
                  data-testid="btn-next"
                  className="flex items-center gap-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
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
              {pauseAvailable && (
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

              {(!exam.enablePause || hasUsedPause) && (
                <Button
                  onClick={() => setShowSubmitDialog(true)}
                  disabled={isSubmitting}
                  size="lg"
                  className="w-full bg-linear-to-r from-green-600 to-emerald-600 font-semibold text-white shadow-lg hover:from-green-700 hover:to-emerald-700"
                >
                  <Flag className="mr-2 h-4 w-4" />
                  Terminer l&apos;examen
                </Button>
              )}
            </div>
          </div>

          {/* Right column - Navigation Sidebar */}
          <div className="hidden lg:block">
            <div ref={desktopNavRef} className="h-1" />
            <QuestionNavigator
              questions={questions as never}
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

      {/* Floating toolbar with nav FAB */}
      <SessionToolbar
        showCalculator={true}
        onOpenCalculator={() => setIsCalculatorOpen(true)}
        showLabValues={true}
        onOpenLabValues={() => setIsLabValuesOpen(true)}
        showScrollTop={true}
        showNavFab={!isDesktopNavVisible}
        navFab={
          <QuestionNavigator
            questions={questions as never}
            answers={navigatorAnswers}
            flaggedQuestions={flaggedQuestions}
            currentIndex={currentQuestionIndex}
            onNavigate={goToQuestion}
            variant="mobile"
            isQuestionLocked={isQuestionLocked}
            accentColor="blue"
          />
        }
      />

      {/* Calculator Dialog */}
      <Calculator
        isOpen={isCalculatorOpen}
        onOpenChange={setIsCalculatorOpen}
      />

      {/* Lab Values Dialog */}
      <LabValues isOpen={isLabValuesOpen} onOpenChange={setIsLabValuesOpen} />

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
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Conséquences importantes :
                    </p>
                    <ul className="list-inside list-disc space-y-1 text-amber-700 dark:text-amber-300">
                      <li>Vous ne pourrez pas prendre de seconde pause</li>
                      <li>
                        Toutes les questions seront accessibles après la pause
                      </li>
                      <li>Le chronomètre reprendra à la fin de votre pause</li>
                    </ul>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400">
                Durée de la pause :{" "}
                <span className="font-semibold">
                  {pauseDurationMinutes} minutes
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
      <PauseDialog
        isOpen={showPauseDialog}
        onResume={handleResumePause}
        pauseStartedAt={pauseStartedAt}
        pauseDurationMinutes={pauseDurationMinutes}
        totalQuestions={totalQuestions}
        midpoint={Math.ceil(totalQuestions / 2)}
        isResuming={isResuming}
      />

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
              <div className="rounded-lg bg-linear-to-br from-red-50 to-orange-50 p-4 dark:from-red-950/30 dark:to-orange-950/30">
                <h3 className="mb-3 font-semibold text-red-900 dark:text-red-200">
                  Mesures anti-fraude activées
                </h3>
                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li className="flex items-start gap-2">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <span>
                      <strong>Session unique :</strong> Une fois démarré, vous
                      ne pouvez pas redémarrer l&apos;examen
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <span>
                      <strong>Timer serveur :</strong> Le temps continue même si
                      vous rafraîchissez la page
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <span>
                      <strong>Sauvegarde automatique :</strong> Vos réponses
                      sont enregistrées immédiatement après chaque sélection
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
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
                    • <strong>Questions :</strong> {totalQuestions}
                  </p>
                  <p>
                    • <strong>Durée :</strong>{" "}
                    {Math.floor(exam.completionTime / 60)} minutes
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
              className="bg-linear-to-r from-green-600 to-emerald-600 font-semibold text-white hover:from-green-700 hover:to-emerald-700"
            >
              Je comprends - Commencer l&apos;examen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function EvaluationClient(props: EvaluationClientProps) {
  return (
    <CalculatorProvider>
      <AssessmentPage {...props} />
    </CalculatorProvider>
  )
}
