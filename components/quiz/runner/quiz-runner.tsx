"use client"

import { FileText } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { Calculator } from "@/components/quiz/calculator"
import { LabValues } from "@/components/quiz/lab-values"
import { PauseDialog } from "@/components/quiz/pause-dialog"
import { QuestionCard } from "@/components/quiz/question-card"
import { FinishDialog } from "@/components/quiz/session/finish-dialog"
import { QuestionNavigator } from "@/components/quiz/session/question-navigator"
import { SessionHeader } from "@/components/quiz/session/session-header"
import { SessionNavigation } from "@/components/quiz/session/session-navigation"
import { SessionToolbar } from "@/components/quiz/session/session-toolbar"
import { useIsVisible } from "@/hooks/use-is-visible"
import { CalculatorProvider } from "@/hooks/useCalculator"
import type {
  AnswersMap,
  QuizCallbacks,
  QuizMode,
  QuizQuestion,
  QuizRevealPayload,
} from "./types"
import { useQuizSession } from "./use-quiz-session"

export interface QuizRunnerProps {
  questions: QuizQuestion[]
  initialAnswers: AnswersMap
  initialFlags?: Set<string>
  initialPause?: {
    isPaused: boolean
    totalPauseDurationMs: number
    /** Epoch ms de début de pause côté serveur — pour réhydrater le décompte overlay après rechargement. */
    pauseStartedAtMs?: number
  }
  /** Pré-révélations à hydrater au montage (mode tuteur : questions déjà répondues). */
  initialRevealed?: Record<string, QuizRevealPayload>
  /** Pause duration in minutes (for the pause overlay countdown). Default: 15. */
  pauseDurationMinutes?: number
  mode: QuizMode
  callbacks: QuizCallbacks
}

