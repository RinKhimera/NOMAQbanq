"use client"

import { ArrowRight, Check } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { QuestionCard } from "@/components/quiz/question-card"
import { optionLetter } from "@/components/quiz/question-card/answer-option"
import type { QuizQuestion } from "@/components/quiz/runner/types"
import { SessionHeader } from "@/components/quiz/session/session-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ErrorState } from "@/components/shared/error-state"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  type QuizBundle,
  loadRandomQuizQuestions,
  scoreQuizAnswers,
} from "@/features/questions/actions"
import {
  EVALUATION_ZONES,
  type TimeZone,
  formatPauseTime,
  zone,
} from "@/lib/attempt-clock"
import { TONE_COLOR, type Tone } from "@/lib/tone"
import { EvaluationResults } from "./_components/evaluation-results"
import { EvaluationSkeleton } from "./_components/evaluation-skeleton"

interface QuizState {
  currentQuestion: number
  userAnswers: (string | null)[]
  isCompleted: boolean
  timeRemaining: number
  totalTime: number
}

const TIME_BAR_TONE: Record<TimeZone, Tone> = {
  normal: "info",
  warning: "warning",
  critical: "danger",
}

/** Écran d'état plein cadre (indisponible, session expirée, calcul du score). */
const SessionStatus = ({ children }: { children: ReactNode }) => (
  <main className="bg-background grid min-h-screen place-items-center px-4">
    <div className="flex flex-col items-center gap-3.5 text-center">
      {children}
    </div>
  </main>
)

