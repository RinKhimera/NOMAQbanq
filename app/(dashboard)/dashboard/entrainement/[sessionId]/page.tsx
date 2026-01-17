"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useConvexAuth, useQuery, useMutation } from "convex/react"
import { useRouter, useParams } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { Brain, Loader2, AlertTriangle } from "lucide-react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { QuestionCard } from "@/components/quiz/question-card"
import { Calculator } from "@/components/quiz/calculator"
import { LabValues } from "@/components/quiz/lab-values"
import {
  SessionHeader,
  QuestionNavigator,
  SessionToolbar,
  SessionNavigation,
  FinishDialog,
} from "@/components/quiz/session"
import { CalculatorProvider } from "@/hooks/useCalculator"
import { toast } from "sonner"

const TrainingSessionPage = () => {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as Id<"trainingParticipations">
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()

  // State
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(
    new Set()
  )
  const [showFinishDialog, setShowFinishDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)
  const [isLabValuesOpen, setIsLabValuesOpen] = useState(false)

  // Skip query until authenticated to avoid race condition on page reload
  const sessionData = useQuery(
    api.training.getTrainingSessionById,
    isAuthenticated ? { sessionId } : "skip"
  )

  // Mutations
  const saveAnswer = useMutation(api.training.saveTrainingAnswer)
  const completeSession = useMutation(api.training.completeTrainingSession)

  // Derived state - filter out null values from questions
  const questions = useMemo(() => {
    if (!sessionData?.questions) return []
    return sessionData.questions.filter(
      (q): q is NonNullable<typeof q> => q !== null
    )
  }, [sessionData?.questions])
  const answers = useMemo(
    () => sessionData?.answers ?? {},
    [sessionData?.answers]
  )
  const currentQuestion = questions[currentIndex]
  const totalQuestions = questions.length

  // Computed values
  const answeredCount = Object.keys(answers).length
  const isLastQuestion = currentIndex === totalQuestions - 1
  const isFirstQuestion = currentIndex === 0

  // Handle answer selection
  const handleAnswerSelect = useCallback(
    async (answerIndex: number) => {
      if (!currentQuestion) return

      const selectedOption = currentQuestion.options[answerIndex]

      try {
        await saveAnswer({
          sessionId,
          questionId: currentQuestion._id,
          selectedAnswer: selectedOption,
        })
      } catch (error) {
        toast.error("Erreur", {
          description:
            error instanceof Error ? error.message : "Impossible de sauvegarder",
        })
      }
    },
    [currentQuestion, saveAnswer, sessionId]
  )

  // Navigation
  const goToQuestion = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalQuestions) {
        setCurrentIndex(index)
      }
    },
    [totalQuestions]
  )

  const goNext = useCallback(() => {
    if (!isLastQuestion) {
      setCurrentIndex((prev) => prev + 1)
    }
  }, [isLastQuestion])

  const goPrevious = useCallback(() => {
    if (!isFirstQuestion) {
      setCurrentIndex((prev) => prev - 1)
    }
  }, [isFirstQuestion])

  // Toggle flag
  const toggleFlag = useCallback(() => {
    if (!currentQuestion) return

    setFlaggedQuestions((prev) => {
      const newSet = new Set(prev)
      const questionIdStr = currentQuestion._id.toString()
      if (newSet.has(questionIdStr)) {
        newSet.delete(questionIdStr)
      } else {
        newSet.add(questionIdStr)
      }
      return newSet
    })
  }, [currentQuestion])

  // Finish session
  const handleFinish = useCallback(async () => {
    setIsSubmitting(true)
    try {
      await completeSession({ sessionId })
      toast.success("Session terminée !", {
        description: "Vos résultats sont prêts",
      })
      router.push(`/dashboard/entrainement/${sessionId}/results`)
    } catch (error) {
      toast.error("Erreur", {
        description:
          error instanceof Error ? error.message : "Impossible de terminer",
      })
    } finally {
      setIsSubmitting(false)
      setShowFinishDialog(false)
    }
  }, [completeSession, sessionId, router])

  // Handle navigation or finish based on position
  const handleNextOrFinish = useCallback(() => {
    if (isLastQuestion) {
      setShowFinishDialog(true)
    } else {
      goNext()
    }
  }, [isLastQuestion, goNext])

  // Keyboard navigation
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

  // Redirect to results if session is already completed
  useEffect(() => {
    if (sessionData?.session?.status === "completed") {
      router.push(`/dashboard/entrainement/${sessionId}/results`)
    }
  }, [sessionData?.session?.status, sessionId, router])

  // Loading state (auth loading or session data loading)
  if (isAuthLoading || !sessionData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-gray-600 dark:text-gray-400">
            Chargement de la session...
          </p>
        </div>
      </div>
    )
  }

  // Session expired
  if (sessionData.isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-800 dark:bg-amber-900/20">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
          <h1 className="mb-2 font-display text-xl font-bold text-amber-900 dark:text-amber-100">
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

  // Session completed - show loading while useEffect handles redirect
  if (sessionData.session.status === "completed") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-gray-600 dark:text-gray-400">
            Redirection vers les résultats...
          </p>
        </div>
      </div>
    )
  }

  const currentAnswer = currentQuestion
    ? answers[currentQuestion._id.toString()]?.selectedAnswer
    : null
  const isFlagged = currentQuestion
    ? flaggedQuestions.has(currentQuestion._id.toString())
    : false

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
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

      {/* Mobile question navigator FAB */}
      <div className="fixed bottom-6 left-6 lg:hidden">
        <QuestionNavigator
          questions={questions}
          answers={answers}
          flaggedQuestions={flaggedQuestions}
          currentIndex={currentIndex}
          onNavigate={goToQuestion}
          variant="mobile"
          accentColor="emerald"
        />
      </div>

      {/* Floating toolbar (calc + lab values) */}
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

      {/* Finish confirmation dialog */}
      <FinishDialog
        isOpen={showFinishDialog}
        onOpenChange={setShowFinishDialog}
        answeredCount={answeredCount}
        totalQuestions={totalQuestions}
        flaggedCount={flaggedQuestions.size}
        isSubmitting={isSubmitting}
        onConfirm={handleFinish}
        mode="training"
      />
    </div>
  )
}

const TrainingSessionPageWrapper = () => {
  return (
    <CalculatorProvider>
      <TrainingSessionPage />
    </CalculatorProvider>
  )
}

export default TrainingSessionPageWrapper
