"use client"

import {
  Calculator as CalculatorIcon,
  FlaskConical,
  Timer,
  WifiOff,
} from "lucide-react"
import { type ReactNode, useRef, useState } from "react"
import { Calculator } from "@/components/quiz/calculator"
import { LabValues } from "@/components/quiz/lab-values"
import { passationCells } from "@/components/quiz/navigator/cells"
import {
  NavigatorPanel,
  NavigatorSheet,
} from "@/components/quiz/navigator/question-navigator"
import { PauseDialog } from "@/components/quiz/pause-dialog"
import { QuestionCard } from "@/components/quiz/question-card"
import { FinishDialog } from "@/components/quiz/session/finish-dialog"
import { SessionHeader } from "@/components/quiz/session/session-header"
import { SessionNavigation } from "@/components/quiz/session/session-navigation"
import { TimeUpDialog } from "@/components/quiz/session/time-up-dialog"
import { StatusPill } from "@/components/shared/status-pill"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DEFAULT_PAUSE_MINUTES } from "@/features/exams/schemas"
import { useOnline } from "@/hooks/use-online"
import { CalculatorProvider } from "@/hooks/useCalculator"
import { EXAM_ZONES, formatExamTime, zone } from "@/lib/attempt-clock"
import { TONE_SOFT } from "@/lib/tone"
import { cn } from "@/lib/utils"
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
  /** Durée de la pause en minutes (décompte de l'overlay). */
  pauseDurationMinutes?: number
  /** Alertes de la page au-dessus de la question (reprise d'un examen…). */
  banners?: ReactNode
  mode: QuizMode
  callbacks: QuizCallbacks
}