function QuizRunnerInner({
  questions,
  initialAnswers,
  initialFlags,
  initialPause,
  initialRevealed,
  pauseDurationMinutes = 15,
  mode,
  callbacks,
}: QuizRunnerProps) {
  const { ref: desktopNavRef, isVisible: isDesktopNavVisible } = useIsVisible()

  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)
  const [isLabValuesOpen, setIsLabValuesOpen] = useState(false)
  // Track local pause start time for the overlay countdown (hook doesn't expose it)
  const [localPauseStartedAt, setLocalPauseStartedAt] = useState<
    number | undefined
  >(
    // On reload-while-paused: use the server pauseStartedAt so the overlay
    // countdown reflects real elapsed time. Fall back to Date.now() only if
    // the server timestamp is absent (shouldn't happen with a healthy session).
    initialPause?.isPaused
      ? (initialPause.pauseStartedAtMs ?? Date.now())
      : undefined,
  )
  const [isResuming, setIsResuming] = useState(false)

  const session = useQuizSession({
    questions,
    initialAnswers,
    initialFlags,
    initialPause,
    initialRevealed,
    mode,
    callbacks,
  })

  const accentColor = mode.accent
  const totalQuestions = questions.length
  const currentQuestion = session.currentQuestion

  // SessionConfig derived from mode
  const sessionConfig = {
    mode: mode.kind,
    showTimer: !!mode.timer && session.timer !== null,
    timeRemaining: session.timer?.remainingMs,
    isTimeRunningOut: session.timer?.isRunningOut,
    isTimeCritical: session.timer?.isCritical,
    showCalculator: true,
    showLabValues: true,
    showFlagging: true,
    accentColor,
  } as const

  // Pause button visible in header only when exam mode with pause=rest, the
  // single rest pause hasn't been consumed yet, and not currently paused.
  const canTakePause =
    mode.pause === "rest" &&
    !session.isPaused &&
    !session.pauseAlreadyUsed &&
    !!callbacks.onPause

  const examActions =
    mode.kind === "exam" && canTakePause
      ? {
          canTakePause: true,
          onTakePause: () => {
            // Capture start time before async call, then delegate to the hook
            const startedAt = Date.now()
            void session.pause().then(() => {
              // session.isPaused may not have updated yet (async state); set optimistically
              setLocalPauseStartedAt(startedAt)
            })
          },
        }
      : undefined

  // Handle resume: call session.resume() and clear local pauseStartedAt
  const handleResume = async () => {
    setIsResuming(true)
    try {
      await session.resume()
      setLocalPauseStartedAt(undefined)
    } finally {
      setIsResuming(false)
    }
  }

  // Navigator answers format
  const navigatorAnswers: Record<
    string,
    { selectedAnswer: string; isCorrect?: boolean }
  > = {}
  for (const [qid, state] of Object.entries(session.answers)) {
    navigatorAnswers[qid] = {
      selectedAnswer: state.selected,
      isCorrect: state.isCorrect,
    }
  }

  // Reveal state for current question (immediate feedback mode only)
  const currentReveal = currentQuestion
    ? session.revealed[currentQuestion._id]
    : undefined
  const isCurrentRevealed = !!currentReveal && mode.feedback === "immediate"

  const isFlagged = currentQuestion
    ? session.flagged.has(currentQuestion._id)
    : false

  const selectedAnswer = currentQuestion
    ? (session.answers[currentQuestion._id]?.selected ?? null)
    : null

  const isLastQuestion = session.currentIndex === totalQuestions - 1

  // D3: during a rest pause, only render the header + pause overlay.
  // No question content (QuestionCard, SessionNavigation, navigators, toolbar)
  // may appear in the DOM while paused — prevents reading questions via devtools.
  const isResting = mode.pause === "rest" && session.isPaused

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Pause overlay — full-screen opaque, shown only during rest pause */}
      {isResting && (
        <PauseDialog
          isOpen={true}
          onResume={handleResume}
          pauseStartedAt={localPauseStartedAt}
          pauseDurationMinutes={pauseDurationMinutes}
          isResuming={isResuming}
        />
      )}

      {/* Header — always visible */}
      <SessionHeader
        config={sessionConfig}
        currentIndex={session.currentIndex}
        totalQuestions={totalQuestions}
        answeredCount={session.answeredCount}
        onFinish={session.requestFinish}
        title={mode.labels.title}
        icon={<FileText className="h-5 w-5 text-white" />}
        backUrl={mode.backUrl}
        examActions={examActions}
      />

      {/* Question content — NOT rendered during rest pause (D3 compliance) */}
      {!isResting && (
        <>
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
                        questionNumber={session.currentIndex + 1}
                        selectedAnswer={selectedAnswer}
                        onAnswerSelect={async (index) => {
                          await session.answerSelect(index)
                        }}
                        isFlagged={isFlagged}
                        onFlagToggle={session.toggleFlag}
                        showImage={true}
                        showCorrectAnswer={isCurrentRevealed}
                        showDomainBadge={mode.showMeta}
                        showObjectifBadge={mode.showMeta}
                        lazyExplanation={
                          isCurrentRevealed
                            ? currentReveal?.explanation
                            : undefined
                        }
                        lazyReferences={
                          isCurrentRevealed
                            ? currentReveal?.references
                            : undefined
                        }
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Navigation buttons */}
                <SessionNavigation
                  currentIndex={session.currentIndex}
                  totalQuestions={totalQuestions}
                  isFlagged={isFlagged}
                  onPrevious={session.goPrevious}
                  onNext={
                    isLastQuestion ? session.requestFinish : session.goNext
                  }
                  onToggleFlag={session.toggleFlag}
                  accentColor={accentColor}
                />
              </div>

              {/* Right column — desktop navigator */}
              <div className="hidden lg:block">
                <div ref={desktopNavRef} className="h-1" />
                <QuestionNavigator
                  questions={questions as never}
                  answers={navigatorAnswers}
                  flaggedQuestions={session.flagged}
                  currentIndex={session.currentIndex}
                  onNavigate={session.goTo}
                  accentColor={accentColor}
                />
              </div>
            </div>
          </div>

          {/* Floating toolbar with mobile nav FAB */}
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
                flaggedQuestions={session.flagged}
                currentIndex={session.currentIndex}
                onNavigate={session.goTo}
                variant="mobile"
                accentColor={accentColor}
              />
            }
          />
        </>
      )}

      {/* Calculator dialog */}
      <Calculator
        isOpen={isCalculatorOpen}
        onOpenChange={setIsCalculatorOpen}
      />

      {/* Lab values dialog */}
      <LabValues isOpen={isLabValuesOpen} onOpenChange={setIsLabValuesOpen} />

      {/* Finish / submit dialog */}
      <FinishDialog
        isOpen={session.finishDialogOpen}
        onOpenChange={session.setFinishDialogOpen}
        answeredCount={session.answeredCount}
        totalQuestions={totalQuestions}
        flaggedCount={session.flagged.size}
        isSubmitting={session.isSubmitting}
        onConfirm={() => {
          void session.confirmFinish()
        }}
        mode={mode.kind}
        timeRemaining={session.timer?.remainingMs}
        confirmText={mode.labels.finishCta}
        cancelText="Continuer"
      />
    </div>
  )
}

export function QuizRunner(props: QuizRunnerProps) {
  return (
    <CalculatorProvider>
      <QuizRunnerInner {...props} />
    </CalculatorProvider>
  )
}
