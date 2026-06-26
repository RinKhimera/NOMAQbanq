"use client"

import { AlertTriangle, Brain } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useRouter } from "next/navigation"
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react"
import { toast } from "sonner"
import { Calculator } from "@/components/quiz/calculator"
import { LabValues } from "@/components/quiz/lab-values"
import { QuestionCard } from "@/components/quiz/question-card"
import { FinishDialog } from "@/components/quiz/session/finish-dialog"
import { QuestionNavigator } from "@/components/quiz/session/question-navigator"
import { SessionHeader } from "@/components/quiz/session/session-header"
import { SessionNavigation } from "@/components/quiz/session/session-navigation"
import { SessionToolbar } from "@/components/quiz/session/session-toolbar"
import { Button } from "@/components/ui/button"
import {
  completeTrainingSession,
  saveTrainingAnswer,
} from "@/features/training/actions"
import type {
  TrainingAnswerRecord,
  TrainingSessionView,
} from "@/features/training/dal"
import { useIsVisible } from "@/hooks/use-is-visible"

type SessionData = NonNullable<TrainingSessionView>

interface TrainingSessionClientProps {
  sessionId: string
  initialData: SessionData
}

export const TrainingSessionClient = ({
  sessionId,
  initialData,
}: TrainingSessionClientProps) => {
  const router = useRouter()
  const { ref: desktopNavRef, isVisible: isDesktopNavVisible } = useIsVisible()

  // State
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(
    new Set(),
  )
  const [showFinishDialog, setShowFinishDialog] = useState(false)
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)
  const [isLabValuesOpen, setIsLabValuesOpen] = useState(false)

  // Réponses : état client optimiste (plus de réactivité Convex). Initialisé
  // depuis le serveur ; mis à jour à chaque saveTrainingAnswer.
  const [answers, setAnswers] = useState<TrainingAnswerRecord>(
    initialData.answers,
  )

  const questions = initialData.questions
  const currentQuestion = questions[currentIndex]
  const totalQuestions = questions.length

  const answeredCount = Object.keys(answers).length
  const isLastQuestion = currentIndex === totalQuestions - 1
  const isFirstQuestion = currentIndex === 0

  // Sauvegarde optimiste de la réponse courante.
  const handleAnswerSelect = useCallback(
    async (answerIndex: number) => {
      if (!currentQuestion) return
      const selectedOption = currentQuestion.options[answerIndex]
      const questionId = currentQuestion._id

      const res = await saveTrainingAnswer({
        sessionId,
        questionId,
        selectedAnswer: selectedOption,
      })
      if (!res.success) {
        toast.error("Erreur", { description: res.error })
        return
      }
      setAnswers((prev) => ({
        ...prev,
        [questionId]: {
          selectedAnswer: selectedOption,
          isCorrect: res.isCorrect,
        },
      }))
    },
    [currentQuestion, sessionId],
  )

  // Navigation
  const goToQuestion = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalQuestions) {
        setCurrentIndex(index)
      }
    },
    [totalQuestions],
  )

  const goNext = useCallback(() => {
    if (!isLastQuestion) setCurrentIndex((prev) => prev + 1)
  }, [isLastQuestion])

  const goPrevious = useCallback(() => {
    if (!isFirstQuestion) setCurrentIndex((prev) => prev - 1)
  }, [isFirstQuestion])

  const toggleFlag = useCallback(() => {
    if (!currentQuestion) return
    setFlaggedQuestions((prev) => {
      const newSet = new Set(prev)
      const questionIdStr = currentQuestion._id
      if (newSet.has(questionIdStr)) newSet.delete(questionIdStr)
      else newSet.add(questionIdStr)
      return newSet
    })
  }, [currentQuestion])

  const [, startTransition] = useTransition()

  // Fin de session
  const [, finishAction, isSubmitting] = useActionState(
    async () => {
      const res = await completeTrainingSession({ sessionId })
      if (!res.success) {
        toast.error("Erreur", { description: res.error })
        setShowFinishDialog(false)
        return { success: false }
      }
      toast.success("Session terminée !", {
        description: "Vos résultats sont prêts",
      })
      router.push(`/dashboard/entrainement/${sessionId}/results`)
      return { success: true }
    },
    { success: false },
  )

  const handleNextOrFinish = useCallback(() => {
    if (isLastQuestion) setShowFinishDialog(true)
    else goNext()
  }, [isLastQuestion, goNext])

  // Navigation clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showFinishDialog) return
      switch (e.key) {
        case "ArrowRight":
          goNext()
          break
        case "ArrowLeft":
          goPrevious()
          break
        case "f":
        case "F":
          toggleFlag()
          break
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [goNext, goPrevious, toggleFlag, showFinishDialog])

  // Session expirée
  if (initialData.isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-800 dark:bg-amber-900/20">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
          <h1 className="font-display mb-2 text-xl font-bold text-amber-900 dark:text-amber-100">
            Session expirée
          </h1>
          <p className="mb-6 text-amber-700 dark:text-amber-300">
            Cette session a expiré. Veuillez en créer une nouvelle.
          </p>
          <Button
            onClick={() => router.push("/dashboard/entrainement")}
            className="bg-amber-500 hover:bg-amber-600"
          >
            Retour à l&apos;entraînement
          </Button>
        </div>
      </div>
    )
  }

  const currentAnswer = currentQuestion
    ? answers[currentQuestion._id]?.selectedAnswer
    : null
  const isFlagged = currentQuestion
    ? flaggedQuestions.has(currentQuestion._id)
    : false

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <SessionHeader
        config={{
          mode: "training",
          showTimer: false,
          showCalculator: true,
          showLabValues: true,
          showFlagging: true,
          accentColor: "emerald",
        }}
        currentIndex={currentIndex}
        totalQuestions={totalQuestions}
        answeredCount={answeredCount}
        onFinish={() => setShowFinishDialog(true)}
        title="Entraînement"
        icon={<Brain className="h-5 w-5 text-white" />}
        backUrl="/dashboard/entrainement"
      />

      {/* Main content */}
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Question area */}
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {currentQuestion && (
                <motion.div
                  key={currentQuestion._id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <QuestionCard
                    question={currentQuestion as never}
                    variant="exam"
                    questionNumber={currentIndex + 1}
                    selectedAnswer={currentAnswer}
                    onAnswerSelect={handleAnswerSelect}
                    isFlagged={isFlagged}
                    onFlagToggle={toggleFlag}
                    showCorrectAnswer={false}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation buttons */}
            <SessionNavigation
              currentIndex={currentIndex}
              totalQuestions={totalQuestions}
              isFlagged={isFlagged}
              onPrevious={goPrevious}
              onNext={handleNextOrFinish}
              onToggleFlag={toggleFlag}
              accentColor="emerald"
            />
          </div>

          {/* Sidebar - Question navigator */}
          <div className="hidden lg:block">
            <div ref={desktopNavRef} className="h-1" />
            <QuestionNavigator
              questions={questions}
              answers={answers}
              flaggedQuestions={flaggedQuestions}
              currentIndex={currentIndex}
              onNavigate={goToQuestion}
              accentColor="emerald"
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
            questions={questions}
            answers={answers}
            flaggedQuestions={flaggedQuestions}
            currentIndex={currentIndex}
            onNavigate={goToQuestion}
            variant="mobile"
            accentColor="emerald"
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

      {/* Finish confirmation dialog */}
      <FinishDialog
        isOpen={showFinishDialog}
        onOpenChange={setShowFinishDialog}
        answeredCount={answeredCount}
        totalQuestions={totalQuestions}
        flaggedCount={flaggedQuestions.size}
        isSubmitting={isSubmitting}
        onConfirm={() => startTransition(() => finishAction())}
        mode="training"
      />
    </div>
  )
}