export default function QuizPage() {
  const topOfQuizRef = useRef<HTMLDivElement>(null)
  const questionsLoadedRef = useRef(false)
  const scoringTriggeredRef = useRef(false)

  const [quizBundle, setQuizBundle] = useState<QuizBundle | null>(null)
  const [scoreFailed, setScoreFailed] = useState(false)
  const [isFinishOpen, setIsFinishOpen] = useState(false)
  const quizQuestions = quizBundle ? quizBundle.questions : null
  const [scoredResults, setScoredResults] = useState<{
    mergedQuestions: QuizQuestion[]
  } | null>(null)

  const [quizState, setQuizState] = useState<QuizState>({
    currentQuestion: 0,
    userAnswers: new Array(10).fill(null),
    isCompleted: false,
    timeRemaining: 200,
    totalTime: 200,
  })

  // Charger les questions une seule fois au montage
  useEffect(() => {
    if (questionsLoadedRef.current) return
    questionsLoadedRef.current = true

    loadRandomQuizQuestions({ count: 10 })
      .then((bundle) => {
        setQuizBundle(bundle)
        if (bundle.questions.length > 0 && bundle.questions.length < 10) {
          setQuizState((prev) => ({
            ...prev,
            userAnswers: new Array(bundle.questions.length).fill(null),
            timeRemaining: bundle.questions.length * 20,
            totalTime: bundle.questions.length * 20,
          }))
        }
      })
      // Rejet de l'action (réseau coupé, throw serveur) → bundle vide plutôt
      // que le loader infini : le rendu bascule sur « momentanément indisponible ».
      .catch(() => setQuizBundle({ questions: [], token: null }))
  }, [])

  // Timer - utiliser setInterval pour décrémenter le temps
  useEffect(() => {
    if (!quizQuestions || quizState.isCompleted) return

    const interval = setInterval(() => {
      setQuizState((prev) => {
        if (prev.timeRemaining <= 1) {
          clearInterval(interval)
          return { ...prev, timeRemaining: 0, isCompleted: true }
        }
        return { ...prev, timeRemaining: prev.timeRemaining - 1 }
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [quizQuestions, quizState.isCompleted])

  useEffect(() => {
    if (!quizState.isCompleted || !quizBundle || scoringTriggeredRef.current)
      return
    if (quizBundle.questions.length === 0) return
    scoringTriggeredRef.current = true

    // Pas de setState SYNCHRONE dans le corps de l'effet (ESLint
    // react-hooks/set-state-in-effect casse `check`) : le cas token null est
    // dérivé au RENDU (écran « Session expirée »), jamais stocké ici.
    // setScoreFailed ne vit que dans le .then (asynchrone, OK).
    const token = quizBundle.token
    if (!token) return

    const served = quizBundle.questions
    const answers = served.map((q, i) => ({
      questionId: q._id,
      selectedAnswer: quizState.userAnswers[i],
    }))

    scoreQuizAnswers({ answers, token })
      .then((result) => {
        // Refus TOTAL du serveur (jeton expiré, rate-limit, ou toutes les
        // questions verrouillées par un examen ouvert) → écran « session
        // expirée ». Un verrou PARTIEL (rare : examen ouvert pendant la vie du
        // jeton couvrant une partie du lot) laisse ces questions sans
        // correction : clé retenue, affichée comme « correction différée ».
        if (result.totalQuestions === 0) {
          setScoreFailed(true)
          return
        }
        const resultMap = new Map(
          result.questionResults.map((r) => [r.questionId, r]),
        )
        const merged = served.map((q) => {
          const scored = resultMap.get(q._id)
          return {
            ...q,
            ...(scored ? {} : { keyWithheld: true as const }),
            correctAnswer: scored?.correctAnswer ?? "",
            explanation: scored?.explanation ?? "",
            references: scored?.references ?? [],
            // Images d'explication révélées avec la clé de correction — rendues
            // par `QuestionCard variant="review"` uniquement (jamais en passation).
            explanationImages: scored?.explanationImages ?? [],
          } satisfies QuizQuestion
        })
        setScoredResults({ mergedQuestions: merged })
      })
      // Rejet de l'action → même écran que le refus total (pas de loader figé).
      .catch(() => setScoreFailed(true))
  }, [quizState.isCompleted, quizBundle, quizState.userAnswers])

  useEffect(() => {
    if (quizState.currentQuestion > 0) {
      topOfQuizRef.current?.scrollIntoView({ block: "start" })
    }
  }, [quizState.currentQuestion])

  const handleAnswerSelect = (answerIndex: number) => {
    if (!quizQuestions) return
    const selectedOption =
      quizQuestions[quizState.currentQuestion].options[answerIndex]
    const newUserAnswers = [...quizState.userAnswers]
    newUserAnswers[quizState.currentQuestion] = selectedOption

    setQuizState((prev) => ({
      ...prev,
      userAnswers: newUserAnswers,
    }))
  }

  const handleNextQuestion = () => {
    if (!quizQuestions) return
    if (quizState.currentQuestion < quizQuestions.length - 1) {
      setQuizState((prev) => ({
        ...prev,
        currentQuestion: prev.currentQuestion + 1,
      }))
    } else {
      setQuizState((prev) => ({ ...prev, isCompleted: true }))
    }
  }

  const restartQuiz = () => {
    window.location.reload()
  }

  // Attente de contenu : squelette à la forme de la passation, pas de spinner.
  if (!quizBundle) {
    return <EvaluationSkeleton />
  }

  // Refus serveur (rate-limit, banque vide) : message générique volontairement
  // identique quelle que soit la cause — pas d'oracle côté client.
  if (!quizQuestions || quizQuestions.length === 0) {
    return (
      <SessionStatus>
        <ErrorState
          variant="page"
          title="Quiz momentanément indisponible"
          description="Le quiz est momentanément indisponible. Réessayez plus tard."
          onRetry={restartQuiz}
        />
      </SessionStatus>
    )
  }

  if (quizState.isCompleted) {
    if (scoreFailed || !quizBundle.token) {
      return (
        <SessionStatus>
          <h1 className="type-h3 text-ink">Session expirée</h1>
          <p className="text-ink-2 text-[15px]">
            Recommencez l&apos;évaluation pour obtenir votre score.
          </p>
          <Button onClick={restartQuiz} className="max-md:h-11">
            Recommencer
          </Button>
        </SessionStatus>
      )
    }

    if (!scoredResults) {
      return (
        // Écran dédié assumé : transition attendue après un clic explicite.
        <SessionStatus>
          <Spinner />
          <h1 className="text-ink-3 font-mono text-[13px]">Calcul du score…</h1>
        </SessionStatus>
      )
    }

    return (
      <EvaluationResults
        questions={scoredResults.mergedQuestions}
        userAnswers={quizState.userAnswers}
        elapsedSeconds={quizState.totalTime - quizState.timeRemaining}
        totalSeconds={quizState.totalTime}
        onRestart={restartQuiz}
      />
    )
  }

  const currentQ = quizQuestions[quizState.currentQuestion]
  const currentAnswer = quizState.userAnswers[quizState.currentQuestion]

  const isLast = quizState.currentQuestion === quizQuestions.length - 1
  const answeredCount = quizState.userAnswers.filter((a) => a !== null).length
  const remainingMs = quizState.timeRemaining * 1000
  const timeZone = zone(remainingMs, EVALUATION_ZONES)

  return (
    <div ref={topOfQuizRef} className="bg-background min-h-screen">
      <div className="sticky top-0 z-10">
        <SessionHeader
          title="Évaluation gratuite"
          kind="exam"
          modeLabel="Chronométré"
          currentIndex={quizState.currentQuestion}
          totalQuestions={quizQuestions.length}
          answeredCount={answeredCount}
          timer={{ label: formatPauseTime(remainingMs), zone: timeZone }}
          onFinish={() => setIsFinishOpen(true)}
          sticky={false}
        />
        <div aria-hidden className="bg-line h-0.5">
          <div
            className="h-full"
            style={{
              width: `${(quizState.timeRemaining / quizState.totalTime) * 100}%`,
              background: TONE_COLOR[TIME_BAR_TONE[timeZone]],
            }}
          />
        </div>
      </div>

      <main className="mx-auto flex max-w-200 flex-col gap-4 px-4 pt-8 pb-16 sm:px-6">
        <QuestionCard
          variant="exam"
          question={currentQ}
          questionNumber={quizState.currentQuestion + 1}
          totalQuestions={quizQuestions.length}
          selectedAnswer={currentAnswer}
          onAnswerSelect={handleAnswerSelect}
          showCorrectAnswer={false}
          showImage={true}
          footer={
            <>
              <span className="text-ink-3 min-w-0 font-mono text-xs">
                {currentAnswer === null
                  ? "Choisissez une réponse"
                  : `Réponse ${optionLetter(currentQ.options.indexOf(currentAnswer))} enregistrée`}
              </span>
              <Button
                onClick={handleNextQuestion}
                disabled={currentAnswer === null}
                className="ml-auto min-w-46 max-md:h-11"
              >
                {isLast ? "Voir les résultats" : "Question suivante"}
                {isLast ? <Check aria-hidden /> : <ArrowRight aria-hidden />}
              </Button>
            </>
          }
        />
        <p className="text-ink-3 text-[13px]">
          20 secondes par question en moyenne · les corrections s&apos;affichent
          à la fin.
        </p>
      </main>

      <ConfirmDialog
        open={isFinishOpen}
        onOpenChange={setIsFinishOpen}
        title="Terminer l'évaluation ?"
        description={`Vous avez répondu à ${answeredCount} question${answeredCount > 1 ? "s" : ""} sur ${quizQuestions.length}. Les questions sans réponse seront comptées comme incorrectes.`}
        cancelLabel="Continuer"
        confirmLabel="Terminer"
        confirmTestId="btn-confirm-finish"
        onConfirm={() =>
          setQuizState((prev) => ({ ...prev, isCompleted: true }))
        }
      />
    </div>
  )
}
