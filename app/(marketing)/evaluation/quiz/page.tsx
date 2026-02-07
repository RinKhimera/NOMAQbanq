"use client"

import { useMutation } from "convex/react"
import { ArrowRight } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { QuestionCard } from "@/components/quiz/question-card"
import QuizProgress from "@/components/quiz/quiz-progress"
import QuizResults from "@/components/quiz/quiz-results"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"

type QuizQuestion = Omit<Doc<"questions">, "correctAnswer" | "explanation">

interface QuizState {
  currentQuestion: number
  userAnswers: (string | null)[]
  isCompleted: boolean
  timeRemaining: number
  totalTime: number
}

export default function QuizPage() {
  const getQuestionsMut = useMutation(api.questions.getRandomQuestions)
  const scoreQuizMut = useMutation(api.questions.scoreQuizAnswers)
  const topOfQuizRef = useRef<HTMLDivElement>(null)
  const questionsLoadedRef = useRef(false)
  const scoringTriggeredRef = useRef(false)

  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[] | null>(
    null,
  )
  const [scoredResults, setScoredResults] = useState<{
    score: number
    questions: Doc<"questions">[]
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

    getQuestionsMut({ count: 10 }).then((questions) => {
      setQuizQuestions(questions)
      if (questions.length > 0 && questions.length < 10) {
        setQuizState((prev) => ({
          ...prev,
          userAnswers: new Array(questions.length).fill(null),
          timeRemaining: questions.length * 20,
          totalTime: questions.length * 20,
        }))
      }
    })
  }, [getQuestionsMut])

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
    if (
      !quizState.isCompleted ||
      !quizQuestions ||
      scoringTriggeredRef.current
    )
      return
    scoringTriggeredRef.current = true

    const answers = quizQuestions.map((q, i) => ({
      questionId: q._id,
      selectedAnswer: quizState.userAnswers[i],
    }))

    scoreQuizMut({ answers }).then(setScoredResults)
  }, [quizState.isCompleted, quizQuestions, quizState.userAnswers, scoreQuizMut])

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

  if (!quizQuestions || quizQuestions.length === 0) {
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

  // Écran de résultats
  if (quizState.isCompleted) {
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
        questions={scoredResults.questions}
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
          question={currentQ as Doc<"questions">}
          selectedAnswer={currentAnswer}
          onAnswerSelect={handleAnswerSelect}
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