function QuizRunnerInner({
  questions,
  initialAnswers,
  initialFlags,
  initialPause,
  initialRevealed,
  pauseDurationMinutes = DEFAULT_PAUSE_MINUTES,
  banners,
  mode,
  callbacks,
}: QuizRunnerProps) {
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)
  const online = useOnline()
  const calculatorButtonRef = useRef<HTMLButtonElement>(null)
  const [isResuming, setIsResuming] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)

  const session = useQuizSession({
    questions,
    initialAnswers,
    initialFlags,
    initialPause,
    initialRevealed,
    mode,
    callbacks,
  })

  const isExam = mode.kind === "exam"
  const tutor = mode.feedback === "immediate"
  const totalQuestions = questions.length
  const currentQuestion = session.currentQuestion

  const canTakePause =
    mode.pause === "rest" &&
    !session.isPaused &&
    !session.pauseAlreadyUsed &&
    !!callbacks.onPause

  // Sur échec (réseau), le hook garde le début de pause : le décompte de
  // l'overlay continue et l'auto-resume reste armé — seule une reprise RÉUSSIE
  // ferme la pause.
  const handleResume = async () => {
    setIsResuming(true)
    try {
      await session.resume()
    } finally {
      setIsResuming(false)
    }
  }

  // Garde anti double-clic : empêche un second saveTrainingAnswer si
  // l'utilisateur clique avant la révélation.
  const handleConfirmAnswer = async () => {
    if (isConfirming) return
    setIsConfirming(true)
    try {
      await session.confirmAnswer()
    } finally {
      setIsConfirming(false)
    }
  }

  const currentReveal = currentQuestion
    ? session.revealed[currentQuestion._id]
    : undefined
  const isCurrentRevealed = !!currentReveal && tutor

  // La question mappée au montage ne porte pas correctAnswer pour les questions
  // répondues en cours de session (anti-triche DAL) ; on l'injecte depuis le
  // reveal serveur pour que QuestionCard puisse colorer la bonne réponse — ou
  // le marqueur « clé retenue », pour qu'elle affiche la correction différée.
  const withReveal = (q: QuizQuestion): QuizQuestion =>
    !currentReveal
      ? q
      : currentReveal.keyWithheld
        ? { ...q, keyWithheld: true }
        : { ...q, correctAnswer: currentReveal.correctAnswer }
  const currentCorrection =
    currentReveal && !currentReveal.keyWithheld ? currentReveal : undefined

  const selectedAnswer = currentQuestion
    ? (session.answers[currentQuestion._id]?.selected ??
      session.pendingSelection[currentQuestion._id] ??
      null)
    : null

  const hasPendingSelection =
    tutor &&
    !!currentQuestion &&
    !isCurrentRevealed &&
    session.pendingSelection[currentQuestion._id] !== undefined

  const timer =
    mode.timer && session.timer
      ? {
          label: formatExamTime(session.timer.remainingMs),
          zone: zone(session.timer.remainingMs),
        }
      : undefined
  const remaining = session.timer?.remainingMs
  const timeIsUp = !!mode.timer && remaining !== undefined && remaining <= 0
  const minutesLeft =
    remaining !== undefined && !timeIsUp && remaining < EXAM_ZONES.criticalMs
      ? Math.max(1, Math.ceil(remaining / 60_000))
      : null

  const cells = passationCells(questions, session.answers, session.flagged)
  const navigator = {
    cells,
    currentIndex: session.currentIndex,
    columns: isExam ? 8 : 5,
    kind: "passation",
  } as const

  // Pendant une pause repos, seuls l'en-tête et l'overlay sont rendus : aucun
  // contenu de question ne doit être dans le DOM, sinon il se lit via les
  // devtools.
  const isResting = mode.pause === "rest" && session.isPaused

  return (
    <div className="flex flex-col">
      {isResting && (
        <PauseDialog
          isOpen={true}
          onResume={handleResume}
          pauseStartedAt={session.pauseStartedAt}
          pauseDurationMinutes={pauseDurationMinutes}
          initialNow={session.serverNow}
          isResuming={isResuming}
          examTimeLabel={timer?.label}
        />
      )}

      <SessionHeader
        title={mode.labels.title}
        kind={mode.kind}
        modeLabel={isExam ? "Chronométré" : tutor ? "Mode tuteur" : "Mode test"}
        currentIndex={session.currentIndex}
        totalQuestions={totalQuestions}
        answeredCount={session.answeredCount}
        timer={timer}
        onPause={
          canTakePause
            ? () => {
                setIsCalculatorOpen(false)
                void session.pause()
              }
            : undefined
        }
        onFinish={session.requestFinish}
      />

      {!isResting && (
        <div className="mx-auto flex w-full max-w-290 items-start gap-6 px-4 pt-4 pb-16 sm:px-6 md:pt-6">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {!online && (
              <Alert
                data-testid="offline-alert"
                className={cn(TONE_SOFT.warning, "[&>svg]:text-warning-ink")}
              >
                <WifiOff aria-hidden />
                <AlertTitle>Connexion perdue</AlertTitle>
                <AlertDescription>
                  Vos réponses ne s&apos;enregistrent pas pour l&apos;instant :
                  réessayez dès le retour de la connexion.
                  {mode.timer && " Le chronomètre continue."}
                </AlertDescription>
              </Alert>
            )}
            {banners}
            {minutesLeft !== null && (
              <Alert variant="destructive" data-testid="time-low-alert">
                <Timer aria-hidden />
                <AlertTitle>
                  Moins de {minutesLeft} minute{minutesLeft > 1 ? "s" : ""}{" "}
                  restante{minutesLeft > 1 ? "s" : ""}
                </AlertTitle>
                <AlertDescription>
                  L&apos;examen sera soumis automatiquement à la fin du temps,
                  avec les réponses enregistrées.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {!isExam && (
                <StatusPill
                  tone={tutor ? "success" : "info"}
                  className="mr-auto"
                >
                  {tutor
                    ? "Mode tuteur · correction immédiate"
                    : "Mode test · correction à la fin"}
                </StatusPill>
              )}
              <NavigatorSheet
                {...navigator}
                onSelect={session.goTo}
                triggerClassName="lg:hidden"
              />
              <Button
                ref={calculatorButtonRef}
                variant="ghost"
                size="sm"
                onClick={() => setIsCalculatorOpen((open) => !open)}
                aria-expanded={isCalculatorOpen}
                data-testid="btn-calculator"
                className="max-md:size-11 max-md:px-0"
              >
                <CalculatorIcon aria-hidden />
                <span className="max-md:sr-only">Calculatrice</span>
              </Button>
              <LabValues
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="btn-lab-values"
                    className="max-md:size-11 max-md:px-0"
                  >
                    <FlaskConical aria-hidden />
                    <span className="max-md:sr-only">Valeurs labo</span>
                  </Button>
                }
              />
            </div>

            {currentQuestion && (
              <QuestionCard
                question={withReveal(currentQuestion)}
                variant="exam"
                questionNumber={session.currentIndex + 1}
                totalQuestions={totalQuestions}
                selectedAnswer={selectedAnswer}
                onAnswerSelect={(index) => void session.answerSelect(index)}
                isFlagged={session.flagged.has(currentQuestion._id)}
                onFlagToggle={session.toggleFlag}
                showCorrectAnswer={isCurrentRevealed}
                showDomainBadge={mode.showMeta}
                showObjectifBadge={mode.showMeta}
                lazyExplanation={
                  isCurrentRevealed ? currentCorrection?.explanation : undefined
                }
                lazyReferences={
                  isCurrentRevealed ? currentCorrection?.references : undefined
                }
                footer={
                  <SessionNavigation
                    currentIndex={session.currentIndex}
                    totalQuestions={totalQuestions}
                    onPrevious={session.goPrevious}
                    onNext={session.goNext}
                    onFinish={session.requestFinish}
                    finishLabel={isExam ? "Soumettre" : "Terminer la série"}
                    onValidate={
                      hasPendingSelection
                        ? () => void handleConfirmAnswer()
                        : undefined
                    }
                    isValidating={isConfirming}
                  />
                }
              />
            )}
          </div>

          <aside className="bg-surface border-line sticky top-[calc(var(--shell-offset,0px)+5rem)] hidden w-75 shrink-0 rounded-lg border p-5 lg:block">
            <NavigatorPanel
              {...navigator}
              title={isExam ? "Navigation" : "Questions"}
              onSelect={session.goTo}
            />
          </aside>
        </div>
      )}

      <Calculator
        isOpen={isCalculatorOpen && !isResting}
        onOpenChange={setIsCalculatorOpen}
        returnFocusRef={calculatorButtonRef}
      />

      {timeIsUp && (
        <TimeUpDialog
          answeredCount={session.answeredCount}
          totalQuestions={totalQuestions}
          isSubmitting={session.isSubmitting}
          onRetry={() => void session.confirmFinish({ isAutoSubmit: true })}
        />
      )}

      <FinishDialog
        isOpen={session.finishDialogOpen && !timeIsUp}
        onOpenChange={session.setFinishDialogOpen}
        answeredCount={session.answeredCount}
        totalQuestions={totalQuestions}
        flaggedCount={session.flagged.size}
        isSubmitting={session.isSubmitting}
        onConfirm={() => {
          void session.confirmFinish()
        }}
        kind={mode.kind}
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
