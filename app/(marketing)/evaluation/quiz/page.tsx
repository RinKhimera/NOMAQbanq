"use client"

import { ArrowRight } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { QuestionCard } from "@/components/quiz/question-card"
import type {
  QuestionCardQuestion,
  QuestionDoc,
} from "@/components/quiz/question-card/types"
import QuizProgress from "@/components/quiz/quiz-progress"
import QuizResults from "@/components/quiz/quiz-results"
import { Button } from "@/components/ui/button"
import {
  type QuizBundle,
  loadRandomQuizQuestions,
  scoreQuizAnswers,
} from "@/features/questions/actions"

interface QuizState {
  currentQuestion: number
  userAnswers: (string | null)[]
  isCompleted: boolean
  timeRemaining: number
  totalTime: number
}

export default function QuizPage() {
  const topOfQuizRef = useRef<HTMLDivElement>(null)
  const questionsLoadedRef = useRef(false)
  const scoringTriggeredRef = useRef(false)

  const [quizBundle, setQuizBundle] = useState<QuizBundle | null>(null)
  const [scoreFailed, setScoreFailed] = useState(false)
  const quizQuestions = quizBundle ? quizBundle.questions : null
  const [scoredResults, setScoredResults] = useState<{
    score: number
    mergedQuestions: QuestionDoc[]
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

    loadRandomQuizQuestions({ count: 10 }).then((bundle) => {
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

  // Scorer côté serveur quand le quiz est terminé
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

    scoreQuizAnswers({ answers, token }).then((result) => {
      // Refus silencieux serveur (jeton expiré, rate-limit, verrou examen
      // total) → écran « session expirée », pas de résultats à trous.
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
          correctAnswer: scored?.correctAnswer ?? "",
          explanation: scored?.explanation ?? "",
          references: scored?.references ?? [],
          // Images d'explication révélées avec la clé de correction — rendues
          // par `QuestionCard variant="review"` uniquement (jamais en passation).
          explanationImages: scored?.explanationImages ?? [],
        } satisfies QuestionDoc
      })
      setScoredResults({ score: result.score, mergedQuestions: merged })
    })
  }, [quizState.isCompleted, quizBundle, quizState.userAnswers])

  // Scroll vers le haut quand la question change
  useEffect(() => {
    if (quizState.currentQuestion > 0) {
      topOfQuizRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
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
      // Quiz terminé
      setQuizState((prev) => ({ ...prev, isCompleted: true }))
    }
  }

  const restartQuiz = () => {
    window.location.reload()
  }

  if (!quizBundle) {
    return (
      <div className="flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-300">
            Chargement des questions...
          </p>
        </div>
      </div>
    )
  }

  // Refus serveur (rate-limit, banque vide) : message générique volontairement
  // identique quelle que soit la cause — pas d'oracle côté client.
  if (!quizQuestions || quizQuestions.length === 0) {
    return (
      <div className="flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30">
        <div className="text-center">
          <p className="mb-4 text-gray-600 dark:text-gray-300">
            Le quiz est momentanément indisponible. Réessayez plus tard.
          </p>
          <Button onClick={restartQuiz}>Réessayer</Button>
        </div>
      </div>
    )
  }

  // Écran de résultats
  if (quizState.isCompleted) {
    if (scoreFailed || !quizBundle.token) {
      return (
        <div className="flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30">
          <div className="text-center">
            <p className="mb-4 text-gray-600 dark:text-gray-300">
              Session expirée — recommencez le quiz.
            </p>
            <Button onClick={restartQuiz}>Recommencer</Button>
          </div>
        </div>
      )
    }

    if (!scoredResults) {
      return (
        <div className="flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="text-gray-600 dark:text-gray-300">
              Calcul du score...
            </p>
          </div>
        </div>
      )
    }

    return (
      <QuizResults
        questions={scoredResults.mergedQuestions}
        userAnswers={quizState.userAnswers}
        score={scoredResults.score}
        timeRemaining={quizState.timeRemaining}
        onRestart={restartQuiz}
      />
    )
  }

  const currentQ = quizQuestions[quizState.currentQuestion]
  const currentAnswer = quizState.userAnswers[quizState.currentQuestion]

  return (
    <div ref={topOfQuizRef} className="theme-bg">
      <div className="mx-auto max-w-4xl px-3 pt-8 pb-4 sm:px-4 sm:pb-8 lg:px-8">
        <QuizProgress
          currentQuestion={quizState.currentQuestion}
          totalQuestions={quizQuestions.length}
          timeRemaining={quizState.timeRemaining}
          domain={currentQ.domain}
          objectifCMC={currentQ.objectifCMC}
        />

        <QuestionCard
          variant="exam"
          question={currentQ as unknown as QuestionCardQuestion}
          selectedAnswer={currentAnswer}
          onAnswerSelect={handleAnswerSelect}
          showCorrectAnswer={false}
          showImage={true}
        />

        {/* Bouton suivant */}
        <div className="flex justify-end">
          <Button
            onClick={handleNextQuestion}
            disabled={currentAnswer === null}
            className="rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-2 font-semibold text-white shadow-lg transition-all duration-300 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
          >
            {quizState.currentQuestion < quizQuestions.length - 1 ? (
              <>
                Question suivante
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            ) : (
              "Voir les résultats"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
